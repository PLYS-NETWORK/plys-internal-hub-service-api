import { AppDataSource } from '@plys/libraries/database/data-source';

function assertDropAllowed(): void {
  const deployEnv = process.env.DEPLOY_ENV ?? 'local';
  const allowOverride = process.env.ALLOW_DB_DROP === 'true';

  if (deployEnv !== 'local' && !allowOverride) {
    console.error(
      'Refusing to drop schema: set DEPLOY_ENV=local or ALLOW_DB_DROP=true to proceed.',
    );
    process.exit(1);
  }
}

async function main(): Promise<void> {
  assertDropAllowed();

  await AppDataSource.initialize();
  console.log(`Dropping public schema on ${process.env.DB_DATABASE ?? 'marketplace'}...`);

  await AppDataSource.query('DROP SCHEMA public CASCADE');
  await AppDataSource.query('CREATE SCHEMA public');
  await AppDataSource.query('GRANT ALL ON SCHEMA public TO public');

  await AppDataSource.destroy();
  console.log('Schema dropped and recreated (empty). Run pnpm migration:run to restore tables.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
