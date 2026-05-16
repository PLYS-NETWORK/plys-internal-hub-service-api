import { AbstractRepository } from '@common/repositories';
import { User } from '@database/entities';
import { ActivePlatform, UserRole } from '@database/enums';
import { Injectable } from '@nestjs/common';
import { InjectEntityManager } from '@nestjs/typeorm';
import { EntityManager } from 'typeorm';

import {
  GrowthTrendGranularity,
  INewUsersTrendPoint,
  IUserRepository,
  IUsersPlatformStatusBreakdown,
  IUsersStatusCounts,
} from './interfaces';

const ZERO_USERS_COUNTS: IUsersStatusCounts = { total: 0, active_30d: 0, unverified: 0, banned: 0 };

@Injectable()
export class UserRepository extends AbstractRepository<User> implements IUserRepository {
  constructor(
    @InjectEntityManager()
    manager: EntityManager,
  ) {
    super(User, manager);
  }

  public withManager(manager: EntityManager): this {
    return new UserRepository(manager) as this;
  }

  public async findUserByEmailAndPlatform(
    email: string,
    platform: ActivePlatform,
  ): Promise<User | null> {
    return this.createQueryBuilder('u')
      .where('LOWER(u.email) = LOWER(:email)', { email })
      .andWhere('u.platform = :platform', { platform })
      .getOne();
  }

  /** @inheritdoc */
  public async findActiveAdminUserIds(): Promise<string[]> {
    const rows = await this.createQueryBuilder('u')
      .select('u.id')
      .where('u.role = :role', { role: UserRole.ADMIN_PLATFORM })
      .andWhere('u.is_active = true')
      .getRawMany<{ u_id: string }>();
    return rows.map((r) => r.u_id);
  }

  /** @inheritdoc */
  public async countByPlatformGroupedByStatus(): Promise<IUsersPlatformStatusBreakdown> {
    // Conditional aggregates in a single round-trip. The four metrics overlap
    // (a banned user is also counted in `total`) — that's intentional, the
    // dashboard renders them as independent badges, not stacked segments.
    const rows = await this.createQueryBuilder('u')
      .select('u.platform', 'platform')
      .addSelect('COUNT(*)::int', 'total')
      .addSelect(
        `COUNT(*) FILTER (WHERE u.is_active = true AND u.banned_at IS NULL AND u.last_login_at >= NOW() - INTERVAL '30 days')::int`,
        'active_30d',
      )
      .addSelect(`COUNT(*) FILTER (WHERE u.is_email_verified = false)::int`, 'unverified')
      .addSelect(`COUNT(*) FILTER (WHERE u.banned_at IS NOT NULL)::int`, 'banned')
      .where('u.platform IN (:...platforms)', {
        platforms: [ActivePlatform.BUSINESS, ActivePlatform.CONSULTANT],
      })
      .groupBy('u.platform')
      .getRawMany<{
        platform: ActivePlatform;
        total: number;
        active_30d: number;
        unverified: number;
        banned: number;
      }>();

    const result: IUsersPlatformStatusBreakdown = {
      business: { ...ZERO_USERS_COUNTS },
      consultant: { ...ZERO_USERS_COUNTS },
    };
    for (const r of rows) {
      const bucket: IUsersStatusCounts = {
        total: Number(r.total),
        active_30d: Number(r.active_30d),
        unverified: Number(r.unverified),
        banned: Number(r.banned),
      };
      if (r.platform === ActivePlatform.BUSINESS) result.business = bucket;
      else if (r.platform === ActivePlatform.CONSULTANT) result.consultant = bucket;
    }
    return result;
  }

  /** @inheritdoc */
  public async countNewByPlatformBetween(
    from: Date,
    to: Date,
  ): Promise<{ business: number; consultant: number }> {
    const rows = await this.createQueryBuilder('u')
      .select('u.platform', 'platform')
      .addSelect('COUNT(*)::int', 'count')
      .where('u.platform IN (:...platforms)', {
        platforms: [ActivePlatform.BUSINESS, ActivePlatform.CONSULTANT],
      })
      .andWhere('u.created_at >= :from', { from })
      .andWhere('u.created_at <= :to', { to })
      .groupBy('u.platform')
      .getRawMany<{ platform: ActivePlatform; count: number }>();

    const result = { business: 0, consultant: 0 };
    for (const r of rows) {
      if (r.platform === ActivePlatform.BUSINESS) result.business = Number(r.count);
      else if (r.platform === ActivePlatform.CONSULTANT) result.consultant = Number(r.count);
    }
    return result;
  }

  /** @inheritdoc */
  public async countNewByPlatformGroupedByPeriod(
    from: Date,
    to: Date,
    granularity: GrowthTrendGranularity,
  ): Promise<INewUsersTrendPoint[]> {
    const periodExpr =
      granularity === 'week'
        ? `to_char(u.created_at, 'IYYY-IW')`
        : `to_char(date_trunc('month', u.created_at), 'YYYY-MM')`;

    const rows = await this.createQueryBuilder('u')
      .select(periodExpr, 'period_label')
      .addSelect('u.platform', 'platform')
      .addSelect('COUNT(*)::int', 'count')
      .where('u.platform IN (:...platforms)', {
        platforms: [ActivePlatform.BUSINESS, ActivePlatform.CONSULTANT],
      })
      .andWhere('u.created_at >= :from', { from })
      .andWhere('u.created_at <= :to', { to })
      .groupBy('period_label')
      .addGroupBy('u.platform')
      .orderBy('period_label', 'ASC')
      .addOrderBy('u.platform', 'ASC')
      .getRawMany<{ period_label: string; platform: ActivePlatform; count: number }>();

    return rows.map((r) => ({
      period_label: r.period_label,
      platform: r.platform,
      count: Number(r.count),
    }));
  }
}
