/**
 * Templates de mensagens WhatsApp. Substituem placeholders {{chave}} em runtime.
 * Os templates ficam versionados em código para fácil auditoria.
 */

export type WhatsAppTemplateKey =
  | 'boleto_disponivel'
  | 'boleto_vencido'
  | 'pagamento_confirmado'
  | 'nfse_emitida'
  | 'cobranca_avulsa'
  | 'despesa_vencimento';

export interface WhatsAppTemplate {
  key: WhatsAppTemplateKey;
  title: string;
  text: string;
}

export const WHATSAPP_TEMPLATES: Record<WhatsAppTemplateKey, WhatsAppTemplate> = {
  boleto_disponivel: {
    key: 'boleto_disponivel',
    title: 'Boleto disponível',
    text: `Olá, {{cliente_nome}}! 👋

Segue seu boleto de mensalidade *competência {{competencia}}*:

💰 Valor: R$ {{valor}}
📅 Vencimento: {{vencimento}}
🔢 Linha digitável: {{linha_digitavel}}

Você também recebeu o boleto em PDF no seu email.

Qualquer dúvida, é só chamar!`,
  },
  boleto_vencido: {
    key: 'boleto_vencido',
    title: 'Boleto vencido',
    text: `Olá, {{cliente_nome}}. ⚠️

Identificamos que o boleto de *{{competencia}}* está em atraso:

💰 Valor original: R$ {{valor}}
📅 Vencimento: {{vencimento}}
🔢 Linha digitável: {{linha_digitavel}}

Para regularizar, você pode pagar pelo boleto atualizado que enviaremos por email. Caso já tenha pago, por favor desconsidere.

Estamos à disposição!`,
  },
  pagamento_confirmado: {
    key: 'pagamento_confirmado',
    title: 'Pagamento confirmado',
    text: `Olá, {{cliente_nome}}! ✅

Recebemos o pagamento da sua mensalidade de *{{competencia}}*:

💰 Valor pago: R$ {{valor_pago}}
📅 Data: {{data_pagamento}}
🧾 NFSe: {{nfse_link}}

O comprovante e a NFSe também foram enviados por email. Obrigado pela pontualidade!`,
  },
  nfse_emitida: {
    key: 'nfse_emitida',
    title: 'NFSe emitida',
    text: `Olá, {{cliente_nome}}.

Sua Nota Fiscal de Serviços Eletrônica (NFSe) da mensalidade de *{{competencia}}* foi emitida:

🔢 Número: {{nfse_numero}}
🔐 Código verificação: {{nfse_codigo}}
💰 Valor: R$ {{valor}}
📄 PDF: {{nfse_pdf_url}}

O XML e o PDF também estão anexados no email.`,
  },
  cobranca_avulsa: {
    key: 'cobranca_avulsa',
    title: 'Cobrança avulsa',
    text: `Olá, {{cliente_nome}}.

Segue cobrança referente a *{{descricao}}*:

💰 Valor: R$ {{valor}}
📅 Vencimento: {{vencimento}}
🔢 Linha digitável: {{linha_digitavel}}

Caso já tenha efetuado o pagamento, por favor desconsidere.`,
  },
  despesa_vencimento: {
    key: 'despesa_vencimento',
    title: 'Lembrete de vencimento (despesa interna)',
    text: `📋 *Lembrete de despesa* — {{dias_restantes}} dia(s) para o vencimento

🏷 Descrição: {{descricao}}
🏢 Fornecedor: {{fornecedor}}
💰 Valor: R$ {{valor}}
📅 Vencimento: {{vencimento}}
🏷 Categoria: {{categoria}}

Não deixe passar da data. Qualquer ajuste, atualize no painel de Despesas do Mont System.`,
  },
};

export function renderTemplate(key: WhatsAppTemplateKey, vars: Record<string, string | number | null | undefined>): string {
  const tpl = WHATSAPP_TEMPLATES[key];
  if (!tpl) throw new Error(`Template WhatsApp não encontrado: ${key}`);
  return tpl.text.replace(/{{\s*([\w_]+)\s*}}/g, (_, k) => {
    const v = vars[k];
    return v == null ? '' : String(v);
  });
}
