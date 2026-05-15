import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AndroidApplication } from '../android-apps/android-application.entity';

@Module({
  imports: [
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        type: 'sqlite',
        database: config.getOrThrow<string>('app.databasePath'),
        entities: [AndroidApplication],
        synchronize: config.get<string>('app.nodeEnv') !== 'production',
      }),
    }),
  ],
})
export class DatabaseModule {}
