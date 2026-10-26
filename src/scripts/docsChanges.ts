import { collectDocumentationChanges } from '../docs/changeContext.js';

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  if (args.length !== 0 && (args.length !== 2 || args[0] !== '--base')) {
    throw new Error('Usage: npm run docs:changes -- [--base <commit-or-branch>]');
  }
  const context = await collectDocumentationChanges(process.cwd(), args[1]);
  console.log(JSON.stringify(context, null, 2));
  console.log(
    '\nThis is change discovery, not an AI updater. Run /sync-api-documentation in ' +
    'Copilot Chat to inspect the code, update annotations, regenerate and verify. ' +
    'A passing docs:check does not prove semantic accuracy.'
  );
}

main().catch((error: unknown) => {
  console.error('Documentation change discovery failed:', error);
  process.exitCode = 1;
});
