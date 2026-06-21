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

Run these against a live Studio instance + deployed contract. The coherence check (steps 4-5) is the load-bearing test: an accepted sentence must append, a rejected one must show "Rejected by AI consensus".

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

If step 4 shows "Rejected by AI consensus" for a clearly coherent sentence, the contract method (a void write) likely reports a non-`*_WITH_RETURN` status on success; add `"FINISHED"` / `"FINALIZED"` to `SUCCESS_RESULT_NAMES` in `lib/genlayerClient.ts` and retry.
