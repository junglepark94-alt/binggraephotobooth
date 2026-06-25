import { useEffect, useRef, useState } from "react";
import { FestivalSelectBg } from "@/components/common";
import { type PlazaPost, likePostFn, listPostsFn } from "@/lib/plaza";

// 상대 시간 표기 (방금/N분 전/N시간 전/N일 전).
function timeAgo(ts: number): string {
  const s = Math.max(0, Math.floor((Date.now() - ts) / 1000));
  if (s < 60) return "방금 전";
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}분 전`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}시간 전`;
  return `${Math.floor(h / 24)}일 전`;
}

// "한 명이 한 번"은 디바이스 localStorage로 관리(서버는 누적 수만 증감).
const LIKED_KEY = "plaza:liked";
function loadLiked(): Set<string> {
  try {
    return new Set(JSON.parse(localStorage.getItem(LIKED_KEY) || "[]") as string[]);
  } catch {
    return new Set();
  }
}
function saveLiked(s: Set<string>) {
  try {
    localStorage.setItem(LIKED_KEY, JSON.stringify([...s]));
  } catch {
    /* 저장 불가(프라이빗 모드 등) 시 무시 */
  }
}

type SortKey = "new" | "likes";

// 광장 게시판 (스토리보드 — 주민 자랑 피드). 주민들이 올린 인생네컷을 모아 보여준다.
export function PlazaBoard({
  onBack,
  highlightId,
}: {
  onBack: () => void;
  highlightId?: string | null;
}) {
  const [posts, setPosts] = useState<PlazaPost[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [sort, setSort] = useState<SortKey>("new");
  const [liked, setLiked] = useState<Set<string>>(new Set());
  const likingRef = useRef<Set<string>>(new Set()); // 처리 중인 좋아요(더블클릭 방지)

  const load = () => {
    setLoading(true);
    setError(null);
    listPostsFn()
      .then((list) => {
        setPosts(list);
        // 더 이상 존재하지 않는(삭제됐거나 밀려난) 글의 liked 표시는 정리한다.
        setLiked((prev) => {
          const ids = new Set(list.map((p) => p.id));
          const next = new Set([...prev].filter((id) => ids.has(id)));
          if (next.size !== prev.size) saveLiked(next);
          return next;
        });
      })
      .catch(() => {
        setError("게시물을 불러오지 못했어요. 잠시 후 다시 시도해주세요.");
        setPosts([]);
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    setLiked(loadLiked());
    load();
  }, []);

  // 좋아요 토글 — 낙관적 업데이트 후 서버 누적 수로 보정.
  const toggleLike = async (id: string) => {
    if (likingRef.current.has(id)) return; // 이전 요청 처리 중이면 무시
    likingRef.current.add(id);
    const willLike = !liked.has(id);
    setLiked((prev) => {
      const n = new Set(prev);
      if (willLike) n.add(id);
      else n.delete(id);
      saveLiked(n);
      return n;
    });
    setPosts(
      (prev) =>
        prev?.map((p) =>
          p.id === id ? { ...p, likes: Math.max(0, p.likes + (willLike ? 1 : -1)) } : p,
        ) ?? prev,
    );
    try {
      const res = await likePostFn({ data: { id, like: willLike } });
      setPosts((prev) => prev?.map((p) => (p.id === id ? { ...p, likes: res.likes } : p)) ?? prev);
    } catch {
      // 실패 시 롤백
      setLiked((prev) => {
        const n = new Set(prev);
        if (willLike) n.delete(id);
        else n.add(id);
        saveLiked(n);
        return n;
      });
      setPosts(
        (prev) =>
          prev?.map((p) =>
            p.id === id ? { ...p, likes: Math.max(0, p.likes + (willLike ? -1 : 1)) } : p,
          ) ?? prev,
      );
    } finally {
      likingRef.current.delete(id);
    }
  };

  const shown: PlazaPost[] = posts
    ? sort === "likes"
      ? [...posts].sort((a, b) => b.likes - a.likes || b.createdAt - a.createdAt)
      : posts
    : [];

  return (
    <FestivalSelectBg onBack={onBack}>
      <div className="space-y-3 px-3 pb-10 pt-1">
        <h2 className="text-center font-display text-lg font-extrabold text-primary drop-shadow-sm">
          광장 게시판
        </h2>
        <p className="text-center text-sm text-muted-foreground">
          주민들이 자랑한 인생네컷을 구경해보세요!
        </p>

        {/* 좌상단 정렬 탭 + 우측 새로고침 */}
        <div className="flex items-center justify-between">
          <div className="flex gap-1 rounded-full bg-white/70 p-1 shadow-sm ring-1 ring-border">
            {(
              [
                ["new", "최신순"],
                ["likes", "좋아요순"],
              ] as [SortKey, string][]
            ).map(([k, label]) => (
              <button
                key={k}
                onClick={() => setSort(k)}
                className={`rounded-full px-3 py-1 text-xs font-bold transition ${
                  sort === k ? "bg-primary text-primary-foreground shadow" : "text-muted-foreground"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
          <button
            onClick={load}
            disabled={loading}
            className="rounded-full bg-white/85 px-3 py-1.5 text-xs font-bold text-primary shadow ring-1 ring-white transition active:scale-95 disabled:opacity-50"
          >
            {loading ? "새로고침 중…" : "🔄 새로고침"}
          </button>
        </div>

        {error && (
          <div className="rounded-xl bg-destructive/10 p-3 text-center text-xs text-destructive ring-1 ring-destructive/30">
            {error}
          </div>
        )}

        {posts === null ? (
          <div className="festival-card grid place-items-center p-8">
            <div className="flex flex-col items-center gap-3 text-center">
              <div className="h-9 w-9 animate-spin rounded-full border-4 border-primary border-t-transparent" />
              <p className="text-sm text-muted-foreground">게시판 불러오는 중…</p>
            </div>
          </div>
        ) : posts.length === 0 ? (
          <div className="festival-card p-8 text-center">
            <div className="text-4xl">🪧</div>
            <p className="mt-2 text-sm font-bold text-amber-900">아직 게시물이 없어요</p>
            <p className="mt-1 text-xs text-muted-foreground">
              네컷을 찍고 “주민들에게 자랑하기”로 첫 글을 올려보세요!
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-2 items-start gap-3">
            {shown.map((p) => {
              const active = p.id === highlightId;
              const isLiked = liked.has(p.id);
              return (
                <div
                  key={p.id}
                  className={`overflow-hidden rounded-2xl bg-white/90 shadow transition ${
                    active ? "ring-2 ring-primary" : "ring-1 ring-border"
                  }`}
                >
                  <img
                    src={p.image}
                    alt={p.title}
                    draggable={false}
                    loading="lazy"
                    decoding="async"
                    className="block w-full select-none object-cover"
                  />
                  <div className="px-2 py-2">
                    <p className="truncate text-[13px] font-bold text-amber-900">{p.title}</p>
                    {p.author && (
                      <p className="mt-0.5 truncate text-[11px] font-semibold text-primary/90">
                        🏷️ {p.author}
                      </p>
                    )}
                    <div className="mt-1 flex items-end justify-between gap-1">
                      <p className="text-[10px] text-muted-foreground">
                        {active && <span className="mr-1 font-bold text-primary">내 글 ·</span>}
                        {timeAgo(p.createdAt)}
                      </p>
                      {/* 우하단 좋아요 버튼 (한 번 더 누르면 취소) */}
                      <button
                        onClick={() => toggleLike(p.id)}
                        aria-label={isLiked ? "좋아요 취소" : "좋아요"}
                        aria-pressed={isLiked}
                        className={`flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[12px] font-bold transition active:scale-90 ${
                          isLiked
                            ? "bg-primary/15 text-primary ring-1 ring-primary/30"
                            : "bg-secondary/50 text-muted-foreground ring-1 ring-border"
                        }`}
                      >
                        <span className="leading-none">{isLiked ? "❤️" : "🤍"}</span>
                        {p.likes}
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </FestivalSelectBg>
  );
}
