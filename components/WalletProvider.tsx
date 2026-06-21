"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  BRADBURY_CHAIN_ID_HEX,
  BRADBURY_CHAIN_PARAMS,
  getBrowserEthereumProvider,
  type EthereumProvider,
} from "@/lib/wallet";

type Status = "disconnected" | "connecting" | "connected" | "error";

type WalletContextValue = {
  account: `0x${string}` | null;
  provider: EthereumProvider | null;
  chainId: string | null;
  status: Status;
  error: string | null;
  /** true when a wallet is connected but not on the Bradbury chain */
  wrongNetwork: boolean;
  hasWallet: boolean;
  connect: () => Promise<void>;
  disconnect: () => void;
  switchNetwork: () => Promise<void>;
};

const WalletContext = createContext<WalletContextValue | null>(null);

export function WalletProvider({ children }: { children: React.ReactNode }) {
  const [provider, setProvider] = useState<EthereumProvider | null>(null);
  const [account, setAccount] = useState<`0x${string}` | null>(null);
  const [chainId, setChainId] = useState<string | null>(null);
  const [status, setStatus] = useState<Status>("disconnected");
  const [error, setError] = useState<string | null>(null);

  // On mount: detect an injected provider and auto-reconnect if already permitted.
  useEffect(() => {
    const p = getBrowserEthereumProvider();
    if (!p) return;
    setProvider(p);

    let cancelled = false;
    (async () => {
      try {
        const accounts = (await p.request({ method: "eth_accounts" })) as string[];
        if (cancelled || !accounts?.length) return;
        const cid = (await p.request({ method: "eth_chainId" })) as string;
        if (cancelled) return;
        setAccount(accounts[0] as `0x${string}`);
        setChainId(cid);
        setStatus("connected");
      } catch {
        /* user has not granted permission yet — leave disconnected */
      }
    })();

    const onAccounts = (accounts: unknown) => {
      const list = accounts as string[];
      if (!list?.length) {
        setAccount(null);
        setStatus("disconnected");
      } else {
        setAccount(list[0] as `0x${string}`);
        setStatus("connected");
      }
    };
    const onChain = (cid: unknown) => setChainId(cid as string);

    p.on?.("accountsChanged", onAccounts);
    p.on?.("chainChanged", onChain);
    return () => {
      cancelled = true;
      p.removeListener?.("accountsChanged", onAccounts);
      p.removeListener?.("chainChanged", onChain);
    };
  }, []);

  const switchNetwork = useCallback(async () => {
    if (!provider) return;
    try {
      await provider.request({
        method: "wallet_switchEthereumChain",
        params: [{ chainId: BRADBURY_CHAIN_ID_HEX }],
      });
      setError(null);
    } catch (e) {
      const code = (e as { code?: number })?.code;
      // 4902 = chain not added to wallet → add it, then it switches.
      if (code === 4902 || code === -32603) {
        try {
          await provider.request({
            method: "wallet_addEthereumChain",
            params: [BRADBURY_CHAIN_PARAMS],
          });
          setError(null);
        } catch (e2) {
          setError(String((e2 as Error)?.message ?? e2));
        }
      } else {
        setError(String((e as Error)?.message ?? e));
      }
    }
  }, [provider]);

  const connect = useCallback(async () => {
    let p = provider;
    if (!p) {
      p = getBrowserEthereumProvider();
      if (!p) {
        setError("No Ethereum wallet found. Install MetaMask or the GenLayer wallet.");
        setStatus("error");
        return;
      }
      setProvider(p);
    }
    setStatus("connecting");
    setError(null);
    try {
      const accounts = (await p.request({ method: "eth_requestAccounts" })) as string[];
      if (!accounts?.length) {
        setStatus("disconnected");
        return;
      }
      const cid = (await p.request({ method: "eth_chainId" })) as string;
      setAccount(accounts[0] as `0x${string}`);
      setChainId(cid);
      setStatus("connected");
    } catch (e) {
      setStatus("error");
      setError(String((e as Error)?.message ?? e));
    }
  }, [provider]);

  const disconnect = useCallback(() => {
    // Injected wallets can't be programmatically disconnected; we just drop
    // our local session. The user can reconnect any time.
    setAccount(null);
    setStatus("disconnected");
    setError(null);
  }, []);

  const value = useMemo<WalletContextValue>(() => {
    const wrong =
      status === "connected" &&
      typeof chainId === "string" &&
      chainId.toLowerCase() !== BRADBURY_CHAIN_ID_HEX;
    return {
      account,
      provider,
      chainId,
      status,
      error,
      wrongNetwork: wrong,
      hasWallet: provider !== null,
      connect,
      disconnect,
      switchNetwork,
    };
  }, [account, provider, chainId, status, error, connect, disconnect, switchNetwork]);

  return <WalletContext.Provider value={value}>{children}</WalletContext.Provider>;
}

export function useWallet(): WalletContextValue {
  const ctx = useContext(WalletContext);
  if (!ctx) throw new Error("useWallet must be used inside <WalletProvider>");
  return ctx;
}
