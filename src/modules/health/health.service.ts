import { AppLogger } from '@common/modules/logger';
import { RedisService } from '@common/modules/redis/redis.service';
import { RequestContextService } from '@common/modules/request-context/request-context.service';
import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { plainToInstance } from 'class-transformer';
import { DataSource } from 'typeorm';

import { HealthResponseDto } from './dto/responses/health-response.dto';
import { HealthStatus } from './dto/responses/health-response.response.interface';
import { IHealthService } from './interfaces/health.service.interface';

@Injectable()
export class HealthService implements IHealthService {
  private readonly logger: AppLogger;

  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly redis: RedisService,
    private readonly requestContext: RequestContextService,
  ) {
    this.logger = new AppLogger(HealthService.name, requestContext);
  }

  /** @inheritdoc */
  public async check(): Promise<HealthResponseDto> {
    this.logger.log(`check — start`);

    const [database, redis] = await Promise.all([this.probeDatabase(), this.probeRedis()]);

    const status: HealthStatus = database === 'ok' && redis === 'ok' ? 'ok' : 'error';

    this.logger.log(`check — complete | status: ${status}, database: ${database}, redis: ${redis}`);

    return plainToInstance(
      HealthResponseDto,
      { status, database, redis },
      { excludeExtraneousValues: true },
    );
  }

  private async probeDatabase(): Promise<HealthStatus> {
    try {
      await this.dataSource.query('SELECT 1');
      return 'ok';
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.error(`check — database probe failed | error: ${message}`);
      return 'error';
    }
  }

  private async probeRedis(): Promise<HealthStatus> {
    try {
      await this.redis.ping();
      return 'ok';
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.error(`check — redis probe failed | error: ${message}`);
      return 'error';
    }
  }
}
