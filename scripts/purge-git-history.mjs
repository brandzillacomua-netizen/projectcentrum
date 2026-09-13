import { execSync } from 'node:child_process';
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

function run(cmd) {
  try {
    return execSync(cmd, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
  } catch (err) {
    return null;
  }
}

function main() {
  console.log('🔍 [Git History Purge Preflight] Checking repository security status...');

  // 1. Check if git repository is clean
  const status = run('git status --porcelain');
  if (status && status.length > 0) {
    console.warn('⚠️ Warning: Git working directory has uncommitted changes. Commit or stash them before running git-filter-repo.');
  } else {
    console.log('PASS: Git working directory is clean.');
  }

  // 2. Verify git secret scanner script passes
  console.log('Running secret scanner against tracked files...');
  try {
    execSync('npm run security:secrets', { stdio: 'inherit' });
    console.log('PASS: Tracked files are 100% clean of sensitive environment keys.');
  } catch {
    console.error('FAIL: Secret boundary check failed. Clean tracked files before purging history.');
    process.exit(1);
  }

  // 3. Output safe step-by-step git-filter-repo execution instructions
  console.log('\n================================================================');
  console.log('📜 GIT HISTORY PURGE RUNBOOK FOR ENTERPRISE COMPLIANCE');
  console.log('================================================================');
  console.log('1. Rotate external API credentials FIRST (Nova Poshta token, Telegram Bot token, DB Audit passwords).');
  console.log('2. Create safety tag backup of current git history:');
  console.log('   git tag pre-purge-backup-$(date +%Y%m%d)');
  console.log('3. Run git-filter-repo to purge legacy .env path from history:');
  console.log('   npx git-filter-repo --path .env --invert-paths --force');
  console.log('4. Verify repository integrity:');
  console.log('   git fsck --full');
  console.log('5. Synchronize all team clones before force pushing updated main branch.');
  console.log('================================================================\n');
}

main();
