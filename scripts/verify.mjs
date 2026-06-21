// End-to-end verification of the StoryChain contract on Bradbury via genlayer-js.
// Writes ALL methods (create_chain, add_sentence x2) then reads back to verify.
// Run in background: STORYCHAIN_PK=0x... node scripts/verify.mjs
//
// Bradbury finalizes SLOWLY (5 validators, several minutes per write), so the
// FINALIZED wait is very patient and logs each poll. Output is line-buffered.

import { createClient, createAccount } from "genlayer-js";
import { testnetBradbury } from "genlayer-js/chains";

const CONTRACT =
  process.env.STORYCHAIN_IC || "0xd712d099aCeE1315958a446cC11648Cf6b9baA9C";
const pk = process.env.STORYCHAIN_PK;
if (!pk) {
  console.error("ERROR: STORYCHAIN_PK env var required (funded Bradbury account)");
  process.exit(1);
}

const account = createAccount(pk);
const client = createClient({ chain: testnetBradbury, account });

const SUCCESS = new Set(["FINISHED_WITH_RETURN", "FINALIZED_WITH_RETURN", "Successful"]);

function p(...a) { console.log(...a); }

// Patient FINALIZED wait with per-poll logging. Up to ~20 min per write.
async function waitFinalized(hash) {
  const MAX = 150;
  const INTERVAL = 8000;
  for (let i = 1; i <= MAX; i++) {
    try {
      const r = await client.waitForTransactionReceipt({
        hash,
        status: "FINALIZED",
        retries: 1,
        interval: INTERVAL,
      });
      return r;
    } catch (e) {
      const msg = String((e && (e.shortMessage || e.message)) || e).slice(0, 90);
      if (i % 5 === 0) p(`    ...poll ${i}/${MAX} still waiting: ${msg}`);
      await new Promise((r) => setTimeout(r, 1000));
    }
  }
  throw new Error(`timed out after ${MAX} polls`);
}

async function readMethod(functionName, args = []) {
  p(`\n--- read ${functionName}(${args.map(String).join(", ")}) ---`);
  const res = await client.readContract({ address: CONTRACT, functionName, args });
  p(`  => ${JSON.stringify(res)}`);
  return res;
}

async function writeMethod(functionName, args, label = "") {
  p(`\n=== write ${functionName}${label ? " (" + label + ")" : ""} ===`);
  const hash = await client.writeContract({ address: CONTRACT, functionName, args, value: 0n });
  p(`  tx: ${hash}`);
  p(`  waiting for FINALIZED (this takes several minutes on Bradbury)...`);
  const r = await waitFinalized(hash);
  p(`  status_name:          ${r.status_name}`);
  p(`  resultName:           ${r.resultName}`);
  p(`  txExecutionResultName: ${r.txExecutionResultName}`);
  p(`  validatorVotesName:   ${JSON.stringify(r.validatorVotesName)}`);
  const ok = typeof r.txExecutionResultName === "string" && SUCCESS.has(r.txExecutionResultName);
  p(`  => ${ok ? "ACCEPTED (in success-set)" : "REVERTED/ERROR (NOT in success-set)"}`);
  return { hash, receipt: r, ok };
}

p(`account:  ${account.address}`);
p(`contract: ${CONTRACT}`);
p(`start:    ${new Date().toISOString()}`);

// Track how this run changes on-chain state, so we can verify reads even if a
// later write times out.
let myChainId = null;

try {
  // 0. baseline reads
  await readMethod("get_all_chains");

  // 1. create_chain — JSON as a STRING (frontend behavior)
  const chainPayload = JSON.stringify({
    title: "The Lighthouse",
    premise: "A keeper spots a drifting boat with no crew.",
    created_at: "2026-06-21T00:00:00Z",
  });
  try {
    const cc = await writeMethod("create_chain", [chainPayload], "create");
    // read back the chain list and pick the newest
    const chains = await readMethod("get_all_chains");
    const arr = Array.isArray(chains) ? chains.filter((x) => typeof x === "string") : [];
    myChainId = arr[arr.length - 1];
    p(`  using chainId: ${myChainId}`);
  } catch (e) {
    p(`  create_chain wait failed: ${String((e&&e.message)||e).slice(0,120)}`);
  }

  // If create timed out, fall back to chain_1 (known to exist from earlier runs)
  if (!myChainId) {
    const chains = await readMethod("get_all_chains");
    const arr = Array.isArray(chains) ? chains.filter((x) => typeof x === "string") : [];
    myChainId = arr[arr.length - 1] || "chain_1";
    p(`  fallback chainId: ${myChainId}`);
  }

  // 2. metadata + story (reads)
  await readMethod("get_chain", [myChainId]);
  const before = await readMethod("get_story", [myChainId]);
  const beforeN = Array.isArray(before) ? before.length : 0;

  // 3. COHERENT sentence -> expect ACCEPTED + appended
  await writeMethod(
    "add_sentence",
    [myChainId, "She radioed the coast guard, but only static answered."],
    "COHERENT — expect ACCEPTED",
  );
  const afterCoherent = await readMethod("get_story", [myChainId]);
  const afterCoherentN = Array.isArray(afterCoherent) ? afterCoherent.length : 0;
  p(`  sentences: ${beforeN} -> ${afterCoherentN} (expect +1 if accepted)`);

  // 4. INCOHERENT sentence -> expect REVERTED (not appended)
  await writeMethod(
    "add_sentence",
    [myChainId, "BUY BITCOIN NOW!!! BEST CRYPTO DEAL!!!"],
    "INCOHERENT — expect REVERTED",
  );
  const afterIncoherent = await readMethod("get_story", [myChainId]);
  const afterIncoherentN = Array.isArray(afterIncoherent) ? afterIncoherent.length : 0;
  p(`  sentences: ${afterCoherentN} -> ${afterIncoherentN} (expect same if reverted)`);

  p(`\n=== DONE (${new Date().toISOString()}) ===`);
} catch (e) {
  console.error("\n=== FATAL ===", e?.message || e);
  process.exit(1);
}
