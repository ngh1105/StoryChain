import {
  createReadClient,
  createWriteClient,
  type EthereumProvider,
} from "./wallet";
import {
  CreateChainRequestSchema,
  type CreateChainRequest,
  type StoryChain,
  type Sentence,
} from "./schemas";

const ZERO = "0x0000000000000000000000000000000000000000";
const CONTRACT_ADDRESS =
  (process.env.NEXT_PUBLIC_STORYCHAIN_IC_ADDRESS as `0x${string}`) ?? (ZERO as `0x${string}`);

export const CONTRACT_NOT_SET = CONTRACT_ADDRESS === ZERO;

// Finalized tx result names that mean the write succeeded.
const SUCCESS_RESULT_NAMES = new Set([
  "FINISHED_WITH_RETURN",
  "FINALIZED_WITH_RETURN",
  "Successful",
]);

async function initRead() {
  const c = createReadClient();
  await c.initializeConsensusSmartContract();
  return c;
}

async function initWrite(account: `0x${string}`, provider: EthereumProvider) {
  const c = createWriteClient(account, provider);
  await c.initializeConsensusSmartContract();
  return c;
}

export type TxOutcome =
  | { ok: true; txHash: string }
  | { ok: false; reason: "rejected-by-AI" | "error"; detail: string };

/** Create a new story chain. Returns the tx hash on success. */
export async function createChain(
  input: CreateChainRequest,
  account: `0x${string}`,
  provider: EthereumProvider,
): Promise<TxOutcome> {
  const validated = CreateChainRequestSchema.parse(input);
  try {
    const client = await initWrite(account, provider);
    const payload = { ...validated, created_at: new Date().toISOString() };
    const txHash = (await client.writeContract({
      address: CONTRACT_ADDRESS,
      functionName: "create_chain",
      args: [JSON.stringify(payload)],
      value: 0n,
    })) as string;
    return { ok: true, txHash };
  } catch (e) {
    return { ok: false, reason: "error", detail: String((e as Error)?.message ?? e) };
  }
}

/**
 * Append a sentence. Writes, then waits for FINALIZED and inspects
 * txExecutionResultName so we can tell the user when AI consensus rejected it.
 */
export async function addSentence(
  chainId: string,
  sentence: string,
  account: `0x${string}`,
  provider: EthereumProvider,
): Promise<TxOutcome> {
  let txHash: string;
  try {
    const client = await initWrite(account, provider);
    txHash = (await client.writeContract({
      address: CONTRACT_ADDRESS,
      functionName: "add_sentence",
      args: [chainId, sentence],
      value: 0n,
    })) as string;
  } catch (e) {
    return { ok: false, reason: "error", detail: String((e as Error)?.message ?? e) };
  }

  try {
    const read = await initRead();
    const receipt = (await read.waitForTransactionReceipt({
      hash: txHash,
      status: "FINALIZED",
    } as unknown as Parameters<typeof read.waitForTransactionReceipt>[0])) as {
      txExecutionResultName?: string;
    };
    const name = receipt?.txExecutionResultName;
    if (typeof name === "string" && !SUCCESS_RESULT_NAMES.has(name)) {
      return { ok: false, reason: "rejected-by-AI", detail: name };
    }
    return { ok: true, txHash };
  } catch (e) {
    return { ok: false, reason: "error", detail: String((e as Error)?.message ?? e) };
  }
}

/** Chain metadata, or null if not found. */
export async function getChain(chainId: string): Promise<StoryChain | null> {
  if (!chainId) return null;
  try {
    const client = await initRead();
    const r = (await client.readContract({
      address: CONTRACT_ADDRESS,
      functionName: "get_chain",
      args: [chainId],
    })) as Record<string, unknown> | null;
    if (!r || (typeof r === "object" && Object.keys(r).length === 0)) return null;
    const o = r as Record<string, unknown>;
    return {
      chain_id: String(o.chain_id ?? chainId),
      title: String(o.title ?? ""),
      premise: String(o.premise ?? ""),
      created_by: String(o.created_by ?? ""),
      created_at: String(o.created_at ?? ""),
    };
  } catch (e) {
    console.error("getChain:", e);
    return null;
  }
}

/** Ordered list of sentences in a chain (oldest first). */
export async function getStory(chainId: string): Promise<Sentence[]> {
  if (!chainId) return [];
  try {
    const client = await initRead();
    const r = await client.readContract({
      address: CONTRACT_ADDRESS,
      functionName: "get_story",
      args: [chainId],
    });
    if (!Array.isArray(r)) return [];
    return r.map((s) => {
      const o = (s ?? {}) as Record<string, unknown>;
      return {
        text: String(o.text ?? ""),
        author: String(o.author ?? ""),
        created_at: String(o.created_at ?? ""),
      };
    });
  } catch (e) {
    console.error("getStory:", e);
    return [];
  }
}

/** All known chain ids. */
export async function getAllChains(): Promise<string[]> {
  try {
    const client = await initRead();
    const r = await client.readContract({
      address: CONTRACT_ADDRESS,
      functionName: "get_all_chains",
      args: [],
    });
    if (Array.isArray(r)) return r.filter((x): x is string => typeof x === "string");
    return [];
  } catch (e) {
    console.error("getAllChains:", e);
    return [];
  }
}
