// Fetch a full transaction receipt for a known tx hash (acceptance-based,
// not FINALIZED — Bradbury finalizes slowly but ACCEPTED comes fast).
// Prints txExecutionResultName so we can resolve the success-status-set
// question (Important #2) for void writes.
//
// Run: node scripts/receipt.mjs 0xHASH...
import { createClient } from "genlayer-js";
import { testnetBradbury } from "genlayer-js/chains";

const client = createClient({ chain: testnetBradbury });
const hash = process.argv[2];

if (!hash) {
  console.error("usage: node scripts/receipt.mjs <txHash>");
  process.exit(1);
}

for (const status of ["ACCEPTED", "FINALIZED"]) {
  try {
    const r = await client.waitForTransactionReceipt({ hash, status, retries: 40, interval: 4000 });
    console.log(`\n=== ${status} ===`);
    console.log("status_name:           ", r.status_name);
    console.log("resultName:            ", r.resultName);
    console.log("txExecutionResultName: ", r.txExecutionResultName);
    console.log("validatorVotesName:    ", JSON.stringify(r.validatorVotesName));
    console.log("result_code (if any):  ", r.result_code);
    break;
  } catch (e) {
    console.log(`(wait ${status} failed: ${String((e && (e.shortMessage||e.message))||e).slice(0,80)})`);
  }
}
