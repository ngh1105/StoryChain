"use client";

import { use, useEffect, useState } from "react";
import { WalletConnect } from "@/components/WalletConnect";
import { useWallet } from "@/components/WalletProvider";
import {
  getChain,
  getStory,
  addSentence,
  CONTRACT_NOT_SET,
} from "@/lib/genlayerClient";
import { explorerAddressUrl, explorerTxUrl, shortAddr } from "@/lib/wallet";
import type { StoryChain, Sentence } from "@/lib/schemas";

export default function ChainPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const { account, provider, wrongNetwork } = useWallet();

  const [chain, setChain] = useState<StoryChain | null>(null);
  const [story, setStory] = useState<Sentence[]>([]);
  const [loading, setLoading] = useState(true);
  const [sentence, setSentence] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ kind: "ok" | "err" | "info"; text: string; tx?: string } | null>(null);

  const canWrite = !!account && !!provider && !wrongNetwork;

  async function refresh() {
    setLoading(true);
    try {
      const [c, s] = await Promise.all([getChain(id), getStory(id)]);
      setChain(c);
      setStory(s);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!CONTRACT_NOT_SET) refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  async function handleAdd() {
    if (!account || !provider) {
      setMsg({ kind: "err", text: "Connect a wallet first." });
      return;
    }
    setBusy(true);
    setMsg({
      kind: "info",
      text: "Submitting — AI validators are checking coherence (this takes a moment on Studio)…",
    });
    const outcome = await addSentence(id, sentence, account, provider);
    setBusy(false);
    if (outcome.ok) {
      setMsg({ kind: "ok", text: "Added.", tx: outcome.txHash });
      setSentence("");
      await refresh();
    } else if (outcome.reason === "rejected-by-AI") {
      setMsg({
        kind: "err",
        text: "Rejected by AI consensus — write a sentence that fits the story.",
      });
    } else {
      setMsg({ kind: "err", text: `Failed: ${outcome.detail}` });
    }
  }

  return (
    <main className="mx-auto max-w-2xl px-4 py-8">
      <header className="mb-6 flex items-center justify-between">
        <a href="/" className="text-sm font-medium text-indigo-600 hover:text-indigo-500">
          ← All chains
        </a>
        <WalletConnect />
      </header>

      {wrongNetwork && (
        <p className="mb-6 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-800">
          Switch your wallet to the <strong>GenLayer Studio Network</strong> to add
          sentences.
        </p>
      )}

      {loading ? (
        <p className="mb-6 text-sm text-slate-400">Loading chain…</p>
      ) : chain ? (
        <>
          <h1 className="mb-1 text-2xl font-bold tracking-tight">{chain.title}</h1>
          <p className="mb-6 text-slate-700">{chain.premise}</p>
          <p className="mb-6 font-mono text-xs text-slate-400">{chain.chain_id}</p>
        </>
      ) : (
        <p className="mb-6 text-sm text-slate-500">Chain not found.</p>
      )}

      <section className="prose-story mb-8 space-y-3">
        {story.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-300 bg-white/50 p-6 text-center">
            <p className="text-sm text-slate-500">
              No sentences yet — add the first one.
            </p>
          </div>
        ) : (
          story.map((s, i) => (
            <p
              key={i}
              className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
            >
              {s.text}
              <a
                href={explorerAddressUrl(s.author)}
                target="_blank"
                rel="noreferrer"
                className="mt-2 block font-mono text-xs text-slate-400 hover:text-slate-600"
                title="View author on explorer"
              >
                {shortAddr(s.author)}
              </a>
            </p>
          ))
        )}
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="mb-3 text-lg font-semibold">Add a sentence</h2>
        <div className="space-y-3">
          <textarea
            className="w-full rounded-lg border border-slate-300 px-3 py-2 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            rows={2}
            maxLength={500}
            value={sentence}
            onChange={(e) => setSentence(e.target.value)}
            placeholder="Continue the story…"
          />
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-400">{sentence.length}/500</span>
            <button
              onClick={handleAdd}
              disabled={busy || !canWrite}
              className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {busy ? "Checking…" : "Submit sentence"}
            </button>
          </div>
          {!account && (
            <p className="text-xs text-slate-500">Connect a wallet to submit</p>
          )}
          {msg && (
            <div
              className={`text-sm ${
                msg.kind === "ok"
                  ? "text-emerald-700"
                  : msg.kind === "err"
                    ? "text-red-600"
                    : "text-slate-600"
              }`}
            >
              {msg.text}
              {msg.tx && (
                <>
                  {" "}
                  <a
                    href={explorerTxUrl(msg.tx)}
                    target="_blank"
                    rel="noreferrer"
                    className="font-medium text-indigo-600 hover:underline"
                  >
                    View tx ↗
                  </a>
                </>
              )}
            </div>
          )}
        </div>
      </section>
    </main>
  );
}
