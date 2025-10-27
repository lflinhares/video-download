import { InjectQueue } from '@nestjs/bull';
import {
  Injectable,
  InternalServerErrorException,
  PayloadTooLargeException,
} from '@nestjs/common';
import type { Queue } from 'bull';
import { spawn } from 'child_process';

interface DownloadVideoDto {
  video_url: string;
  socketId: string;
}
const MAX_FILE_SIZE_BYTES = (1 * 1024 * 1024 * 1024) / 6;

@Injectable()
export class DownloadService {
  constructor(@InjectQueue('download') private readonly downloadQueue: Queue) {}

  async getWaitingJobs() {
    return this.downloadQueue.getWaiting();
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

  async addJob(downloadVideoDto: DownloadVideoDto) {
    console.log(`Validando tamanho para: ${downloadVideoDto.video_url}`);

    const metadata = await this.getVideoMetadata(downloadVideoDto.video_url);
    const fileSize = metadata.filesize || metadata.filesize_approx;

    if (!fileSize || fileSize > MAX_FILE_SIZE_BYTES) {
      console.log(`Vídeo recusado. Tamanho: ${fileSize}`);
      throw new PayloadTooLargeException(
        `Vídeo muito grande. O limite é de ${
          MAX_FILE_SIZE_BYTES / 1024 / 1024
        } MB.`,
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
