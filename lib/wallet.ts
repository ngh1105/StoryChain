import { createClient } from "genlayer-js";
import { testnetBradbury } from "genlayer-js/chains";

export const GENLAYER_NETWORK = testnetBradbury;

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
