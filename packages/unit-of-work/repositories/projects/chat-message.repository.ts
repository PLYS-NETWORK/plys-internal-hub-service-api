import { Injectable } from '@nestjs/common';
import { InjectEntityManager } from '@nestjs/typeorm';
import { AbstractRepository } from '@plys/libraries/common-nest/repositories';
import { ChatMessage } from '@plys/libraries/database/entities';
import { EntityManager } from 'typeorm';

import { IChatMessageRepository } from './interfaces';

@Injectable()
export class ChatMessageRepository
  extends AbstractRepository<ChatMessage>
  implements IChatMessageRepository
{
  constructor(
    @InjectEntityManager()
    manager: EntityManager,
  ) {
    super(ChatMessage, manager);
  }

  public withManager(manager: EntityManager): this {
    return new ChatMessageRepository(manager) as this;
  }
}
