import { InjectQueue } from '@nestjs/bull';
import { Injectable, OnApplicationBootstrap } from '@nestjs/common';
import { AppLogger } from '@plys/libraries/common-nest/modules/logger';
import { RequestContextService } from '@plys/libraries/common-nest/modules/request-context/request-context.service';
import { Queue } from 'bull';

import {
  HOUSEKEEPING_JOBS,
  HOUSEKEEPING_QUEUE,
  HOUSEKEEPING_SCHEDULES,
} from './housekeeping.constants';

// Common Bull options for every housekeeping job.
//   - jobId is fixed per job name so Bull dedupes if a deploy double-registers
//     between `removeRepeatableByKey` and `add`. Two replicas hitting boot at
//     the same time would both publish the same repeatable definition, but the
//     fixed id collapses them to one.
//   - removeOnComplete trims completed jobs aggressively — we only care about
//     the structured logs.
//   - removeOnFail keeps a small failure tail visible in the Bull UI / API for
//     ops triage.
//   - 3 attempts with exponential backoff: a transient Postgres / Redis blip
//     shouldn't cause the cron to skip a tick.
const COMMON_JOB_OPTS = {
  attempts: 3,
  backoff: { type: 'exponential', delay: 5000 },
  removeOnComplete: 50,
  removeOnFail: 50,
} as const;

// Registers every entry from HOUSEKEEPING_SCHEDULES as a repeatable Bull job
// at boot. Idempotent: existing repeatable definitions are wiped first so a
// cadence change in code reaches the queue on the next deploy without manual
// flushes.
@Injectable()
export class HousekeepingScheduler implements OnApplicationBootstrap {
  private readonly logger: AppLogger;

  constructor(
    @InjectQueue(HOUSEKEEPING_QUEUE) private readonly queue: Queue,
    requestContext: RequestContextService,
  ) {
    this.logger = new AppLogger(HousekeepingScheduler.name, requestContext);
  }

  public async onApplicationBootstrap(): Promise<void> {
    try {
      const existing = await this.queue.getRepeatableJobs();
      for (const entry of existing) {
        await this.queue.removeRepeatableByKey(entry.key);
      }
      this.logger.log(
        `[system] housekeeping — repeatable jobs cleared | count: ${existing.length}`,
      );

      for (const [jobName, schedule] of Object.entries(HOUSEKEEPING_SCHEDULES)) {
        // Bull's `repeat` type is a discriminated union (CronRepeatOptions
        // | EveryRepeatOptions); narrow at the call site so we don't pass
        // a partial of both keys.
        const repeat =
          schedule.cron !== undefined
            ? { cron: schedule.cron }
            : schedule.every !== undefined
              ? { every: schedule.every }
              : null;
        if (!repeat) {
          this.logger.warn(`[system] housekeeping — skipped (no schedule) | job: ${jobName}`);
          continue;
        }
        await this.queue.add(jobName, {}, { repeat, ...COMMON_JOB_OPTS });
        this.logger.log(
          `[system] housekeeping — registered | job: ${jobName}, ` +
            `${'cron' in repeat ? `cron: ${repeat.cron}` : `every: ${repeat.every}ms`}`,
        );
      }
    } catch (err) {
      // Boot failure here would prevent every housekeeping job from running.
      // Log loudly and rethrow so the orchestrator can restart instead of
      // silently shipping a half-wired worker.
      this.logger.error(
        `[system] housekeeping — registration failed | error: ${(err as Error).message}`,
      );
      throw err;
    }
  }
}

// Sanity check — exported only so the constants module's keys stay in sync
// with the processor's @Process names. Importing this constant from the
// processor file would create a cycle; the test-friendly export sits here.
export const REGISTERED_JOB_NAMES: readonly string[] = Object.values(HOUSEKEEPING_JOBS);
