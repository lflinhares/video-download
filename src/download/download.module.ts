import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';
import { DownloadController } from './download.controller';
import { DownloadGateway } from './download.gateway';
import { DownloadService } from './download.service';
import { DownloadProcessor } from './download.processor';
import { CleanupService } from './cleanup.service';

@Module({
  imports: [
    BullModule.registerQueue({
      name: 'download',
      redis: {
        host: process.env.REDIS_HOST || 'localhost',
        port: parseInt(process.env.REDIS_PORT || '6379', 10) || 6379,
      },
    }),
  ],
  controllers: [DownloadController],
  providers: [
    DownloadGateway,
    DownloadService,
    DownloadProcessor,
    CleanupService, 
  ],
})
export class DownloadModule {}
