import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import * as fs from 'fs';
import * as path from 'path';

@Injectable()
export class CleanupService {
  private readonly logger = new Logger(CleanupService.name);
  private readonly downloadsDir = path.join(process.cwd(), 'downloads');

  @Cron(CronExpression.EVERY_MINUTE)
  handleCron() {
    this.logger.log('Iniciando tarefa de limpeza da pasta de downloads...');

    fs.readdir(this.downloadsDir, (err, files) => {
      if (err) {
        this.logger.error('Não foi possível ler a pasta de downloads', err);
        return;
      }

      if (files.length === 0) {
        this.logger.log('Nenhum arquivo para limpar.');
        return;
      }

      files.forEach((file) => {
        const filePath = path.join(this.downloadsDir, file);

        fs.stat(filePath, (err, stats) => {
          if (err) {
            this.logger.error(
              `Não foi possível obter informações do arquivo ${file}`,
              err,
            );
            return;
          }

          const now = new Date().getTime();
          const fileAgeInMinutes =
            (now - new Date(stats.mtime).getTime()) / 60000;

          // Apaga arquivos com mais de 10 minutos
          if (fileAgeInMinutes > 5) {
            fs.unlink(filePath, (err) => {
              if (err) {
                this.logger.error(`Falha ao deletar o arquivo ${file}`, err);
              } else {
                this.logger.log(`Arquivo órfão deletado: ${file}`);
              }
            });
          }
        });
      });
    });
  }
}