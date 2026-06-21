"use client";

import { use, useEffect, useState } from "react";
import { WalletConnect } from "@/components/WalletConnect";
import {
  getChain,
  getStory,
  addSentence,
  CONTRACT_NOT_SET,
} from "@/lib/genlayerClient";
import type { EthereumProvider } from "@/lib/wallet";
import type { StoryChain, Sentence } from "@/lib/schemas";

export default function ChainPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);

  const [account, setAccount] = useState<`0x${string}` | null>(null);
  const [provider, setProvider] = useState<EthereumProvider | null>(null);

  const [chain, setChain] = useState<StoryChain | null>(null);
  const [story, setStory] = useState<Sentence[]>([]);
  const [sentence, setSentence] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function refresh() {
    setChain(await getChain(id));
    setStory(await getStory(id));
  }

  useEffect(() => {
    if (!CONTRACT_NOT_SET) refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  async function handleAdd() {
    if (!account || !provider) {
      setMsg("Connect a wallet first.");
      return;
    }
    setBusy(true);
    setMsg("Submitting — AI validators are checking coherence…");
    const outcome = await addSentence(id, sentence, account, provider);
    setBusy(false);
    if (outcome.ok) {
      setMsg(`Added. tx ${outcome.txHash.slice(0, 10)}…`);
      setSentence("");
      await refresh();
    } else if (outcome.reason === "rejected-by-AI") {
      setMsg("Rejected by AI consensus — write a sentence that fits the story.");
    } else {
      setMsg(`Failed: ${outcome.detail}`);
    }
  }

  return (
    <main className="mx-auto max-w-2xl px-4 py-8">
      <header className="mb-6 flex items-center justify-between">
        <a href="/" className="text-sm text-blue-600 hover:underline">
          ← All chains
        </a>
        <WalletConnect
          onConnect={(acc, prov) => {
            setAccount(acc);
            setProvider(prov);
          }}
        />
      </header>

      {chain ? (
        <>
          <h1 className="mb-1 text-2xl font-bold">{chain.title}</h1>
          <p className="mb-6 text-gray-700">{chain.premise}</p>
        </>
      ) : (
        <p className="mb-6 text-sm text-gray-500">Loading chain…</p>
      )}

      <section className="mb-8 space-y-3">
        {story.length === 0 ? (
          <p className="text-sm text-gray-500">No sentences yet — add the first one.</p>
        ) : (
          story.map((s, i) => (
            <p key={i} className="rounded border bg-white p-3">
              {s.text}
              <span className="mt-1 block font-mono text-xs text-gray-400">
                {s.author.slice(0, 6)}…{s.author.slice(-4)}
              </span>
            </p>
          ))
        )}
      </section>

      <section className="rounded border bg-white p-4">
        <h2 className="mb-3 text-lg font-semibold">Add a sentence</h2>
        <textarea
          className="mb-3 w-full rounded border px-3 py-2"
          rows={2}
          maxLength={500}
          value={sentence}
          onChange={(e) => setSentence(e.target.value)}
          placeholder="Continue the story…"
        />
        <button
          onClick={handleAdd}
          disabled={busy}
          className="rounded bg-black px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
        >
          {busy ? "Checking…" : "Submit sentence"}
        </button>
        {msg && <p className="mt-3 text-sm text-gray-700">{msg}</p>}
      </section>
    </main>
  );
}
