import { Injectable, Logger } from '@nestjs/common';
import { S3Client, DeleteObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { Upload } from '@aws-sdk/lib-storage';
import { randomUUID } from 'crypto';

/**
 * Serviço de storage no DigitalOcean Spaces (S3-compatível).
 *
 * Lê credenciais e configuração das envs:
 *  - DO_SPACES_REGION (ex.: nyc3)
 *  - DO_SPACES_ENDPOINT (ex.: https://nyc3.digitaloceanspaces.com)
 *  - DO_SPACES_BUCKET
 *  - DO_SPACES_ACCESS_KEY_ID
 *  - DO_SPACES_SECRET_ACCESS_KEY
 *  - DO_SPACES_PUBLIC_URL (URL pública/CDN para servir os arquivos; ex.: https://bucket.region.digitaloceanspaces.com)
 *  - DO_SPACES_KEY_PREFIX (prefixo comum; default: 'tickets')
 *
 * Se as credenciais não estiverem configuradas, o serviço entra em modo
 * "desabilitado" — `isConfigured()` retorna `false` e `uploadFiles` retorna
 * `[]`. O caller deve verificar `isConfigured()` antes de tentar subir.
 */
@Injectable()
export class SpacesService {
  private readonly logger = new Logger(SpacesService.name);
  private client: S3Client | null = null;
  private readonly bucket: string;
  private readonly publicUrl: string;
  private readonly keyPrefix: string;
  private readonly region: string;
  private readonly endpoint: string;

  constructor() {
    this.region = process.env.DO_SPACES_REGION || '';
    this.endpoint = process.env.DO_SPACES_ENDPOINT || '';
    this.bucket = process.env.DO_SPACES_BUCKET || '';
    this.publicUrl = (process.env.DO_SPACES_PUBLIC_URL || '').replace(/\/$/, '');
    this.keyPrefix = (process.env.DO_SPACES_KEY_PREFIX || 'tickets').replace(/^\/|\/$/g, '');

    if (this.isConfigured()) {
      this.client = new S3Client({
        region: this.region,
        endpoint: this.endpoint,
        forcePathStyle: false,
        credentials: {
          accessKeyId: process.env.DO_SPACES_ACCESS_KEY_ID || '',
          secretAccessKey: process.env.DO_SPACES_SECRET_ACCESS_KEY || '',
        },
      });
      this.logger.log(`SpacesService configurado para bucket=${this.bucket} endpoint=${this.endpoint} prefix=${this.keyPrefix}`);
    } else {
      this.logger.warn(
        'SpacesService NÃO configurado (DO_SPACES_* ausentes). Uploads de anexos serão ignorados.',
      );
    }
  }

  isConfigured(): boolean {
    return Boolean(
      this.bucket &&
        this.publicUrl &&
        process.env.DO_SPACES_ACCESS_KEY_ID &&
        process.env.DO_SPACES_SECRET_ACCESS_KEY &&
        this.region &&
        this.endpoint,
    );
  }

  /**
   * Faz upload de um ou mais arquivos e retorna as URLs públicas correspondentes.
   * Retorna array vazio se o serviço não estiver configurado.
   */
  async uploadFiles(
    files: Express.Multer.File[],
    subfolder: string = 'attachments',
  ): Promise<string[]> {
    if (!files || files.length === 0) return [];
    if (!this.client) {
      this.logger.warn('uploadFiles chamado com SpacesService desabilitado; retornando []');
      return [];
    }

    const urls: string[] = [];
    for (const file of files) {
      const safeName = this.slugify(file.originalname);
      const key = `${this.keyPrefix}/${subfolder}/${randomUUID()}-${safeName}`;
      try {
        const upload = new Upload({
          client: this.client,
          params: {
            Bucket: this.bucket,
            Key: key,
            Body: file.buffer,
            ContentType: file.mimetype || 'application/octet-stream',
            ACL: 'public-read',
          },
        });
        await upload.done();
        urls.push(this.publicUrlFor(key));
      } catch (err: any) {
        this.logger.error(`Falha ao subir ${file.originalname} para Spaces: ${err?.message ?? err}`);
        throw err;
      }
    }
    return urls;
  }

  /**
   * Constrói a URL pública para uma key completa (incluindo o keyPrefix).
   */
  publicUrlFor(key: string): string {
    if (!this.publicUrl) return key;
    return `${this.publicUrl}/${key.replace(/^\//, '')}`;
  }

  /**
   * Remove um objeto do Spaces a partir de uma URL pública ou de uma key.
   */
  async deleteFile(urlOrKey: string): Promise<void> {
    if (!this.client) return;
    const key = this.extractKey(urlOrKey);
    if (!key) return;
    try {
      await this.client.send(
        new DeleteObjectCommand({ Bucket: this.bucket, Key: key }),
      );
    } catch (err: any) {
      this.logger.warn(`Falha ao deletar ${key} do Spaces: ${err?.message ?? err}`);
    }
  }

  /**
   * NO-OP mantido para paridade futura. Não é chamado pelo fluxo atual.
   */
  async getObjectBuffer(_urlOrKey: string): Promise<Buffer | null> {
    if (!this.client) return null;
    return null;
  }

  private extractKey(urlOrKey: string): string {
    if (!urlOrKey) return '';
    if (urlOrKey.startsWith('http')) {
      const idx = urlOrKey.indexOf(this.keyPrefix);
      if (idx === -1) return '';
      return urlOrKey.substring(idx);
    }
    return urlOrKey.replace(/^\//, '');
  }

  private slugify(name: string): string {
    return name
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/[^a-zA-Z0-9._-]+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 80) || 'file';
  }
}
