import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';

function main() {
  const migrationsDir = resolve(process.cwd(), 'supabase', 'migrations');
  const files = readdirSync(migrationsDir);

  const partitionMigration = files.find(f => f.includes('schedule_monthly_partition_cron'));
  if (!partitionMigration) {
    console.error('FAIL: Monthly partition cron migration not found in supabase/migrations');
    process.exit(1);
  }

  const content = readFileSync(resolve(migrationsDir, partitionMigration), 'utf8');
  if (!content.includes('rpc_create_monthly_partitions') || !content.includes('cron.schedule')) {
    console.error('FAIL: Monthly partition cron migration lacks expected PL/pgSQL function or cron schedule');
    process.exit(1);
  }

  console.log(`PASS: Monthly partition cron contract verified (${partitionMigration})`);
}

main();
