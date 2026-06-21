// Quick robust diagnostic: balances + fund-tx receipt, with per-call retries.
import { createClient } from "genlayer-js";
import { testnetBradbury } from "genlayer-js/chains";

const PACT = "0x3e4616e7e1cc34f3080d49c769052017b0fd3e35";
const SIGNER = "0x348f42A9B0d50618D57BF417dC8F4eAf5743a62e";
const FUND_TX = "0x35b8104dfaab8bfb23244ab076ec43e28a1599f4540c9aad923cb006bbbe02bd";

const client = createClient({ chain: testnetBradbury });

async function retry(label, fn, tries = 6, delayMs = 4000) {
  for (let i = 1; i <= tries; i++) {
    try { return await fn(); }
    catch (e) {
      const msg = (e && (e.shortMessage || e.message)) || String(e);
      console.log(`  [${label}] try ${i}/${tries} failed: ${String(msg).slice(0, 120)}`);
      if (i === tries) throw e;
      await new Promise((r) => setTimeout(r, delayMs));
    }
  }
}

async function bal(addr) {
  try {
    const b = await retry(`balance ${addr.slice(0,8)}`, () => client.getBalance({ address: addr }));
    return b.toString();
  } catch (e) { return `ERR ${String((e&&e.shortMessage)||e).slice(0,80)}`; }
}

console.log("pact   balance wei:", await bal(PACT));
console.log("signer balance wei:", await bal(SIGNER));

console.log("\nfund tx receipt:");
try {
  const r = await retry("receipt", () => client.waitForTransactionReceipt({
    hash: FUND_TX,
    status: "FINALIZED",
    retries: 1,
    interval: 1000,
  }));
  console.log({
    status_name: r.status_name,
    resultName: r.resultName,
    txExecutionResultName: r.txExecutionResultName,
    data: r.data,
    to: r.to,
    value: r.value?.toString?.(),
  });
} catch (e) {
  console.log("  receipt not available:", String((e && (e.shortMessage||e.message)) || e).slice(0,150));
}
