import { AbstractRepository } from '@common/repositories';
import { InterviewAnswer } from '@database/entities';
import { Injectable } from '@nestjs/common';
import { InjectEntityManager } from '@nestjs/typeorm';
import { EntityManager } from 'typeorm';

import { IInterviewAnswerRepository } from './interfaces';

@Injectable()
export class InterviewAnswerRepository
  extends AbstractRepository<InterviewAnswer>
  implements IInterviewAnswerRepository
{
  constructor(
    @InjectEntityManager()
    manager: EntityManager,
  ) {
    super(InterviewAnswer, manager);
  }

  public withManager(manager: EntityManager): this {
    return new InterviewAnswerRepository(manager) as this;
  }
}
