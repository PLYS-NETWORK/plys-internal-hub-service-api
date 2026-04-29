import * as dotenv from 'dotenv';
import * as path from 'path';

// Picks the env file matching NODE_ENV. Imported as a side effect at the very top
// of seed-runner.ts so process.env is populated before data-source.ts (which
// reads DB_HOST etc. at module load time) is evaluated.
const envFile =
  process.env.NODE_ENV === 'production'
    ? '.env.production'
    : process.env.NODE_ENV === 'development'
      ? '.env.development'
      : '.env';

dotenv.config({ path: path.resolve(process.cwd(), envFile) });
