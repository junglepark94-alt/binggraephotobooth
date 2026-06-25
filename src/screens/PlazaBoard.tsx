import { useEffect, useState } from "react";
import { FestivalSelectBg } from "@/components/common";
import { type PlazaPost, listPostsFn } from "@/lib/plaza";

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

  const load = () => {
    setLoading(true);
    setError(null);
    listPostsFn()
      .then((list) => setPosts(list))
      .catch(() => {
        setError("게시물을 불러오지 못했어요. 잠시 후 다시 시도해주세요.");
        setPosts([]);
      })
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  return (
    <FestivalSelectBg onBack={onBack}>
      <div className="space-y-3 px-3 pb-10 pt-1">
        <h2 className="text-center font-display text-lg font-extrabold text-primary drop-shadow-sm">
          광장 게시판
        </h2>
        <p className="text-center text-sm text-muted-foreground">
          주민들이 자랑한 인생네컷을 구경해보세요!
        </p>

        <div className="flex justify-center">
          <button
            onClick={load}
            disabled={loading}
            className="rounded-full bg-white/85 px-4 py-1.5 text-xs font-bold text-primary shadow ring-1 ring-white transition active:scale-95 disabled:opacity-50"
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
            {posts.map((p) => {
              const active = p.id === highlightId;
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
                    className="block w-full select-none object-cover"
                  />
                  <div className="px-2 py-2">
                    <p className="truncate text-[13px] font-bold text-amber-900">{p.title}</p>
                    {p.author && (
                      <p className="mt-0.5 truncate text-[11px] font-semibold text-primary/90">
                        🏷️ {p.author}
                      </p>
                    )}
                    <p className="mt-0.5 text-[10px] text-muted-foreground">
                      {active && <span className="mr-1 font-bold text-primary">내 글 ·</span>}
                      {timeAgo(p.createdAt)}
                    </p>
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
