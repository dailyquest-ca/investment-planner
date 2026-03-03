#!/usr/bin/env node
/**
 * One-time setup: copy scripts/post-commit to .git/hooks/post-commit
 * so that every "git commit" automatically runs "git push origin main".
 */
const fs = require('fs');
const path = require('path');

const repoRoot = path.resolve(__dirname, '..');
const hookSrc = path.join(repoRoot, 'scripts', 'post-commit');
const hookDest = path.join(repoRoot, '.git', 'hooks', 'post-commit');

if (!fs.existsSync(path.join(repoRoot, '.git', 'HEAD'))) {
  console.error('Not a git repo (no .git/HEAD). Run from the project root.');
  process.exit(1);
}
if (!fs.existsSync(hookSrc)) {
  console.error('scripts/post-commit not found.');
  process.exit(1);
}

fs.copyFileSync(hookSrc, hookDest);
try {
  fs.chmodSync(hookDest, 0o755);
} catch {
  // Windows may not need chmod
}
console.log('Installed .git/hooks/post-commit. Commits will now auto-push to origin main.');
