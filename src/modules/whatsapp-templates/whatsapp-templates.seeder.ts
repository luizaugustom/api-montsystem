import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { WhatsappTemplatesRepository } from './whatsapp-templates.repository';
import { WhatsappTemplate } from './entities/whatsapp-template.entity';

const DEFAULT_TEMPLATES: Array<Pick<WhatsappTemplate, 'name' | 'text'>> = [
  // ── Avisos ────────────────────────────────────────────────────────────
  {
    name: 'Aviso · Manutenção programada',
    text: `Olá, {{nome}}! 👋

Informamos que o sistema passará por uma manutenção programada no dia {{data}} das {{hora_inicio}} às {{hora_fim}}.

Durante esse período, alguns serviços podem ficar indisponíveis temporariamente. Pedimos desculpas por qualquer transtorno.

Qualquer dúvida, estamos à disposição.
— Equipe Montsystem`,
  },
  {
    name: 'Aviso · Atualização disponível',
    text: `Oi, {{nome}}! Temos novidades 🎉

Acabamos de liberar uma nova atualização do sistema com melhorias em {{recurso}}.

Acesse {{link}} para conferir o que mudou.

— Equipe Montsystem`,
  },
  {
    name: 'Aviso · Comunicado importante',
    text: `Olá, {{nome}}.

Gostaríamos de comunicar uma novidade importante: {{mensagem}}.

Em caso de dúvidas, responda esta mensagem.

Atenciosamente,
Equipe Montsystem`,
  },
  {
    name: 'Aviso · Lembrete de compromisso',
    text: `Oi, {{nome}}! Tudo bem?

Passando para lembrar do seu compromisso em {{data}} às {{hora}}.

Qualquer imprevisto, avise com antecedência.

Até lá!`,
  },

  // ── Cobranças ─────────────────────────────────────────────────────────
  {
    name: 'Cobrança · Lembrete amigável',
    text: `Olá, {{nome}}! Tudo bem?

Passando para lembrar que sua mensalidade referente a {{mes}} vence em {{vencimento}}.

Valor: {{valor}}.

Para não perder o acesso aos serviços, regularize até a data. Se já pagou, desconsidere esta mensagem.

Qualquer dúvida, estamos aqui.`,
  },
  {
    name: 'Cobrança · Vencimento hoje',
    text: `Olá, {{nome}}.

Hoje ({{hoje}}) é o vencimento da sua mensalidade:
• Valor: {{valor}}
• Vencimento: {{vencimento}}

Para manter seus serviços ativos, pedimos que regularize o pagamento hoje mesmo.

Se já efetuou o pagamento, por favor desconsidere.

Obrigado!
— Equipe Montsystem`,
  },
  {
    name: 'Cobrança · Em atraso',
    text: `Olá, {{nome}}.

Identificamos que sua mensalidade está em atraso:
• Valor: {{valor}}
• Vencimento original: {{vencimento}}
• Dias em atraso: {{dias_atraso}}

Por favor, regularize o quanto antes para evitar interrupção dos serviços.

Caso já tenha pago, desconsidere esta mensagem.

— Equipe Montsystem`,
  },
  {
    name: 'Cobrança · Negociação',
    text: `Olá, {{nome}}.

Vimos que existem pendências em sua conta. Estamos aqui para ajudar a encontrar a melhor solução.

Posso te ligar para conversarmos sobre opções de pagamento?

Responda SIM e entraremos em contato.

— Equipe Montsystem`,
  },

  // ── Problemas nossos ──────────────────────────────────────────────────
  {
    name: 'Problema · Pedido de desculpas',
    text: `Olá, {{nome}}.

Queremos pedir desculpas pelo ocorrido em {{data}} com relação a {{problema}}. Reconhecemos o transtorno causado e estamos tomando providências para que não se repita.

Caso tenha sido afetado de alguma forma, por favor nos avise para que possamos resolver da melhor maneira possível.

— Equipe Montsystem`,
  },
  {
    name: 'Problema · Serviço normalizado',
    text: `Olá, {{nome}}!

Passando para informar que o problema que afetou {{servico}} foi resolvido.

O serviço já está operando normalmente. Caso ainda encontre alguma dificuldade, por favor nos avise.

Agradecemos a paciência.
— Equipe Montsystem`,
  },
  {
    name: 'Problema · Reagendamento',
    text: `Olá, {{nome}}.

Por motivos de {{motivo}}, precisamos reagendar seu atendimento de {{data_original}} para {{data_nova}} às {{hora_nova}}.

Pedimos desculpas pelo inconveniente. Se a nova data não funcionar, por favor nos avise para combinarmos outro horário.

— Equipe Montsystem`,
  },
  {
    name: 'Problema · Indisponibilidade temporária',
    text: `Olá, {{nome}}.

Estamos com uma indisponibilidade temporária no serviço {{servico}}. Nossa equipe técnica já está trabalhando na resolução.

Previsão de normalização: {{previsao}}.

Vamos te avisar assim que tudo voltar ao ar.

— Equipe Montsystem`,
  },
];

/**
 * Popula a tabela `whatsapp_templates` com templates padrão agrupados em
 * 3 categorias (avisos, cobranças, problemas nossos) — apenas se estiver
 * vazia. Idempotente: rodar várias vezes não duplica registros.
 *
 * Roda automaticamente no bootstrap do módulo via OnModuleInit.
 */
@Injectable()
export class WhatsappTemplatesSeeder implements OnModuleInit {
  private readonly logger = new Logger(WhatsappTemplatesSeeder.name);

  constructor(private repo: WhatsappTemplatesRepository) {}

  async onModuleInit() {
    const existing = await this.repo.findAll();
    if (existing.length > 0) {
      this.logger.log(`Templates já populados (${existing.length} registros). Seed ignorado.`);
      return;
    }
    this.logger.log(`Populando ${DEFAULT_TEMPLATES.length} templates padrão...`);
    for (const t of DEFAULT_TEMPLATES) {
      await this.repo.create({ name: t.name, text: t.text, active: true });
    }
    this.logger.log('Templates padrão criados com sucesso.');
  }
}