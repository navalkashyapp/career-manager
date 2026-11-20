import { GeminiKeyService } from '../src/lib/services/GeminiKeyService';
import * as readline from 'readline';

const DEFAULT_UID = GeminiKeyService.DEFAULT_USER_ID;

function maskKey(key: string): string {
  if (key.length <= 10) return '***';
  return `${key.substring(0, 6)}...${key.substring(key.length - 4)}`;
}

async function prompt(questionText: string): Promise<string> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    rl.question(questionText, (ans) => {
      rl.close();
      resolve(ans.trim());
    });
  });
}

async function main() {
  const args = process.argv.slice(2);

  console.log('========================================');
  console.log('🔑 Gemini API Key Manager (Firestore)');
  console.log(`Target User UID: ${DEFAULT_UID}`);
  console.log('========================================\n');

  // Fetch current keys
  try {
    const currentKeys = await GeminiKeyService.getApiKeys(DEFAULT_UID);
    console.log(`Current keys in Firestore (${currentKeys.length} configured):`);
    currentKeys.forEach((k, idx) => {
      console.log(`  [Key ${idx + 1}] ${maskKey(k)} (Length: ${k.length})`);
    });
    console.log('');
  } catch (err: any) {
    console.log(`Note: Could not read existing keys: ${err.message}\n`);
  }

  let newKeys: string[] = [];

  if (args.length > 0) {
    // Keys provided as command-line arguments
    newKeys = args.filter((k) => k.trim().length > 0);
  } else {
    // Interactive prompt
    console.log('Enter one or more Gemini API keys (separated by spaces or commas).');
    console.log('Press Enter without typing to cancel.\n');
    const input = await prompt('New Gemini API key(s): ');

    if (!input) {
      console.log('\n❌ Operation cancelled. No changes made.');
      process.exit(0);
    }

    newKeys = input
      .split(/[\s,]+/)
      .map((k) => k.trim())
      .filter((k) => k.length > 0);
  }

  if (newKeys.length === 0) {
    console.log('❌ Error: At least one non-empty key is required.');
    process.exit(1);
  }

  console.log(`\nUpdating Firestore with ${newKeys.length} key(s)...`);
  await GeminiKeyService.setApiKeys(DEFAULT_UID, newKeys);

  // Clear and refresh cache
  GeminiKeyService.clearCache(DEFAULT_UID);
  const updatedKeys = await GeminiKeyService.getApiKeys(DEFAULT_UID);

  console.log('\n✅ Successfully updated Gemini API keys in Firestore:');
  updatedKeys.forEach((k, idx) => {
    console.log(`  [Key ${idx + 1}] ${maskKey(k)} (Length: ${k.length})`);
  });
  console.log('\nBackend services will automatically use the updated keys.');
  process.exit(0);
}

main().catch((err) => {
  console.error('\n❌ Failed to update keys:', err);
  process.exit(1);
});
