import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { type PlazaPost, adminListFn, adminLoginFn, clearPostsFn, deletePostFn } from "@/lib/plaza";
import { timeAgo } from "@/lib/time";

const PAGE = 60;

export const Route = createFileRoute("/admin")({
  component: AdminPage,
  head: () => ({
    meta: [{ title: "광장 게시판 관리자 — 빙그레 네컷" }],
  }),
});

function AdminPage() {
  const [pw, setPw] = useState("");
  const [authed, setAuthed] = useState(false);
  const [posts, setPosts] = useState<PlazaPost[]>([]);
  const [total, setTotal] = useState(0);
  const [busy, setBusy] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  const login = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await adminLoginFn({ data: { password: pw } });
      setAuthed(true);
      setPosts(res.posts);
      setTotal(res.total);
    } catch {
      setError("비밀번호가 올바르지 않습니다.");
    } finally {
      setBusy(false);
    }
  };

  const refresh = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await adminLoginFn({ data: { password: pw } });
      setPosts(res.posts);
      setTotal(res.total);
    } catch {
      setError("목록을 불러오지 못했습니다.");
    } finally {
      setBusy(false);
    }
  };

  const loadMore = async () => {
    setLoadingMore(true);
    setError(null);
    try {
      const res = await adminListFn({ data: { password: pw, offset: posts.length, limit: PAGE } });
      setTotal(res.total);
      setPosts((prev) => {
        const seen = new Set(prev.map((p) => p.id));
        return [...prev, ...res.posts.filter((p) => !seen.has(p.id))];
      });
    } catch {
      setError("더 불러오지 못했습니다.");
    } finally {
      setLoadingMore(false);
    }
  };

  const remove = async (id: string) => {
    if (!confirm("이 게시물을 삭제할까요?")) return;
    setBusy(true);
    setError(null);
    try {
      await deletePostFn({ data: { password: pw, id } });
      setPosts((a) => a.filter((p) => p.id !== id));
      setTotal((t) => Math.max(0, t - 1));
      setMsg("게시물을 삭제했습니다.");
    } catch {
      setError("삭제하지 못했습니다.");
    } finally {
      setBusy(false);
    }
  };

  const clearAll = async () => {
    if (!confirm("게시판의 모든 게시물을 삭제할까요? 되돌릴 수 없습니다.")) return;
    setBusy(true);
    setError(null);
    try {
      await clearPostsFn({ data: { password: pw } });
      setPosts([]);
      setTotal(0);
      setMsg("모든 게시물을 삭제했습니다.");
    } catch {
      setError("전체 삭제에 실패했습니다.");
    } finally {
      setBusy(false);
    }
  };

  if (!authed) {
    return (
      <div className="flex min-h-[100dvh] items-center justify-center bg-slate-100 px-4">
        <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-lg ring-1 ring-slate-200">
          <h1 className="text-center text-lg font-extrabold text-slate-800">광장 게시판 관리자</h1>
          <p className="mt-1 text-center text-xs text-slate-500">비밀번호를 입력하세요.</p>
          <input
            type="password"
            value={pw}
            onChange={(e) => setPw(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && pw && !busy && login()}
            placeholder="비밀번호"
            autoFocus
            className="mt-4 w-full rounded-xl border-2 border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-slate-400"
          />
          {error && <p className="mt-2 text-center text-xs text-red-600">{error}</p>}
          <button
            onClick={login}
            disabled={!pw || busy}
            className="mt-4 w-full rounded-xl bg-slate-800 px-4 py-2.5 text-sm font-bold text-white transition active:scale-95 disabled:opacity-50"
          >
            {busy ? "확인 중…" : "들어가기"}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[100dvh] bg-slate-100 px-4 py-6">
      <div className="mx-auto w-full max-w-2xl">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h1 className="text-lg font-extrabold text-slate-800">
            광장 게시판 관리자
            <span className="ml-2 text-sm font-medium text-slate-500">
              ({posts.length}/{total})
            </span>
          </h1>
          <div className="flex gap-2">
            <button
              onClick={() => {
                setAuthed(false);
                setPw("");
                setPosts([]);
                setMsg(null);
                setError(null);
              }}
              className="rounded-lg bg-white px-3 py-1.5 text-xs font-bold text-slate-700 shadow ring-1 ring-slate-200 transition active:scale-95"
            >
              로그아웃
            </button>
            <button
              onClick={refresh}
              disabled={busy}
              className="rounded-lg bg-white px-3 py-1.5 text-xs font-bold text-slate-700 shadow ring-1 ring-slate-200 transition active:scale-95 disabled:opacity-50"
            >
              새로고침
            </button>
            <button
              onClick={clearAll}
              disabled={busy || posts.length === 0}
              className="rounded-lg bg-red-600 px-3 py-1.5 text-xs font-bold text-white shadow transition active:scale-95 disabled:opacity-50"
            >
              전체 삭제
            </button>
          </div>
        </div>

        {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
        {msg && <p className="mt-3 text-sm text-emerald-600">{msg}</p>}

        {posts.length === 0 ? (
          <div className="mt-6 rounded-2xl bg-white p-10 text-center text-sm text-slate-500 ring-1 ring-slate-200">
            게시물이 없습니다.
          </div>
        ) : (
          <>
            <ul className="mt-4 space-y-3">
              {posts.map((p) => (
                <li
                  key={p.id}
                  className="flex items-center gap-3 rounded-2xl bg-white p-3 shadow ring-1 ring-slate-200"
                >
                  <img
                    src={p.image}
                    alt={p.title}
                    loading="lazy"
                    decoding="async"
                    className="h-20 w-16 shrink-0 rounded-lg object-cover ring-1 ring-slate-200"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-bold text-slate-800">{p.title}</p>
                    {p.author && <p className="truncate text-xs text-slate-500">🏷️ {p.author}</p>}
                    <p className="mt-0.5 text-[11px] text-slate-400">
                      {timeAgo(p.createdAt)} · ❤️{p.likes ?? 0} · {p.frame || "?"} · {p.id}
                    </p>
                  </div>
                  <button
                    onClick={() => remove(p.id)}
                    disabled={busy}
                    className="shrink-0 rounded-lg bg-red-50 px-3 py-1.5 text-xs font-bold text-red-600 ring-1 ring-red-200 transition active:scale-95 disabled:opacity-50"
                  >
                    삭제
                  </button>
                </li>
              ))}
            </ul>
            {posts.length < total && (
              <div className="mt-4 flex justify-center">
                <button
                  onClick={loadMore}
                  disabled={loadingMore}
                  className="rounded-lg bg-white px-5 py-2 text-sm font-bold text-slate-700 shadow ring-1 ring-slate-200 transition active:scale-95 disabled:opacity-50"
                >
                  {loadingMore ? "불러오는 중…" : `더 보기 (${total - posts.length}개 남음)`}
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
