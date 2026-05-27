import { Module } from '@nestjs/common';
import { UnitOfWorkModule } from '@plys/libraries/unit-of-work/unit-of-work.module';

import { UsersService } from './users.service';

@Module({
  imports: [UnitOfWorkModule],
  controllers: [],
  providers: [UsersService],
  exports: [UsersService],
})
export class UsersModule {}
