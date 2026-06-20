#!/usr/bin/env node
/**
 * gen-test-mnemonic.mjs
 *
 * Generates a fresh BIP-39 12-word test mnemonic and derives the
 * standard BIP-44 EVM address-0 (m/44'/60'/0'/0/0 per ADR-009) via
 * viem for verification.
 *
 * Phase 1 mnemonic is INTENTIONALLY distinct from Phase 0 per the
 * hygiene guidance in docs/15_PHASE_1_KICKOFF_HANDOVER.md Part VIII
 * Task 3 — uploaded Phase 0 mnemonic stays in the frozen Phase 0
 * harness and is never reused here.
 *
 * Usage:
 *   pnpm gen:mnemonic
 *   (or: node scripts/gen-test-mnemonic.mjs)
 *
 * Output:
 *   - Fresh 12-word BIP-39 mnemonic
 *   - Derived EVM address at m/44'/60'/0'/0/0 (ADR-009 standard path)
 *   - Reminder to save the mnemonic to local .env (gitignored)
 *
 * NEVER fund the generated mnemonic with real assets. Dev/testnet only.
 */

import { generateMnemonic, validateMnemonic } from "bip39";
import { mnemonicToAccount } from "viem/accounts";

const mnemonic = generateMnemonic(128); // 128 bits entropy = 12 words

if (!validateMnemonic(mnemonic)) {
  console.error("FATAL: generated mnemonic failed BIP-39 validation. Aborting.");
  process.exit(1);
}

const account = mnemonicToAccount(mnemonic);

const line = "=".repeat(75);
console.log("");
console.log(line);
console.log("  Phase 1 test mnemonic - DEV/TESTNET ONLY, NEVER fund with real $$");
console.log(line);
console.log("");
console.log("  Mnemonic (12 words):");
console.log("    " + mnemonic);
console.log("");
console.log("  Derived EVM address (BIP-44 path m/44'/60'/0'/0/0 per ADR-009):");
console.log("    " + account.address);
console.log("");
console.log(line);
console.log("  Next steps:");
console.log("    1. Copy this line into your local .env file (which is gitignored):");
console.log("       TEST_MNEMONIC=\"" + mnemonic + "\"");
console.log("");
console.log("    2. ADR-009 invariant: viem.mnemonicToAccount(mnemonic) must derive");
console.log("       the address shown above. The wdk-web-core address-parity");
console.log("       regression test (Task 5+ work) will assert this byte-for-byte.");
console.log("");
console.log("    3. Phase 1 mnemonic MUST be distinct from Phase 0 - do not copy");
console.log("       the Phase 0 mnemonic over from C:\\PROJECTS\\wdk-phase0-validation.");
console.log(line);
console.log("");
