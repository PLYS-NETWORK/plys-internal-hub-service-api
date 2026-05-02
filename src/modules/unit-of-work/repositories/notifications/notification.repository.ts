import { AbstractRepository } from '@common/repositories';
import { Notification } from '@database/entities';
import { Injectable } from '@nestjs/common';
import { InjectEntityManager } from '@nestjs/typeorm';
import { EntityManager } from 'typeorm';

import { IListByUserCursorInput, INotificationRepository } from './interfaces';

@Injectable()
export class NotificationRepository
  extends AbstractRepository<Notification>
  implements INotificationRepository
{
  constructor(
    @InjectEntityManager()
    manager: EntityManager,
  ) {
    super(Notification, manager);
  }

  public withManager(manager: EntityManager): this {
    return new NotificationRepository(manager) as this;
  }

  /** @inheritdoc */
  public async listByUserCursor(input: IListByUserCursorInput): Promise<Notification[]> {
    const qb = this.repository
      .createQueryBuilder('n')
      .where('n.user_id = :userId', { userId: input.userId })
      .orderBy('n.created_at', 'DESC')
      .addOrderBy('n.id', 'DESC')
      .limit(input.take + 1);

    if (input.unreadOnly === true) {
      qb.andWhere('n.is_read = false');
    }

    if (input.cursor) {
      // Keyset pagination on (created_at, id) — strictly less than the cursor pair.
      qb.andWhere('(n.created_at, n.id) < (:cursorCreatedAt, :cursorId)', {
        cursorCreatedAt: input.cursor.createdAt,
        cursorId: input.cursor.id,
      });
    }

    return qb.getMany();
  }

  /** @inheritdoc */
  public async countUnreadByUserId(userId: string): Promise<number> {
    return this.repository.count({ where: { userId, isRead: false } });
  }

  /** @inheritdoc */
  public async markRead(userId: string, notificationId: string): Promise<boolean> {
    // Conditional UPDATE — affected count tells us whether this was a real
    // false→true transition (so the caller can decrement Redis only when needed).
    const result = await this.repository
      .createQueryBuilder()
      .update(Notification)
      .set({ isRead: true, readAt: () => 'now()' })
      .where('id = :id AND user_id = :userId AND is_read = false', {
        id: notificationId,
        userId,
      })
      .execute();
    return (result.affected ?? 0) > 0;
  }

  /** @inheritdoc */
  public async markAllRead(userId: string): Promise<number> {
    const result = await this.repository
      .createQueryBuilder()
      .update(Notification)
      .set({ isRead: true, readAt: () => 'now()' })
      .where('user_id = :userId AND is_read = false', { userId })
      .execute();
    return result.affected ?? 0;
  }
}
