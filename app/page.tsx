"use client";

import { useEffect, useState } from "react";
import { WalletConnect } from "@/components/WalletConnect";
import {
  createChain,
  getAllChains,
  getChain,
  CONTRACT_NOT_SET,
} from "@/lib/genlayerClient";
import type { EthereumProvider } from "@/lib/wallet";
import type { StoryChain } from "@/lib/schemas";

export default function Home() {
  const [account, setAccount] = useState<`0x${string}` | null>(null);
  const [provider, setProvider] = useState<EthereumProvider | null>(null);

  const [chains, setChains] = useState<StoryChain[]>([]);
  const [title, setTitle] = useState("");
  const [premise, setPremise] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function refresh() {
    const ids = await getAllChains();
    const loaded = (await Promise.all(ids.map(getChain))).filter(
      (c): c is StoryChain => c !== null,
    );
    setChains(loaded);
  }

  useEffect(() => {
    if (!CONTRACT_NOT_SET) refresh();
  }, []);

  async function handleCreate() {
    if (!account || !provider) {
      setMsg("Connect a wallet first.");
      return;
    }
    setBusy(true);
    setMsg(null);
    const outcome = await createChain({ title, premise }, account, provider);
    setBusy(false);
    if (outcome.ok) {
      setMsg(`Created. tx ${outcome.txHash.slice(0, 10)}…`);
      setTitle("");
      setPremise("");
      await refresh();
    } else {
      setMsg(`Failed: ${outcome.detail}`);
    }
  }

  return (
    <main className="mx-auto max-w-2xl px-4 py-8">
      <header className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold">StoryChain</h1>
        <WalletConnect
          onConnect={(acc, prov) => {
            setAccount(acc);
            setProvider(prov);
          }}
        />
      </header>

      {CONTRACT_NOT_SET && (
        <p className="mb-4 rounded border border-amber-300 bg-amber-50 p-3 text-sm text-amber-800">
          NEXT_PUBLIC_STORYCHAIN_IC_ADDRESS is not set. Set it in .env.local after
          deploying the contract, then restart.
        </p>
      )}

      <section className="mb-8 rounded border bg-white p-4">
        <h2 className="mb-3 text-lg font-semibold">Start a new story chain</h2>
        <label className="mb-1 block text-sm font-medium">Title</label>
        <input
          className="mb-3 w-full rounded border px-3 py-2"
          value={title}
          maxLength={200}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="A short title"
        />
        <label className="mb-1 block text-sm font-medium">Premise (opening)</label>
        <textarea
          className="mb-3 w-full rounded border px-3 py-2"
          rows={3}
          maxLength={1000}
          value={premise}
          onChange={(e) => setPremise(e.target.value)}
          placeholder="Set the scene…"
        />
        <button
          onClick={handleCreate}
          disabled={busy}
          className="rounded bg-black px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
        >
          {busy ? "Creating…" : "Create chain"}
        </button>
        {msg && <p className="mt-3 text-sm text-gray-700">{msg}</p>}
      </section>

      <section>
        <h2 className="mb-3 text-lg font-semibold">All chains</h2>
        <button
          onClick={refresh}
          className="mb-3 text-sm text-blue-600 underline"
        >
          Refresh
        </button>
        {chains.length === 0 ? (
          <p className="text-sm text-gray-500">No chains yet.</p>
        ) : (
          <ul className="space-y-2">
            {chains.map((c) => (
              <li key={c.chain_id} className="rounded border bg-white p-3">
                <a
                  href={`/chain/${c.chain_id}`}
                  className="font-medium text-blue-600 hover:underline"
                >
                  {c.title}
                </a>
                <p className="mt-1 text-sm text-gray-600 line-clamp-2">{c.premise}</p>
                <p className="mt-1 font-mono text-xs text-gray-400">{c.chain_id}</p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
