export class DownloadVideoDto {
  metadataId: string;
  socketId: string;
  format: 'video' | 'audio';
  quality: string; // formatId
}
