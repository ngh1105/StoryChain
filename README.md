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
