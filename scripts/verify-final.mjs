// Final end-to-end verification: write ALL methods + read back.
// Waits for ACCEPTED (fast on Bradbury, ~10-30s) instead of FINALIZED (slow, minutes).
// Verifies:
//   create_chain  -> FINISHED_WITH_RETURN, chain appears
//   add_sentence COHERENT -> FINISHED_WITH_RETURN, sentence appended
//   add_sentence INCOHERENT -> revert (not in success-set), sentence NOT appended

import { createClient, createAccount } from "genlayer-js";
import { testnetBradbury } from "genlayer-js/chains";

const CONTRACT =
  process.env.STORYCHAIN_IC || "0xd712d099aCeE1315958a446cC11648Cf6b9baA9C";
const pk = process.env.STORYCHAIN_PK;
if (!pk) { console.error("STORYCHAIN_PK required"); process.exit(1); }

const account = createAccount(pk);
const client = createClient({ chain: testnetBradbury, account });
const SUCCESS = new Set(["FINISHED_WITH_RETURN", "FINALIZED_WITH_RETURN", "Successful"]);
const log = (...a) => console.log(...a);

// Wait for ACCEPTED (fast). Falls back to FINALIZED fields if present.
async function waitForReceipt(hash) {
  // Poll every 6s up to ~6 min.
  for (let i = 1; i <= 60; i++) {
    try {
      const r = await client.waitForTransactionReceipt({
        hash,
        status: "ACCEPTED",
        retries: 1,
        interval: 6000,
      });
      return r;
    } catch {
      if (i % 5 === 0) log(`  ...${i*6}s still pending`);
      await new Promise((r) => setTimeout(r, 1500));
    }
  }
  throw new Error("ACCEPTED timeout");
}

async function read(fn, args = []) {
  const res = await client.readContract({ address: CONTRACT, functionName: fn, args });
  return res;
}

async function write(fn, args, label) {
  log(`\n[write] ${fn} (${label})`);
  const hash = await client.writeContract({ address: CONTRACT, functionName: fn, args, value: 0n });
  log(`  tx: ${hash}`);
  const r = await waitForReceipt(hash);
  const name = r.txExecutionResultName;
  const ok = typeof name === "string" && SUCCESS.has(name);
  log(`  status=${r.status_name} result=${r.resultName} txExecResult=${name} -> ${ok ? "ACCEPTED" : "REVERTED/ERROR"}`);
  return { hash, name, ok };
}

log(`account:  ${account.address}`);
log(`contract: ${CONTRACT}`);
log(`start:    ${new Date().toISOString()}`);

const results = { create: null, coherent: null, incoherent: null };

// 1. create_chain (JSON as STRING — mirrors frontend)
const payload = JSON.stringify({
  title: "The Lighthouse",
  premise: "A keeper spots a drifting boat with no crew.",
  created_at: "2026-06-21T00:00:00Z",
});
results.create = await write("create_chain", [payload], "create");

// pick the newest chain
const chains = await read("get_all_chains");
const arr = Array.isArray(chains) ? chains.filter((x) => typeof x === "string") : [];
const chainId = arr[arr.length - 1];
log(`\n[read] get_all_chains => ${JSON.stringify(arr)}  (using ${chainId})`);
log(`[read] get_chain => ${JSON.stringify(await read("get_chain", [chainId]))}`);
const story0 = await read("get_story", [chainId]);
log(`[read] get_story before => ${JSON.stringify(story0)}`);

// 2. COHERENT sentence -> expect ACCEPTED + appended
results.coherent = await write(
  "add_sentence",
  [chainId, "She radioed the coast guard, but only static answered."],
  "COHERENT — expect ACCEPTED",
);
const story1 = await read("get_story", [chainId]);
log(`[read] get_story after COHERENT => ${JSON.stringify(story1)}`);
const n1 = Array.isArray(story1) ? story1.length : 0;

// 3. INCOHERENT sentence -> expect REVERTED + NOT appended
results.incoherent = await write(
  "add_sentence",
  [chainId, "BUY BITCOIN NOW!!! BEST CRYPTO DEAL 50% OFF!!!"],
  "INCOHERENT — expect REVERTED",
);
const story2 = await read("get_story", [chainId]);
log(`[read] get_story after INCOHERENT => ${JSON.stringify(story2)}`);
const n2 = Array.isArray(story2) ? story2.length : 0;

log(`\n========== VERDICT ==========`);
log(`create_chain:        ${results.create?.ok ? "PASS" : "FAIL"} (${results.create?.name})`);
log(`coherent appended:   ${n1 > (Array.isArray(story0)?story0.length:0) ? "PASS (sentence stored)" : "FAIL (not stored)"}`);
log(`incoherent reverted: ${results.incoherent && !results.incoherent.ok ? "PASS (reverted)" : "FAIL (was accepted!)"}`);
log(`incoherent not stored: ${n2 === n1 ? "PASS (count unchanged)" : "FAIL (count changed)"}`);
log(`============================`);
log(`done: ${new Date().toISOString()}`);
