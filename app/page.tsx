"use client";

import { useEffect, useState } from "react";
import { WalletConnect } from "@/components/WalletConnect";
import { useWallet } from "@/components/WalletProvider";
import {
  createChain,
  getAllChains,
  getChain,
  CONTRACT_NOT_SET,
} from "@/lib/genlayerClient";
import type { StoryChain } from "@/lib/schemas";

export default function Home() {
  const { account, provider, wrongNetwork } = useWallet();

  const [chains, setChains] = useState<StoryChain[]>([]);
  const [loading, setLoading] = useState(true);
  const [title, setTitle] = useState("");
  const [premise, setPremise] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ kind: "ok" | "err" | "info"; text: string } | null>(null);

  const canWrite = !!account && !!provider && !wrongNetwork;

  async function refresh() {
    setLoading(true);
    try {
      const ids = await getAllChains();
      const loaded = (await Promise.all(ids.map(getChain))).filter(
        (c): c is StoryChain => c !== null,
      );
      setChains(loaded);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!CONTRACT_NOT_SET) refresh();
  }, []);

  async function handleCreate() {
    if (!account || !provider) {
      setMsg({ kind: "err", text: "Connect a wallet first." });
      return;
    }
    setBusy(true);
    setMsg({ kind: "info", text: "Submitting — waiting for AI validators to accept…" });
    const outcome = await createChain({ title, premise }, account, provider);
    setBusy(false);
    if (outcome.ok) {
      setMsg({
        kind: "ok",
        text: "Created.",
      });
      setTitle("");
      setPremise("");
      await refresh();
    } else {
      setMsg({ kind: "err", text: `Failed: ${outcome.detail}` });
    }
  }

  return (
    <main className="mx-auto max-w-2xl px-4 py-8">
      <header className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">StoryChain</h1>
          <p className="text-sm text-slate-500">
            Collaborative, AI-gated story chains on GenLayer
          </p>
        </div>
        <WalletConnect />
      </header>

      {CONTRACT_NOT_SET && (
        <p className="mb-6 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-800">
          <code className="font-mono">NEXT_PUBLIC_STORYCHAIN_IC_ADDRESS</code> is not
          set. Set it in <code className="font-mono">.env.local</code> after deploying
          the contract, then restart.
        </p>
      )}

      {wrongNetwork && (
        <p className="mb-6 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-800">
          Your wallet is on the wrong network. Switch to the{" "}
          <strong>Genlayer Studio Network</strong> to create chains and add
          sentences.
        </p>
      )}

      <section className="mb-8 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="mb-4 text-lg font-semibold">Start a new story chain</h2>
        <div className="space-y-3">
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Title</label>
            <input
              className="w-full rounded-lg border border-slate-300 px-3 py-2 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              value={title}
              maxLength={200}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="A short title"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">
              Premise (opening)
            </label>
            <textarea
              className="w-full rounded-lg border border-slate-300 px-3 py-2 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              rows={3}
              maxLength={1000}
              value={premise}
              onChange={(e) => setPremise(e.target.value)}
              placeholder="Set the scene…"
            />
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={handleCreate}
              disabled={busy || !canWrite}
              className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {busy ? "Creating…" : "Create chain"}
            </button>
            {!account && (
              <span className="text-xs text-slate-500">Connect a wallet to create</span>
            )}
          </div>
          {msg && (
            <p
              className={`text-sm ${
                msg.kind === "ok"
                  ? "text-emerald-700"
                  : msg.kind === "err"
                    ? "text-red-600"
                    : "text-slate-600"
              }`}
            >
              {msg.text}
            </p>
          )}
        </div>
      </section>

      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold">All chains</h2>
          <button
            onClick={refresh}
            className="text-sm font-medium text-indigo-600 hover:text-indigo-500"
          >
            ↻ Refresh
          </button>
        </div>
        {loading ? (
          <p className="py-6 text-center text-sm text-slate-400">Loading chains…</p>
        ) : chains.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-300 bg-white/50 p-8 text-center">
            <p className="text-sm text-slate-500">
              No chains yet. Start the first one above.
            </p>
          </div>
        ) : (
          <ul className="grid gap-3 sm:grid-cols-2">
            {chains.map((c) => (
              <li
                key={c.chain_id}
                className="group rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition hover:border-indigo-300 hover:shadow-md"
              >
                <a href={`/chain/${c.chain_id}`} className="block">
                  <h3 className="font-semibold text-slate-900 group-hover:text-indigo-600">
                    {c.title}
                  </h3>
                  <p className="mt-1 line-clamp-2 text-sm text-slate-600">{c.premise}</p>
                  <p className="mt-2 font-mono text-xs text-slate-400">{c.chain_id}</p>
                </a>
              </li>
            ))}
          </ul>
        )}
      </section>

      <footer className="mt-12 border-t border-slate-200 pt-4 text-center text-xs text-slate-400">
        StoryChain · Genlayer Studio Network
      </footer>
    </main>
  );
}
