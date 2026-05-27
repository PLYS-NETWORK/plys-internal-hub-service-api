import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { Test } from '@nestjs/testing';
import { EnvironmentsService } from '@plys/libraries/common-nest/modules/environments';
import { RequestContextService } from '@plys/libraries/common-nest/modules/request-context/request-context.service';
import { UnitOfWorkService } from '@plys/libraries/unit-of-work/unit-of-work.service';
import { randomBytes } from 'crypto';

import { AiProviderKeyService } from './ai-provider-key.service';
import { BffEnvelopeCipher } from './crypto/bff-envelope.cipher';
import { MasterKeyCipher } from './crypto/master-key.cipher';

function fakeKeyB64(): string {
  return randomBytes(32).toString('base64');
}

describe('AiProviderKeyService', () => {
  let service: AiProviderKeyService;

  beforeEach(async () => {
    const env = {
      aiKeysMaster: { currentVersion: 1, versions: { 1: fakeKeyB64() } },
      feBffSecrets: { currentVersion: 1, versions: { 1: fakeKeyB64() } },
    } as Partial<EnvironmentsService>;

    const moduleRef = await Test.createTestingModule({
      providers: [
        AiProviderKeyService,
        MasterKeyCipher,
        BffEnvelopeCipher,
        { provide: EnvironmentsService, useValue: env },
        { provide: RequestContextService, useValue: { requestId: 'test-req' } },
        {
          provide: UnitOfWorkService,
          useValue: {
            aiProviderApiKeys: {
              findOne: jest.fn(),
            },
          },
        },
      ],
    }).compile();

    service = moduleRef.get(AiProviderKeyService);
  });

  it('is registered as an injectable service', () => {
    expect(service).toBeDefined();
  });
});
