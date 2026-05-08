import { AbstractRepository } from '@common/repositories';
import { ChatMessage } from '@database/entities';
import { Injectable } from '@nestjs/common';
import { InjectEntityManager } from '@nestjs/typeorm';
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
