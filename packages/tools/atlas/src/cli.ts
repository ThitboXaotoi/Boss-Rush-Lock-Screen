// Entry for `bun run --filter @boss-rush/tools art:import`.
import { runImport } from './import-run';

try {
  const result = await runImport();
  if (result.errors.length > 0) process.exitCode = 1;
} catch (error) {
  console.error(`art:import: ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
}
