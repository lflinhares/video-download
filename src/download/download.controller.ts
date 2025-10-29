import {
  Body,
  Controller,
  Post,
  HttpCode,
  HttpStatus,
  InternalServerErrorException,
  Get,
  Query,
} from '@nestjs/common';
import { DownloadService } from './download.service';
import { DownloadGateway } from './download.gateway';
import { MetadataRequestDto } from './dto/metadata-request.dto';
import { DownloadVideoDto } from './dto/download-video.dto';

@Controller('download')
export class DownloadController {
  constructor(
    private readonly downloadService: DownloadService,
    private readonly downloadGateway: DownloadGateway,
  ) {}

  @Get('metadata')
  async getVideoMetadata(@Query() metadataRequestDto: MetadataRequestDto) {
    // A lógica de buscar os metadados já existe no nosso service!
    return this.downloadService.getVideoFormats(metadataRequestDto.video_url);
  }

  @Post()
  @HttpCode(HttpStatus.ACCEPTED)
  async addDownloadToQueue(@Body() downloadVideoDto: DownloadVideoDto) {
    try {
      const { job, position } =
        await this.downloadService.addJob(downloadVideoDto);

      const waitingJobs = await this.downloadService.getWaitingJobs();
      this.downloadGateway.broadcastQueueState(waitingJobs);

      return {
        message: 'Seu download foi adicionado à fila.',
        jobId: job.id,
        position: position,
      };
    } catch (error) {
      console.error('ERRO NO CONTROLLER:', error);

      throw new InternalServerErrorException(
        error.message || 'Erro interno ao processar o pedido.',
      );
    }
  }
}
