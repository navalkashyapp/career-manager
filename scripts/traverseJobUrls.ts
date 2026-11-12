import { JobUrlWorkerService } from '../src/lib/services/JobUrlWorkerService';

async function main() {
  console.log('Starting Job URLs manual sweep via JobUrlWorkerService...');
  await JobUrlWorkerService.runCycle({ forceAll: true });
  console.log('Manual traversal finished.');
}

if (process.argv[1] && process.argv[1].endsWith('traverseJobUrls.ts')) {
  main().catch(console.error);
}
