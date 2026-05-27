import { Injectable } from '@nestjs/common';
import { InjectEntityManager } from '@nestjs/typeorm';
import { AbstractRepository } from '@plys/libraries/common-nest/repositories';
import { AiProviderApiKey } from '@plys/libraries/database/entities';
import { EntityManager } from 'typeorm';

import { IAiProviderApiKeyRepository } from './interfaces';

@Injectable()
export class AiProviderApiKeyRepository
  extends AbstractRepository<AiProviderApiKey>
  implements IAiProviderApiKeyRepository
{
  constructor(
    @InjectEntityManager()
    manager: EntityManager,
  ) {
    super(AiProviderApiKey, manager);
  }

  public withManager(manager: EntityManager): this {
    return new AiProviderApiKeyRepository(manager) as this;
  }
}
