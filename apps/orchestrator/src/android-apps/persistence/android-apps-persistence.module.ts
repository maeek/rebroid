import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AndroidApplication } from '../android-application.entity';
import { AndroidApplicationsRepository } from './android-applications.repository';

@Module({
  imports: [TypeOrmModule.forFeature([AndroidApplication])],
  providers: [AndroidApplicationsRepository],
  exports: [AndroidApplicationsRepository],
})
export class AndroidAppsPersistenceModule {}
