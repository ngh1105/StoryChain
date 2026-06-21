# StoryChain Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build StoryChain — a GenLayer intelligent contract that lets anyone create story chains and append sentences, where each new sentence must pass an LLM consensus (equivalence principle) coherence check before it is stored.

**Architecture:** A Python intelligent contract (`story_chain_ic.py`) runs on GenLayer Studio and exposes write/view methods. A Next.js 15 (App Router) frontend talks to it via `genlayer-js` over the `studionet` chain. Writes that fail the AI coherence check revert on-chain; the frontend waits for finalization and surfaces "rejected by AI consensus" to the user.

**Tech Stack:** Python + py-genlayer (intelligent contract), Next.js 15 + React 19 + Tailwind 3 (frontend), `genlayer-js` ^1.1.8 (SDK), `zod` (validation), TypeScript.

## Global Constraints

These apply to every task. Exact values are copied from the approved spec and the verified repo patterns.

- **Contract language:** Python, py-genlayer. Header comment MUST be `# { "Depends": "py-genlayer:test" }` on line 1 (matches `GenLayer-Grant-Judge/contracts/bounty_task_ic.py:1`).
- **Contract namespace:** `from genlayer import *` and use the `gl` namespace. Do not import genlayer names individually.
- **Storage dataclasses:** decorated `@allow_storage` then `@dataclass`. Fields use py-genlayer types (`str`, `Address`, `u256`, `u8`), not built-in `int`.
- **Collections:** `TreeMap[K, V]` and `DynArray[T]`. They are auto-initialized; get-or-create a list with `self.<field>.get_or_insert_default(key)` (see `bounty_task_ic.py:126`).
- **Public methods:** write methods `@gl.public.write`, read methods `@gl.public.view`. Write inputs arrive as JSON strings; the frontend `JSON.stringify`s before calling.
- **Sender address:** `gl.message.sender_address` (type `Address`). When returning to the frontend, coerce with `str(...)`.
- **AI call shape:** `gl.eq_principle.prompt_non_comparative(judge_fn, task=..., criteria=...)` where `judge_fn` calls `gl.nondet.exec_prompt(prompt)` and returns a string (see `bounty_task_ic.py:459-489`).
- **Reverting a write:** `raise Exception(...)` — GenLayer treats an uncaught exception as a transaction revert.
- **genlayer-js write:** `await client.writeContract({ address, functionName, args: [...], value: 0n })` returns the tx hash string. ALWAYS `await client.initializeConsensusSmartContract()` once on each fresh client before any call (see `genlayerClient.ts:62`).
- **genlayer-js read:** `await client.readContract({ address, functionName, args: [...] })`. Wrap in try/catch and return `null`/`[]` on error (see `genlayerClient.ts:83-137`).
- **Revert detection:** wait with `{ hash, status: "FINALIZED" }`; inspect `receipt.txExecutionResultName`. Success set = `{"FINISHED_WITH_RETURN", "FINALIZED_WITH_RETURN", "Successful"}` (see `ConsentVault/lib/genlayer/genlayer-trial-engine.ts:150-155`). Anything else = reverted (AI rejected the sentence).
- **Contract address env var:** `NEXT_PUBLIC_STORYCHAIN_IC_ADDRESS` (hex `0x...`). If unset, warn and disable writes.
- **Versions (pin these exactly):** `next` ^15.3.3, `react` ^19.1.0, `react-dom` ^19.1.0, `genlayer-js` ^1.1.8, `zod` ^3.23.8; dev: `typescript` ^5.8.3, `tailwindcss` ^3.4.17, `postcss` ^8.5.3, `autoprefixer` ^10.4.21, `eslint` ^9.27.0, `eslint-config-next` ^15.3.3, `@types/node` ^22.15.21, `@types/react` ^19.1.6, `@types/react-dom` ^19.1.5.
- **Path alias:** `@/*` -> `./*` (matches `GenLayer-Grant-Judge/tsconfig.json`).
- **Testing:** manual verification only (spec §7/§8, YAGNI — user-approved). Each task's verification step is a concrete command + expected output, not a unit test. There is no test runner in this project. Do not add pytest/vitest/playwright.
- **Scope (NOT in this plan):** tips/rewards, participant lists, turn-taking, manual moderation, AI suggestions, leaderboards, CI.

---

## File Structure

```
E:\StoryChain\
├─ contracts/
│  └─ story_chain_ic.py        # intelligent contract (Task 5)
├─ app/
│  ├─ layout.tsx               # root layout (Task 6)
│  ├─ globals.css              # tailwind directives (Task 6)
│  ├─ page.tsx                 # list chains + create form (Task 7)
│  └─ chain/[id]/page.tsx      # read story + add sentence (Task 8)
├─ components/
│  └─ WalletConnect.tsx        # connect via window.ethereum (Task 6)
├─ lib/
│  ├─ schemas.ts               # Zod schemas + types (Task 2)
│  ├─ wallet.ts                # genlayer-js client factories + eth provider (Task 3)
│  └─ genlayerClient.ts        # contract wrapper: createChain/addSentence/reads (Task 4)
├─ package.json                # (Task 1)
├─ tsconfig.json               # (Task 1)
├─ next.config.mjs             # (Task 1)
├─ tailwind.config.ts          # (Task 1)
├─ postcss.config.mjs          # (Task 1)
├─ .env.example                # (Task 1)
├─ .gitignore                  # (Task 1)
└─ README.md                   # (Task 9)
```

**Responsibilities:**
- `schemas.ts` — single source of truth for request/response shapes; validates user input before it hits the contract.
- `wallet.ts` — knows ONLY about genlayer-js client construction and the browser ethereum provider. No contract names.
- `genlayerClient.ts` — knows the contract address, method names, arg encoding, and revert semantics. Depends on `wallet.ts` + `schemas.ts`. UI depends on this.
- `WalletConnect.tsx` — UI-only; calls `wallet.ts` helpers, hands the account + provider up to the page.
- Pages — orchestrate UI state and call `genlayerClient.ts`.

---

## Task 1: Project scaffold & config

**Files:**
- Create: `E:\StoryChain\package.json`
- Create: `E:\StoryChain\tsconfig.json`
- Create: `E:\StoryChain\next.config.mjs`
- Create: `E:\StoryChain\tailwind.config.ts`
- Create: `E:\StoryChain\postcss.config.mjs`
- Create: `E:\StoryChain\.env.example`
- Create: `E:\StoryChain\.gitignore`

**Interfaces:**
- Produces: a runnable `npm install` + `npm run dev` Next.js 15 project with the path alias `@/*` and Tailwind wired up. No app code yet — Tasks 6-8 add pages.

- [ ] **Step 1: Write `package.json`**

```json
{
  "name": "storychain",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "genlayer-js": "^1.1.8",
    "next": "^15.3.3",
    "react": "^19.1.0",
    "react-dom": "^19.1.0",
    "zod": "^3.23.8"
  },
  "devDependencies": {
    "@types/node": "^22.15.21",
    "@types/react": "^19.1.6",
    "@types/react-dom": "^19.1.5",
    "autoprefixer": "^10.4.21",
    "eslint": "^9.27.0",
    "eslint-config-next": "^15.3.3",
    "postcss": "^8.5.3",
    "tailwindcss": "^3.4.17",
    "typescript": "^5.8.3"
  }
}
```

- [ ] **Step 2: Write `tsconfig.json`** (path alias `@/*` -> `./*`)

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "lib": ["dom", "dom.iterable", "esnext"],
    "allowJs": true,
    "skipLibCheck": true,
    "strict": true,
    "noEmit": true,
    "esModuleInterop": true,
    "module": "esnext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "preserve",
    "incremental": true,
    "plugins": [{ "name": "next" }],
    "paths": { "@/*": ["./*"] }
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
  "exclude": ["node_modules"]
}
```

- [ ] **Step 3: Write `next.config.mjs`**

```js
/** @type {import('next').NextConfig} */
const nextConfig = {};
export default nextConfig;
```

- [ ] **Step 4: Write `tailwind.config.ts`**

```ts
import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
  ],
  theme: { extend: {} },
  plugins: [],
};
export default config;
```

- [ ] **Step 5: Write `postcss.config.mjs`**

```js
export default {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
};
```

- [ ] **Step 6: Write `.env.example`**

```env
# Address of the deployed StoryChain intelligent contract on GenLayer Studio.
# Copy to .env.local and fill in after deploying contracts/story_chain_ic.py.
NEXT_PUBLIC_STORYCHAIN_IC_ADDRESS=0x0000000000000000000000000000000000000000
```

- [ ] **Step 7: Write `.gitignore`**

```gitignore
node_modules
.next
out
.env.local
*.log
.DS_Store
next-env.d.ts
```

- [ ] **Step 8: Install dependencies**

Run: `npm install`
Expected: completes without errors; `node_modules/` and `package-lock.json` appear.

- [ ] **Step 9: Verify the scaffold builds an empty app**

Run: `npx tsc --noEmit`
Expected: PASS (no errors). (There are no `.ts`/`.tsx` files yet outside config, so this confirms the toolchain.)

- [ ] **Step 10: Commit**

```bash
git add package.json package-lock.json tsconfig.json next.config.mjs tailwind.config.ts postcss.config.mjs .env.example .gitignore
git commit -m "chore: scaffold Next.js 15 + Tailwind project"
```

---

## Task 2: Zod schemas & TypeScript types

**Files:**
- Create: `E:\StoryChain\lib\schemas.ts`

**Interfaces:**
- Produces: `CreateChainRequestSchema` (+ type `CreateChainRequest`), `StoryChainSchema` (+ type `StoryChain`), `SentenceSchema` (+ type `Sentence`). Consumed by `genlayerClient.ts` (Task 4) and the pages (Tasks 7-8).

- [ ] **Step 1: Write `lib/schemas.ts`**

```ts
import { z } from "zod";

// Request sent to contract.create_chain (frontend adds created_at separately).
export const CreateChainRequestSchema = z.object({
  title: z.string().min(1).max(200),
  premise: z.string().min(1).max(1000),
});
export type CreateChainRequest = z.infer<typeof CreateChainRequestSchema>;

// Chain metadata returned by contract.get_chain.
export const StoryChainSchema = z.object({
  chain_id: z.string(),
  title: z.string(),
  premise: z.string(),
  created_by: z.string(),
  created_at: z.string(),
});
export type StoryChain = z.infer<typeof StoryChainSchema>;

// Sentence returned by contract.get_story.
export const SentenceSchema = z.object({
  text: z.string(),
  author: z.string(),
  created_at: z.string(), // on-chain GenLayer has no wall clock; contract sets ""
});
export type Sentence = z.infer<typeof SentenceSchema>;
```

- [ ] **Step 2: Verify it typechecks**

Run: `npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add lib/schemas.ts
git commit -m "feat: add Zod schemas and types for chains and sentences"
```

---

## Task 3: genlayer-js client factories & ethereum provider

**Files:**
- Create: `E:\StoryChain\lib\wallet.ts`

**Interfaces:**
- Produces: `GENLAYER_NETWORK` (= `studionet`), `EthereumProvider` type, `getBrowserEthereumProvider()`, `createWriteClient(account, provider)`, `createReadClient()`, and types `WriteClient`/`ReadClient`. Consumed by `genlayerClient.ts` (Task 4) and `WalletConnect.tsx` (Task 6). This file knows NOTHING about contract names or addresses.

- [ ] **Step 1: Write `lib/wallet.ts`**

```ts
import { createClient } from "genlayer-js";
import { studionet } from "genlayer-js/chains";

export const GENLAYER_NETWORK = studionet;

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
```

- [ ] **Step 2: Verify it typechecks**

Run: `npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add lib/wallet.ts
git commit -m "feat: add genlayer-js client factories and ethereum provider helper"
```

---

## Task 4: Contract wrapper (genlayerClient.ts)

**Files:**
- Create: `E:\StoryChain\lib\genlayerClient.ts`

**Interfaces:**
- Consumes: `CreateChainRequestSchema`/`CreateChainRequest`/`StoryChain`/`Sentence` from `lib/schemas.ts`; `createReadClient`/`createWriteClient`/`EthereumProvider` from `lib/wallet.ts`.
- Produces: `CONTRACT_NOT_SET` (bool), `TxOutcome` type, and async functions `createChain(input, account, provider)`, `addSentence(chainId, sentence, account, provider)`, `getChain(chainId)`, `getStory(chainId)`, `getAllChains()`. Consumed by the pages (Tasks 7-8).

- [ ] **Step 1: Write `lib/genlayerClient.ts`**

```ts
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
```

- [ ] **Step 2: Verify it typechecks**

Run: `npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add lib/genlayerClient.ts
git commit -m "feat: add genlayer-js contract wrapper with revert-aware addSentence"
```

---

## Task 5: Intelligent contract (story_chain_ic.py)

**Files:**
- Create: `E:\StoryChain\contracts\story_chain_ic.py`

**Interfaces:**
- Produces: GenLayer intelligent contract `StoryChainIC(gl.Contract)` exposing: `create_chain(chain_json: str)`, `add_sentence(chain_id: str, sentence: str)` (both `@gl.public.write`), and views `get_chain(chain_id) -> dict`, `get_story(chain_id) -> list`, `get_all_chains() -> list`. The frontend (Task 4) calls these exact names with these exact arg shapes.

- [ ] **Step 1: Write `contracts/story_chain_ic.py`**

```python
# { "Depends": "py-genlayer:test" }

from genlayer import *
from dataclasses import dataclass
import json


@allow_storage
@dataclass
class Sentence:
    text: str
    author: Address
    created_at: str  # GenLayer has no wall-clock; contract leaves this ""


@allow_storage
@dataclass
class StoryChain:
    chain_id: str
    title: str
    premise: str
    created_by: Address
    created_at: str


def _parse_coherence(raw) -> dict:
    """Turn an LLM verdict string into {coherent: bool, reason: str}.

    Defaults to coherent=False on anything unparseable, so a controversial
    sentence is rejected rather than silently appended.
    """
    if isinstance(raw, (int, float)):
        return {"coherent": False, "reason": f"numeric output: {raw}"}
    if not isinstance(raw, str):
        return {"coherent": False, "reason": "non-string output"}

    text = raw.strip()
    # strip a leading ``` / ```json fence
    if text.startswith("```"):
        nl = text.find("\n")
        if nl != -1:
            text = text[nl + 1:]
    if text.endswith("```"):
        text = text[:-3]
    text = text.strip()

    # extract the outermost {...}
    start = text.find("{")
    end = text.rfind("}")
    if start != -1 and end != -1 and end > start:
        text = text[start:end + 1]

    try:
        obj = json.loads(text)
    except Exception:
        return {"coherent": False, "reason": "json parse failed"}

    coherent = obj.get("coherent")
    reason = str(obj.get("reason", ""))
    if isinstance(coherent, bool):
        return {"coherent": coherent, "reason": reason}
    if isinstance(coherent, str) and coherent.lower() in ("true", "false"):
        return {"coherent": coherent.lower() == "true", "reason": reason}
    return {"coherent": False, "reason": "missing coherent field"}


class StoryChainIC(gl.Contract):
    """Collaborative story chains with AI-gated sentence appending."""

    chains: TreeMap[str, StoryChain]
    chain_sentences: TreeMap[str, DynArray[Sentence]]
    chain_counter: u256

    def __init__(self):
        self.chain_counter = u256(0)

    @gl.public.write
    def create_chain(self, chain_json: str):
        """
        Create a new story chain.

        Expected JSON: {"title": "...", "premise": "...", "created_at": "..."}
        """
        try:
            data = json.loads(chain_json)
        except Exception as e:
            print(f"create_chain JSON error: {e}")
            return

        title = str(data.get("title", "")).strip()
        premise = str(data.get("premise", "")).strip()
        if not title or not premise:
            print("create_chain: title and premise are required")
            return

        self.chain_counter = self.chain_counter + u256(1)
        chain_id = f"chain_{int(self.chain_counter)}"

        self.chains[chain_id] = StoryChain(
            chain_id=chain_id,
            title=title[:200],
            premise=premise[:1000],
            created_by=gl.message.sender_address,
            created_at=str(data.get("created_at", "")),
        )
        self.chain_sentences.get_or_insert_default(chain_id)
        print(f"chain created: {chain_id}")

    @gl.public.write
    def add_sentence(self, chain_id: str, sentence: str):
        """Append a sentence after it passes the coherence equivalence principle."""
        if chain_id not in self.chains:
            raise Exception(f"chain not found: {chain_id}")

        sentence = str(sentence or "").strip()
        if not sentence or len(sentence) > 500:
            raise Exception("sentence must be 1..500 chars")

        chain = self.chains[chain_id]

        # build the story-so-far as validator context
        parts = [f"[Premise] {chain.premise}"]
        for s in self.chain_sentences.get_or_insert_default(chain_id):
            parts.append(s.text)
        story_so_far = "\n".join(parts)

        def judge():
            prompt = (
                "You are checking story coherence.\n"
                f"Story so far:\n{story_so_far}\n\n"
                f'New sentence to add: "{sentence}"\n\n'
                "Does the new sentence fit the story's flow, tone, and established facts?\n"
                'Return ONLY JSON: {"coherent": true|false, "reason": "<short>"}'
            )
            return gl.nondet.exec_prompt(prompt)

        verdict_raw = gl.eq_principle.prompt_non_comparative(
            judge,
            task="Decide whether the new sentence is coherent with the existing story.",
            criteria="Two answers are equivalent if they agree on the 'coherent' boolean.",
        )

        verdict = _parse_coherence(verdict_raw)
        if not verdict["coherent"]:
            raise Exception(f"sentence rejected by AI consensus: {verdict['reason']}")

        self.chain_sentences.get_or_insert_default(chain_id).append(Sentence(
            text=sentence,
            author=gl.message.sender_address,
            created_at="",
        ))
        print(f"sentence added to {chain_id}")

    @gl.public.view
    def get_chain(self, chain_id: str) -> dict:
        if chain_id not in self.chains:
            return {}
        c = self.chains[chain_id]
        return {
            "chain_id": c.chain_id,
            "title": c.title,
            "premise": c.premise,
            "created_by": str(c.created_by),
            "created_at": c.created_at,
        }

    @gl.public.view
    def get_story(self, chain_id: str) -> list:
        result = []
        if chain_id in self.chain_sentences:
            for s in self.chain_sentences[chain_id]:
                result.append({
                    "text": s.text,
                    "author": str(s.author),
                    "created_at": s.created_at,
                })
        return result

    @gl.public.view
    def get_all_chains(self) -> list:
        return [cid for cid in self.chains.keys()]
```

- [ ] **Step 2: Verify Python syntax**

Run: `python -m py_compile contracts/story_chain_ic.py`
Expected: no output, exit code 0. (This checks syntax only; the full GenLayer type/compile check happens at deploy time in Task 9.)

- [ ] **Step 3: Commit**

```bash
git add contracts/story_chain_ic.py
git commit -m "feat: add StoryChain intelligent contract with coherence EP"
```

---

## Task 6: Root layout, globals, and wallet connect button

**Files:**
- Create: `E:\StoryChain\app\layout.tsx`
- Create: `E:\StoryChain\app\globals.css`
- Create: `E:\StoryChain\components\WalletConnect.tsx`

**Interfaces:**
- Consumes: `getBrowserEthereumProvider`, `EthereumProvider` from `lib/wallet.ts` (Task 3).
- Produces: `<WalletConnect onConnect={(account, provider) => ...} />` — a client component that calls `eth_requestAccounts` and reports the connected account + provider to its parent. Used by both pages (Tasks 7-8).

- [ ] **Step 1: Write `app/globals.css`**

```css
@tailwind base;
@tailwind components;
@tailwind utilities;
```

- [ ] **Step 2: Write `app/layout.tsx`**

```tsx
import "./globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "StoryChain",
  description: "Collaborative AI-gated story chains on GenLayer",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-gray-50 text-gray-900 antialiased">
        {children}
      </body>
    </html>
  );
}
```

- [ ] **Step 3: Write `components/WalletConnect.tsx`**

```tsx
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
```

- [ ] **Step 4: Verify it typechecks**

Run: `npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add app/layout.tsx app/globals.css components/WalletConnect.tsx
git commit -m "feat: add root layout, global styles, and wallet connect button"
```

---

## Task 7: Home page — list chains + create form

**Files:**
- Create: `E:\StoryChain\app\page.tsx`

**Interfaces:**
- Consumes: `WalletConnect` (Task 6); `createChain`, `getAllChains`, `getChain`, `CONTRACT_NOT_SET` from `lib/genlayerClient.ts` (Task 4); `EthereumProvider` from `lib/wallet.ts`; `StoryChain` from `lib/schemas.ts`.

- [ ] **Step 1: Write `app/page.tsx`**

```tsx
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
```

- [ ] **Step 2: Verify it typechecks**

Run: `npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add app/page.tsx
git commit -m "feat: add home page with chain list and create form"
```

---

## Task 8: Chain detail page — read story + add sentence

**Files:**
- Create: `E:\StoryChain\app\chain\[id]\page.tsx`

**Interfaces:**
- Consumes: `WalletConnect` (Task 6); `getChain`, `getStory`, `addSentence`, `CONTRACT_NOT_SET` from `lib/genlayerClient.ts` (Task 4); `EthereumProvider` from `lib/wallet.ts`; `StoryChain`, `Sentence` from `lib/schemas.ts`.

- [ ] **Step 1: Write `app/chain/[id]/page.tsx`**

```tsx
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
```

- [ ] **Step 2: Verify it typechecks**

Run: `npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add app/chain/[id]/page.tsx
git commit -m "feat: add chain detail page with story reader and add-sentence form"
```

---

## Task 9: README + end-to-end manual smoke test

**Files:**
- Create: `E:\StoryChain\README.md`

**Interfaces:**
- Consumes: everything from Tasks 1-8. This task is documentation plus the manual verification that the whole system works against a deployed contract.

- [ ] **Step 1: Write `README.md`**

````markdown
# StoryChain

Collaborative AI-gated story chains on GenLayer. Anyone can start a story chain; each new sentence must pass an LLM **equivalence principle** coherence check before it is appended.

## Stack
- Intelligent contract: Python + py-genlayer (`contracts/story_chain_ic.py`)
- Frontend: Next.js 15 + React 19 + Tailwind (`app/`, `components/`, `lib/`)
- SDK: `genlayer-js` over the `studionet` chain

## How it works
1. `create_chain({ title, premise })` stores a new chain.
2. `add_sentence(chain_id, sentence)` runs `gl.eq_principle.prompt_non_comparative` over the premise + existing sentences. If the majority of validators agree the sentence is **coherent**, it is appended; otherwise the transaction reverts.
3. The frontend waits for finalization and inspects `txExecutionResultName` to show "Rejected by AI consensus" when a sentence is rejected.

## Setup

### 1. Frontend
```bash
npm install
cp .env.example .env.local   # then fill in the contract address after step 2
npm run dev
```
Open http://localhost:3000.

### 2. Deploy the contract (GenLayer Studio)
1. Start GenLayer Studio and open its UI.
2. Deploy `contracts/story_chain_ic.py`.
3. Copy the deployed contract address into `.env.local` as `NEXT_PUBLIC_STORYCHAIN_IC_ADDRESS`.
4. Restart `npm run dev`.

## Manual smoke test
See the verification step below.
````

- [ ] **Step 2: Typecheck the whole project one more time**

Run: `npx tsc --noEmit`
Expected: PASS (zero errors).

- [ ] **Step 3: End-to-end manual verification (requires GenLayer Studio running + contract deployed)**

Perform these steps and confirm the expected result for each:

1. Start Studio, deploy `contracts/story_chain_ic.py`, copy the address into `.env.local` as `NEXT_PUBLIC_STORYCHAIN_IC_ADDRESS`, restart `npm run dev`.
   - Expected: home page loads, no amber "not set" banner.
2. Click **Connect wallet** and approve in your wallet.
   - Expected: address shown as `0x1234…abcd`.
3. Fill Title = `The Lighthouse`, Premise = `A keeper spots a drifting boat with no crew.` and click **Create chain**.
   - Expected: success message with a tx hash; the chain appears in "All chains".
4. Click the chain. In **Add a sentence** enter `She radioed the coast guard, but only static answered.` and submit.
   - Expected: message `Added. tx …`; the sentence appears below the premise.
5. In the same chain, submit an incoherent sentence, e.g. `Bitcoin is the best cryptocurrency to buy right now!!!`
   - Expected: message `Rejected by AI consensus — write a sentence that fits the story.`; the sentence does NOT appear.
6. Reload the page.
   - Expected: the chain and the accepted sentence (step 4) are still there; the rejected sentence (step 5) is absent.

If any step fails, the most likely causes: (a) `NEXT_PUBLIC_STORYCHAIN_IC_ADDRESS` not set/restarted, (b) wallet not connected for write steps, (c) GenLayer Studio not running. Fix and re-run from the failing step.

- [ ] **Step 4: Commit**

```bash
git add README.md
git commit -m "docs: add README and manual smoke-test instructions"
```

---

## Definition of Done

- All 9 tasks committed.
- `npx tsc --noEmit` passes with zero errors.
- Contract deploys on GenLayer Studio without compile errors.
- Manual smoke test (Task 9, Step 3) passes all 6 checks: coherent sentences append, incoherent sentences are rejected, state survives reload.
