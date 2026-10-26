import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execute = promisify(execFile);

async function git(projectRoot: string, args: string[]): Promise<string> {
  const { stdout } = await execute('git', args, {
    cwd: projectRoot,
    maxBuffer: 8 * 1024 * 1024
  });
  return stdout;
}

export interface DocumentationChangeContext {
  baseCommit: string;
  comparison: string;
  changedFiles: string[];
  sourceFiles: string[];
  documentationFiles: string[];
}

export async function collectDocumentationChanges(
  projectRoot: string,
  base = 'HEAD'
): Promise<DocumentationChangeContext> {
  const baseCommit = (
    await git(projectRoot, ['rev-parse', '--verify', '--end-of-options', `${base}^{commit}`])
  ).trim();
  const tracked = await git(projectRoot, [
    'diff', '--name-only', '--no-renames', '-z', baseCommit, '--'
  ]);
  const untracked = await git(projectRoot, [
    'ls-files', '--others', '--exclude-standard', '-z'
  ]);
  const changedFiles = [...new Set([...tracked.split('\0'), ...untracked.split('\0')])]
    .filter(Boolean)
    .sort();

  return {
    baseCommit,
    comparison: 'Base commit to current working tree, including staged and untracked files.',
    changedFiles,
    sourceFiles: changedFiles.filter(
      (file) => file.startsWith('src/') || file.startsWith('prisma/')
    ),
    documentationFiles: changedFiles.filter(
      (file) => file.startsWith('docs/') || file.endsWith('.md')
    )
  };
}
