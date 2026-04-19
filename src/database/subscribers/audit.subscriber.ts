import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import {
  DataSource,
  EntitySubscriberInterface,
  EventSubscriber,
  InsertEvent,
  SoftRemoveEvent,
  UpdateEvent,
} from 'typeorm';

import { RequestContextService } from '@common/modules/request-context/request-context.service';
import { AuditableEntity } from '@database/entities/base/auditable.entity';
import { TraceableEntity } from '@database/entities/base/traceable.entity';

// Populates created_by / updated_by / deleted_by on every entity that extends
// AuditableEntity (full audit) or TraceableEntity (creation-only trace).
// Pulls the userId from RequestContextService — which is ambient via AsyncLocalStorage,
// so service code never has to pass it explicitly.
//
// Nullable columns tolerate system-level operations (migrations, seeds, cron, webhooks)
// that run outside any HTTP request — in those cases the context is absent and the
// *_by columns stay null, which is the correct signal for "system".
@Injectable()
@EventSubscriber()
export class AuditSubscriber implements EntitySubscriberInterface {
  constructor(
    @InjectDataSource() dataSource: DataSource,
    private readonly requestContext: RequestContextService,
  ) {
    dataSource.subscribers.push(this);
  }

  public beforeInsert(event: InsertEvent<unknown>): void {
    const userId = this.requestContext.userId;
    if (userId === null) {
      return;
    }
    const entity = event.entity as Partial<AuditableEntity | TraceableEntity> | undefined;
    if (!entity) {
      return;
    }
    if (this.extendsAuditable(entity) || this.extendsTraceable(entity)) {
      entity.createdBy = userId;
    }
  }

  public beforeUpdate(event: UpdateEvent<unknown>): void {
    const userId = this.requestContext.userId;
    if (userId === null) {
      return;
    }
    const entity = event.entity as Partial<AuditableEntity> | undefined;
    if (!entity) {
      return;
    }
    if (this.extendsAuditable(entity)) {
      entity.updatedBy = userId;
    }
  }

  public beforeSoftRemove(event: SoftRemoveEvent<unknown>): void {
    const userId = this.requestContext.userId;
    if (userId === null) {
      return;
    }
    const entity = event.entity as Partial<AuditableEntity> | undefined;
    if (!entity) {
      return;
    }
    if (this.extendsAuditable(entity)) {
      entity.deletedBy = userId;
    }
  }

  private extendsAuditable(entity: object): entity is Partial<AuditableEntity> {
    return 'createdBy' in entity && 'updatedBy' in entity && 'deletedBy' in entity;
  }

  private extendsTraceable(entity: object): entity is Partial<TraceableEntity> {
    return 'createdBy' in entity;
  }
}
