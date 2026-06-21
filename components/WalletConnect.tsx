"use client";

import { useState } from "react";
import { getBrowserEthereumProvider, type EthereumProvider } from "@/lib/wallet";

export function WalletConnect({
  onConnect,
}: {
  onConnect: (account: `0x${string}`, provider: EthereumProvider) => void;
}) {
  const [addr, setAddr] = useState<`0x${string}` | null>(null);
  const [err, setErr] = useState<string | null>(null);

  async function connect() {
    setErr(null);
    const provider = getBrowserEthereumProvider();
    if (!provider) {
      setErr("No Ethereum wallet found. Install MetaMask or the GenLayer wallet.");
      return;
    }
    try {
      const accounts = (await provider.request({
        method: "eth_requestAccounts",
      })) as string[];
      if (!accounts?.length) {
        setErr("No account returned by wallet.");
        return;
      }
      const account = accounts[0] as `0x${string}`;
      setAddr(account);
      onConnect(account, provider);
    } catch (e) {
      setErr(String((e as Error)?.message ?? e));
    }
  }

  return (
    <div className="flex items-center gap-3">
      {addr ? (
        <span className="text-sm text-gray-600">
          Connected: {addr.slice(0, 6)}…{addr.slice(-4)}
        </span>
      ) : (
        <button
          onClick={connect}
          className="rounded bg-black px-3 py-1.5 text-sm font-medium text-white hover:bg-gray-800"
        >
          Connect wallet
        </button>
      )}
      {err && <span className="text-sm text-red-600">{err}</span>}
    </div>
  );
}
