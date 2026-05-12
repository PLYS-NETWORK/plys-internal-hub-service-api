import { EmailModule } from '@common/modules/email';
import { EnvironmentsModule } from '@common/modules/environments';
import { UnitOfWorkModule } from '@modules/unit-of-work/unit-of-work.module';
import { Module } from '@nestjs/common';

import { ContactController } from './contact.controller';
import { ContactService } from './contact.service';

@Module({
  imports: [UnitOfWorkModule, EmailModule, EnvironmentsModule],
  controllers: [ContactController],
  providers: [ContactService],
})
export class ContactModule {}
