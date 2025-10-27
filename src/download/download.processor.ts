import { Process, Processor } from '@nestjs/bull';
import type { Job } from 'bull';
import { spawn } from 'child_process';
import { DownloadGateway } from './download.gateway';
import * as path from 'path';
import * as fs from 'fs';

interface DownloadJobData {
  video_url: string;
  socketId: string;
  metadata: any;
}

@Processor('download')
export class DownloadProcessor {
  constructor(private readonly downloadGateway: DownloadGateway) {}

  @Process()
  async handleDownload(job: Job<DownloadJobData>): Promise<void> {
    const { video_url, socketId, metadata } = job.data;
    console.log(`Iniciando download para o job ${job.id}: ${metadata.title}`);

    const downloadsDir = path.join(process.cwd(), 'downloads');
    if (!fs.existsSync(downloadsDir)) {
      fs.mkdirSync(downloadsDir);
    }

    const outputTemplate = path.join(
      downloadsDir,
      `${job.id} - %(title)s [%(id)s].%(ext)s`,
    );

    const cookieFile = path.join(process.cwd(), 'cookies.txt');

    return new Promise((resolve, reject) => {
      const args = [
        '--no-playlist',
        /* '--cookies', cookieFile, */
        '-o',
        outputTemplate,
        '--merge-output-format',
        'mp4',
        '-f',
        'bestvideo[ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]/best',
        '--progress',
        video_url,
      ];

      const ytDlpProcess = spawn('yt-dlp', args);
      let finalFilePath = '';

      ytDlpProcess.stdout.on('data', (data) => {
        const output = data.toString();
        console.log(output);

        const progressMatch = output.match(/\[download\]\s+([\d\.]+)%/);
        if (progressMatch && progressMatch[1]) {
          const progress = parseFloat(progressMatch[1]);
          this.downloadGateway.sendProgressUpdate(socketId, { progress });
        }

        const mergeMatch = output.match(
          /\[Merger\] Merging formats into "([^"]+)"/,
        );
        if (mergeMatch && mergeMatch[1]) {
          finalFilePath = mergeMatch[1];
        } else {
          const destMatch = output.match(/\[download\] Destination: (.*)/);
          if (destMatch && destMatch[1]) {
            finalFilePath = destMatch[1].trim();
          }
        }
      });

      ytDlpProcess.stderr.on('data', (data) =>
        console.error(`stderr: ${data}`),
      );

      ytDlpProcess.on('close', (code) => {
        if (code !== 0) {
          const errorMsg = `Download falhou com código ${code}`;
          console.error(errorMsg);
          this.downloadGateway.sendDownloadError(socketId, errorMsg);
          return reject(new Error(errorMsg));
        }

        const uniqueFileName = path.basename(finalFilePath);
        const cleanFileName = `${metadata.title}.mp4`;

        console.log(`Download completo: ${uniqueFileName}`);

        this.downloadGateway.sendDownloadComplete(
          socketId,
          `/downloads/${uniqueFileName}`,
          cleanFileName,
        );

        resolve();
      });

      ytDlpProcess.on('error', (err) => {
        console.error('Falha ao iniciar yt-dlp', err);
        this.downloadGateway.sendDownloadError(socketId, 'Erro no servidor.');
        reject(err);
      });
    });
  }
}
