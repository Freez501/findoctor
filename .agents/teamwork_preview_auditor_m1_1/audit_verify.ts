import { InMemoryStore } from '../../src/server/storage/InMemoryStore.js';
import { JsonFileStore } from '../../src/server/storage/JsonFileStore.js';
import { validateCreateTransactionDTO } from '../../src/shared/dto.js';
import { INITIAL_TOTAL_CAPITAL, ACCOUNT_IDS } from '../../src/shared/constants.js';
import { SEED_TRANSACTIONS, POST_SEED_ACCOUNTS } from '../../src/server/data/seed.js';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

async function runForensicAuditChecks() {
  console.log('=== STARTING INDEPENDENT FORENSIC VERIFICATION ===');

  // 1. InMemoryStore verification
  const memoryStore = new InMemoryStore();
  const accounts = await memoryStore.getAccounts();
  if (accounts.length !== 5) throw new Error(`Expected 5 accounts, got ${accounts.length}`);
  
  const total = accounts.reduce((sum, a) => sum + a.currentBalance, 0);
  console.log(`[PASS] Initial seed total balance: ${total} ₽ (expected: 1166300 ₽)`);
  if (total !== 1166300) throw new Error(`Expected 1166300, got ${total}`);

  // 2. Rounding & Decimal precision verification
  const updated = await memoryStore.updateAccountBalance(ACCOUNT_IDS.CASH_1, 999.999);
  if (updated.currentBalance !== 1000) throw new Error(`Expected rounding to 1000, got ${updated.currentBalance}`);
  console.log('[PASS] Decimal rounding to 2 places verified.');

  // 3. Immutability verification (deep clone)
  accounts[0].currentBalance = -999999;
  const reFetched = await memoryStore.getAccounts();
  if (reFetched[0].currentBalance === -999999) throw new Error('Store leaked internal mutable reference!');
  console.log('[PASS] Object immutability & reference leak protection verified.');

  // 4. JsonFileStore persistence & corruption recovery
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'auditor-test-'));
  const tempFile = path.join(tempDir, 'data', 'audit_truespace.json');

  const fileStore = new JsonFileStore(tempFile);
  if (!fs.existsSync(tempFile)) throw new Error('FileStore failed to create file');

  await fileStore.updateAccountBalance(ACCOUNT_IDS.BANK_1, 888888);
  const fileContent = JSON.parse(fs.readFileSync(tempFile, 'utf-8'));
  const bank1 = fileContent.accounts.find((a: any) => a.id === ACCOUNT_IDS.BANK_1);
  if (bank1.currentBalance !== 888888) throw new Error('Persistence mismatch on disk');
  console.log('[PASS] JsonFileStore file creation and disk persistence verified.');

  // Corrupt file
  fs.writeFileSync(tempFile, 'CORRUPTED_JSON_DATA!!!', 'utf-8');
  const recoveredStore = new JsonFileStore(tempFile);
  const recoveredAccounts = await recoveredStore.getAccounts();
  const recoveredTotal = recoveredAccounts.reduce((sum, a) => sum + a.currentBalance, 0);
  if (recoveredTotal !== 1166300) throw new Error('Corruption recovery failed');
  console.log('[PASS] JsonFileStore corruption recovery verified.');

  fs.rmSync(tempDir, { recursive: true, force: true });

  // 5. Validation helper verification
  const badRes = validateCreateTransactionDTO({ type: 'transfer', amount: 100, fromAccountId: 'a', toAccountId: 'a', categoryId: 'c' });
  if (badRes.valid) throw new Error('Failed to reject identical transfer accounts');
  console.log('[PASS] Double-entry validation schema verified.');

  console.log('=== ALL FORENSIC AUDIT CHECKS COMPLETED SUCCESSFULLY ===');
}

runForensicAuditChecks().catch((err) => {
  console.error('[FAIL] Forensic check failed:', err);
  process.exit(1);
});
