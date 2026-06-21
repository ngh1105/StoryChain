import { createClient } from "genlayer-js";
import { testnetBradbury } from "genlayer-js/chains";

export const GENLAYER_NETWORK = testnetBradbury;

// ---- Bradbury chain metadata for injected-wallet switching ----
// chainId 4221 == 0x107d. Used by WalletProvider to detect/switch the
// user's EVM wallet onto the right network before writes.
export const BRADBURY_CHAIN_ID_DEC = 4221;
export const BRADBURY_CHAIN_ID_HEX = "0x107d";
export const BRADBURY_CHAIN_PARAMS = {
  chainId: BRADBURY_CHAIN_ID_HEX,
  chainName: "Genlayer Bradbury Testnet",
  nativeCurrency: { name: "GEN", symbol: "GEN", decimals: 18 },
  rpcUrls: ["https://rpc-bradbury.genlayer.com"],
  blockExplorerUrls: ["https://explorer-bradbury.genlayer.com/"],
} as const;

export const BRADBURY_EXPLORER = "https://explorer-bradbury.genlayer.com";

export function explorerAddressUrl(addr: string): string {
  return `${BRADBURY_EXPLORER}/address/${addr}`;
}
export function explorerTxUrl(txHash: string): string {
  return `${BRADBURY_EXPLORER}/tx/${txHash}`;
}
export function shortAddr(addr: string | null | undefined): string {
  if (!addr) return "";
  return addr.length <= 12 ? addr : `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

export type EthereumProvider = {
  request: (
    args: { method: string; params?: unknown[] | Record<string, unknown> },
  ) => Promise<unknown>;
  on?: (event: string, listener: (...args: unknown[]) => void) => void;
  removeListener?: (event: string, listener: (...args: unknown[]) => void) => void;
};

/** Returns window.ethereum if it looks like an EIP-1193 provider, else null. */
export function getBrowserEthereumProvider(): EthereumProvider | null {
  if (typeof window === "undefined") return null;
  const maybe = (window as typeof window & { ethereum?: unknown }).ethereum;
  if (maybe && typeof (maybe as EthereumProvider).request === "function") {
    return maybe as EthereumProvider;
  }
  return null;
}

/** Wallet-bound client; required for writeContract (create_chain, add_sentence). */
export function createWriteClient(account: `0x${string}`, provider: EthereumProvider) {
  return createClient({ chain: GENLAYER_NETWORK, provider, account });
}

/** Read-only client; sufficient for readContract (get_chain, get_story, get_all_chains). */
export function createReadClient() {
  return createClient({ chain: GENLAYER_NETWORK });
}

export type WriteClient = ReturnType<typeof createWriteClient>;
export type ReadClient = ReturnType<typeof createReadClient>;
