// src/download/download.gateway.ts
import {
  OnGatewayConnection,
  OnGatewayDisconnect,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';

@WebSocketGateway({ cors: { origin: '*' } }) // Permite conexões de qualquer origem
export class DownloadGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server: Server;

  handleConnection(client: Socket, ...args: any[]) {
    console.log(`Cliente conectado: ${client.id}`);
  }

  handleDisconnect(client: Socket) {
    console.log(`Cliente desconectado: ${client.id}`);
  }

  sendProgressUpdate(socketId: string, progress: any) {
    this.server.to(socketId).emit('download-progress', progress);
  }
  
  sendDownloadComplete(socketId: string, link: string, fileName: string) {
    this.server.to(socketId).emit('download-complete', {
      downloadLink: link,
      fileName: fileName,
    });
  }
  sendDownloadError(socketId: string, error: string) {
    this.server.to(socketId).emit('download-error', { error });
  }
}