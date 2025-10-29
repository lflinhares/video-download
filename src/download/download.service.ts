import { InjectQueue } from '@nestjs/bull';
import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
  PayloadTooLargeException,
} from '@nestjs/common';
import type { Queue } from 'bull';
import { spawn } from 'child_process';
import { v4 as uuidv4 } from 'uuid';
import Redis from 'ioredis';
import { DownloadVideoDto } from './dto/download-video.dto';

const MAX_FILE_SIZE_BYTES = (1 * 1024 * 1024 * 1024) / 6;

@Injectable()
export class DownloadService {
  private readonly redis: Redis;

  constructor(@InjectQueue('download') private readonly downloadQueue: Queue) {
    this.redis = this.downloadQueue.client;
  }

  async getWaitingJobs() {
    return this.downloadQueue.getWaiting();
  }

  async getVideoFormats(videoUrl: string) {
    const metadata = await this.getVideoMetadata(videoUrl);

    const availableFormats: {
      videos: Array<{
        formatId: string;
        quality: string;
        resolution: string;
        sizeMB: string;
      }>;
      audios: Array<{
        formatId: string;
        quality: string;
        sizeMB: string;
      }>;
    } = {
      videos: [],
      audios: [],
    };

    if (metadata && metadata.formats) {
      metadata.formats.forEach((format) => {
        if (!format.filesize || format.filesize > MAX_FILE_SIZE_BYTES) {
          return;
        }

        if (
          format.vcodec !== 'none' &&
          format.acodec !== 'none' &&
          format.ext === 'mp4'
        ) {
          availableFormats.videos.push({
            formatId: format.format_id,
            quality: format.format_note,
            resolution: format.resolution,
            sizeMB: (format.filesize / 1024 / 1024).toFixed(2),
          });
        }

        if (
          format.vcodec === 'none' &&
          format.acodec !== 'none' &&
          format.ext === 'm4a'
        ) {
          availableFormats.audios.push({
            formatId: format.format_id,
            quality: `${format.abr}kbps`,
            sizeMB: (format.filesize / 1024 / 1024).toFixed(2),
          });
        }
      });
    }

    if (
      availableFormats.videos.length === 0 &&
      availableFormats.audios.length === 0
    ) {
      throw new PayloadTooLargeException(
        `Todos os formatos disponíveis para este vídeo excedem o limite de ${MAX_FILE_SIZE_BYTES / 1024 / 1024} MB.`,
      );
    }

    const metadataId = uuidv4();

    await this.redis.set(
      `metadata:${metadataId}`,
      JSON.stringify(metadata),
      'EX',
      600,
    );

    return {
      title: metadata.title,
      thumbnail: metadata.thumbnail,
      formats: availableFormats,
      metadataId: metadataId,
    };
  }

  private async getVideoMetadata(videoUrl: string): Promise<any> {
    return new Promise((resolve, reject) => {
      const args = ['--no-playlist', '--dump-json', videoUrl];

      console.log('Tentando executar spawn("yt-dlp", ...)');
      const ytDlpProcess = spawn('yt-dlp', args);

      ytDlpProcess.on('error', (err) => {
        console.error('!!! FALHA AO INICIAR O PROCESSO SPAWN !!!', err);
        if (err.message.includes('ENOENT')) {
          return reject(
            new InternalServerErrorException(
              'Comando "yt-dlp" não encontrado no ambiente do servidor.',
            ),
          );
        }
        return reject(
          new InternalServerErrorException(
            'Erro desconhecido ao iniciar o processo de validação.',
          ),
        );
      });

      let jsonData = '';
      let errorData = '';

      ytDlpProcess.stdout.on('data', (data) => (jsonData += data.toString()));
      ytDlpProcess.stderr.on('data', (data) => (errorData += data.toString()));

      ytDlpProcess.on('close', (code) => {
        // Se o processo já deu erro ao iniciar, não fazemos mais nada.
        if (ytDlpProcess.killed) return;

        if (code !== 0) {
          console.error(
            `yt-dlp (metadata) falhou com código ${code}: ${errorData}`,
          );
          return reject(
            new InternalServerErrorException(
              'Não foi possível buscar os metados do vídeo.',
            ),
          );
        }
        try {
          const metadata = JSON.parse(jsonData);
          resolve(metadata);
        } catch (e) {
          reject(
            new InternalServerErrorException(
              'Falha ao parsear os metadados do vídeo.',
            ),
          );
        }
      });
    });
  }

  async addJob(
    downloadVideoDto: DownloadVideoDto,
  ): Promise<{ job: any; position: number }> {
    const { metadataId, quality: formatId } = downloadVideoDto;

    if (!metadataId) {
      throw new BadRequestException('O ID dos metadados é obrigatório.');
    }

    const metadataString = await this.redis.get(`metadata:${metadataId}`);
    if (!metadataString) {
      throw new NotFoundException(
        'Os metadados expiraram ou são inválidos. Por favor, busque as opções novamente.',
      );
    }

    const metadata = JSON.parse(metadataString);

    const fileSize = metadata.filesize || metadata.filesize_approx;

    const chosenFormat = metadata.formats.find((f) => f.format_id === formatId);
    if (
      !chosenFormat ||
      !chosenFormat.filesize ||
      chosenFormat.filesize > MAX_FILE_SIZE_BYTES
    ) {
      throw new PayloadTooLargeException(
        'O formato selecionado excede o limite de tamanho.',
      );
    }
    const waitingCount = await this.downloadQueue.getWaitingCount();

    const positionInQueue = waitingCount + 1;

    console.log(
      `Jobs em espera: ${waitingCount}. Nova posição: ${positionInQueue}.`,
    );

    const job = await this.downloadQueue.add({
      ...downloadVideoDto,
      metadata,
    });

    return { job, position: positionInQueue };
  }
}
