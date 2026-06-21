"use client";

import { useWallet } from "@/components/WalletProvider";
import { explorerAddressUrl, shortAddr } from "@/lib/wallet";

export function WalletConnect() {
  const {
    account,
    status,
    error,
    wrongNetwork,
    hasWallet,
    connect,
    disconnect,
    switchNetwork,
  } = useWallet();

  if (status === "connected" && account) {
    return (
      <div className="flex items-center gap-2">
        <span
          className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${
            wrongNetwork
              ? "bg-amber-100 text-amber-800"
              : "bg-emerald-100 text-emerald-800"
          }`}
        >
          <span
            className={`h-1.5 w-1.5 rounded-full ${
              wrongNetwork ? "bg-amber-500" : "bg-emerald-500"
            }`}
          />
          {wrongNetwork ? "Wrong network" : "Studio"}
        </span>
        <a
          href={explorerAddressUrl(account)}
          target="_blank"
          rel="noreferrer"
          className="rounded-full bg-gray-100 px-2.5 py-1 font-mono text-xs text-gray-700 hover:bg-gray-200"
          title="View on explorer"
        >
          {shortAddr(account)}
        </a>
        <button
          onClick={disconnect}
          className="rounded-full px-2 py-1 text-xs text-gray-400 hover:text-gray-700"
          title="Disconnect"
        >
          ✕
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        onClick={connect}
        disabled={status === "connecting"}
        className="rounded-lg bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-50"
      >
        {status === "connecting" ? "Connecting…" : "Connect wallet"}
      </button>
      {wrongNetwork && hasWallet && (
        <button
          onClick={switchNetwork}
          className="text-xs font-medium text-amber-700 underline hover:text-amber-900"
        >
          Switch to Studio network
        </button>
      )}
      {error && <span className="text-xs text-red-600">{error}</span>}
    </div>
  );
}
