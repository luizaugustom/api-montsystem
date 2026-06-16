import { Injectable, Logger } from '@nestjs/common';
import { Resend } from 'resend';
import * as fs from 'fs/promises';
import { IntegrationsStorage, ResendConfig } from '../../modules/integrations/integrations-storage';

export interface ResendAttachment {
  filename: string;
  content: Buffer;
}

export interface ResendEmailOptions {
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
  attachments?: ResendAttachment[];
  replyTo?: string;
}

@Injectable()
export class ResendService {
  private readonly logger = new Logger(ResendService.name);
  private client: Resend | null = null;
  private currentKey: string | null = null;

  constructor(private storage: IntegrationsStorage) {
    this.refresh();
  }

  /**
   * Recarrega o cliente Resend a partir da config persistida. Chamado após salvar em /integrations.
   */
  refresh() {
    const cfg = this.storage.getOne('resend');
    if (cfg.apiKey && cfg.apiKey !== this.currentKey) {
      this.client = new Resend(cfg.apiKey);
      this.currentKey = cfg.apiKey;
    } else if (!cfg.apiKey) {
      this.client = null;
      this.currentKey = null;
    }
  }

  isConfigured(): boolean {
    return !!this.client;
  }

  getConfig(): ResendConfig {
    return this.storage.getOne('resend');
  }

  /**
   * Envia email. Anexos vêm do disco (path) ou buffer.
   */
  async send(options: ResendEmailOptions): Promise<{ id: string | null; ok: boolean; error?: string }> {
    if (!this.client) {
      return { id: null, ok: false, error: 'Resend não configurado (defina RESEND_API_KEY em /integracoes)' };
    }
    try {
      const cfg = this.getConfig();
      const attachments = options.attachments && options.attachments.length > 0
        ? options.attachments.map((a) => ({
            filename: a.filename,
            content: a.content,
          }))
        : undefined;

      const res = await this.client.emails.send({
        from: cfg.from,
        to: Array.isArray(options.to) ? options.to : [options.to],
        subject: options.subject,
        html: options.html,
        text: options.text,
        replyTo: options.replyTo,
        attachments: attachments as any,
      });

      if (res.error) {
        this.logger.error(`Resend error: ${res.error.message}`);
        return { id: null, ok: false, error: res.error.message };
      }

      this.logger.log(`Email enviado: ${options.subject} → ${Array.isArray(options.to) ? options.to.join(',') : options.to} (id: ${res.data?.id})`);
      return { id: res.data?.id || null, ok: true };
    } catch (e: any) {
      this.logger.error(`Falha ao enviar email: ${e?.message || e}`);
      return { id: null, ok: false, error: e?.message || String(e) };
    }
  }

  /**
   * Lê arquivo do disco e envia como anexo.
   */
  async sendWithFileAttachment(opts: {
    to: string | string[];
    subject: string;
    html: string;
    attachments: Array<{ filename: string; path: string }>;
  }): Promise<{ id: string | null; ok: boolean; error?: string }> {
    const attachments: ResendAttachment[] = [];
    for (const a of opts.attachments) {
      try {
        const content = await fs.readFile(a.path);
        attachments.push({ filename: a.filename, content });
      } catch (e: any) {
        this.logger.warn(`Anexo não encontrado: ${a.path} (${e?.message})`);
      }
    }
    return this.send({ to: opts.to, subject: opts.subject, html: opts.html, attachments });
  }

  /**
   * Envia email de teste para validar configuração.
   */
  async sendTestEmail(to: string): Promise<{ ok: boolean; error?: string }> {
    const cfg = this.getConfig();
    return this.send({
      to,
      subject: 'Teste de Conexão - Mont System',
      html: `
        <h2>Teste de Conexão - Mont System</h2>
        <p>Este é um email de teste do sistema Mont System.</p>
        <p><strong>Remetente:</strong> ${cfg.from}</p>
        <p><strong>Data/Hora:</strong> ${new Date().toLocaleString('pt-BR')}</p>
        <p>Se você recebeu este email, a integração com Resend está funcionando corretamente!</p>
      `,
    });
  }
}
