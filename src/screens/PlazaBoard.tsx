import { useEffect, useRef, useState } from "react";
import { FestivalSelectBg } from "@/components/common";
import { type PlazaPost, type SortKey, likePostFn, listPostsFn } from "@/lib/plaza";
import { timeAgo } from "@/lib/time";

const PAGE = 60; // 한 번에 불러오는 게시물 수

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

// 광장 게시판 (주민 자랑 피드) — 60장씩 무한 스크롤, 최신순/좋아요순 서버 정렬.
export function PlazaBoard({
  onBack,
  highlightId,
}: {
  onBack: () => void;
  highlightId?: string | null;
}) {
  const [posts, setPosts] = useState<PlazaPost[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true); // 초기/정렬 변경 로딩
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sort, setSort] = useState<SortKey>("new");
  const [liked, setLiked] = useState<Set<string>>(new Set());

  const likingRef = useRef<Set<string>>(new Set()); // 처리 중인 좋아요(더블클릭 방지)
  const loadingRef = useRef(false); // 동시 로딩 방지
  const sentinelRef = useRef<HTMLDivElement>(null);
  // 최신 상태를 콜백(옵저버)에서 읽기 위한 ref
  const stateRef = useRef({
    len: 0,
    total: 0,
    sort: "new" as SortKey,
    loading: true,
    loadingMore: false,
  });
  stateRef.current = { len: posts.length, total, sort, loading, loadingMore };

  const loadPage = async (reset: boolean) => {
    if (loadingRef.current) return;
    const sortNow = stateRef.current.sort;
    const offset = reset ? 0 : stateRef.current.len;
    loadingRef.current = true;
    if (reset) {
      setLoading(true);
      setPosts([]);
    } else {
      setLoadingMore(true);
    }
    setError(null);
    try {
      const res = await listPostsFn({ data: { offset, limit: PAGE, sort: sortNow } });
      // 로딩 중 정렬이 바뀌었으면 낡은 응답은 버린다 (아래에서 새 정렬로 다시 로드).
      if (stateRef.current.sort === sortNow) {
        setTotal(res.total);
        if (reset) {
          setPosts(res.posts);
        } else {
          setPosts((prev) => {
            const seen = new Set(prev.map((p) => p.id));
            return [...prev, ...res.posts.filter((p) => !seen.has(p.id))];
          });
        }
      }
    } catch {
      setError("게시물을 불러오지 못했어요. 잠시 후 다시 시도해주세요.");
    } finally {
      loadingRef.current = false;
      setLoading(false);
      setLoadingMore(false);
    }
    // 진행 중이던 요청 때문에 드랍됐던 정렬 변경을 이어서 처리.
    if (stateRef.current.sort !== sortNow) loadPage(true);
  };

  // 디바이스의 좋아요 표시 로드(1회)
  useEffect(() => {
    setLiked(loadLiked());
  }, []);

  // 마운트 + 정렬 변경 시 첫 페이지부터 다시 로드
  useEffect(() => {
    loadPage(true);
  }, [sort]);

  // 바닥 근처에 닿으면 다음 페이지 로드 (무한 스크롤)
  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (!entries[0].isIntersecting) return;
        const s = stateRef.current;
        if (!s.loading && !s.loadingMore && s.len < s.total) loadPage(false);
      },
      { rootMargin: "400px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  // 좋아요 토글 — 낙관적 업데이트 후 서버 누적 수로 보정.
  const toggleLike = async (id: string) => {
    if (likingRef.current.has(id)) return;
    likingRef.current.add(id);
    const willLike = !liked.has(id);
    setLiked((prev) => {
      const n = new Set(prev);
      if (willLike) n.add(id);
      else n.delete(id);
      saveLiked(n);
      return n;
    });
    setPosts((prev) =>
      prev.map((p) =>
        p.id === id ? { ...p, likes: Math.max(0, p.likes + (willLike ? 1 : -1)) } : p,
      ),
    );
    try {
      const res = await likePostFn({ data: { id, like: willLike } });
      setPosts((prev) => prev.map((p) => (p.id === id ? { ...p, likes: res.likes } : p)));
    } catch {
      setLiked((prev) => {
        const n = new Set(prev);
        if (willLike) n.delete(id);
        else n.add(id);
        saveLiked(n);
        return n;
      });
      setPosts((prev) =>
        prev.map((p) =>
          p.id === id ? { ...p, likes: Math.max(0, p.likes + (willLike ? -1 : 1)) } : p,
        ),
      );
    } finally {
      likingRef.current.delete(id);
    }
  };

  const hasMore = posts.length < total;

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
            onClick={() => loadPage(true)}
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

        {loading && posts.length === 0 ? (
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
          <>
            <div className="grid grid-cols-2 items-start gap-3">
              {posts.map((p) => {
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

            {/* 추가 로딩 인디케이터 */}
            {loadingMore && (
              <div className="flex justify-center py-3">
                <div className="h-6 w-6 animate-spin rounded-full border-3 border-primary border-t-transparent" />
              </div>
            )}
            {!hasMore && (
              <p className="py-2 text-center text-[11px] text-muted-foreground">
                마지막 게시물이에요 · 총 {total}장
              </p>
            )}
          </>
        )}

        {/* 무한 스크롤 감지용 센티넬 */}
        <div ref={sentinelRef} className="h-1 w-full" />
      </div>
    </FestivalSelectBg>
  );
}
