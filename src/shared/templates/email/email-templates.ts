import dayjs from 'dayjs';
import { Boleto } from '../../../modules/boletos/entities/boleto.entity';
import { MonthlyCharge } from '../../../modules/monthly-charges/entities/monthly-charge.entity';
import { NfseEntity } from '../../../modules/nfse/entities/nfse.entity';

/**
 * Templates HTML de email para o fluxo de cobrança mensal.
 * Mantidos versionados em código (mesmo padrão de `whatsapp-templates.ts`)
 * para fácil auditoria e revisão em PR.
 *
 * Cada função retorna uma string HTML pronta para `EmailService.sendCustom`.
 */

const baseStyle = `
  body { font-family: Arial, sans-serif; line-height: 1.5; color: #333; }
  .container { max-width: 600px; margin: 0 auto; padding: 20px; }
  h2 { color: #1a73e8; }
  table { width: 100%; border-collapse: collapse; margin: 20px 0; }
  td { padding: 8px; border-bottom: 1px solid #eee; }
  .muted { color: #666; font-size: 12px; }
  .warning { background: #fff3cd; border: 1px solid #ffeaa7; padding: 12px; border-radius: 6px; margin: 16px 0; }
`;

export function renderBoletoDisponivel(
  boleto: Boleto,
  customer: { name: string },
  competencia: string,
): string {
  return `
<!DOCTYPE html>
<html lang="pt-BR">
<head><meta charset="UTF-8"><title>Boleto disponível</title>
<style>${baseStyle}</style></head>
<body><div class="container">
  <h2>Olá, ${customer.name}!</h2>
  <p>Seu boleto da mensalidade de <strong>${competencia}</strong> está disponível.</p>
  <table>
    <tr><td><strong>Valor</strong></td><td>R$ ${boleto.valor.toFixed(2).replace('.', ',')}</td></tr>
    <tr><td><strong>Vencimento</strong></td><td>${dayjs(boleto.vencimento).format('DD/MM/YYYY')}</td></tr>
    <tr><td><strong>Nosso número</strong></td><td>${boleto.nossoNumero}</td></tr>
    <tr><td><strong>Linha digitável</strong></td><td style="font-family: monospace;">${boleto.linhaDigitavel || ''}</td></tr>
  </table>
  <p>O PDF do boleto está anexado a este email. Você também pode pagar pelo app do seu banco usando a linha digitável acima.</p>
  <p class="muted">Em caso de dúvidas, entre em contato conosco. Obrigado!</p>
</div></body></html>`;
}

export function renderBoletoVencimentoHoje(
  boleto: Boleto,
  customer: { name: string },
  competencia: string,
): string {
  return `
<!DOCTYPE html>
<html lang="pt-BR">
<head><meta charset="UTF-8"><title>Vencimento hoje</title>
<style>${baseStyle}</style></head>
<body><div class="container">
  <h2>Olá, ${customer.name}!</h2>
  <p>Hoje é o <strong>vencimento</strong> do seu boleto de mensalidade <strong>${competencia}</strong>.</p>
  <table>
    <tr><td><strong>Valor</strong></td><td>R$ ${boleto.valor.toFixed(2).replace('.', ',')}</td></tr>
    <tr><td><strong>Vencimento</strong></td><td>${dayjs(boleto.vencimento).format('DD/MM/YYYY')} (hoje)</td></tr>
    <tr><td><strong>Linha digitável</strong></td><td style="font-family: monospace;">${boleto.linhaDigitavel || ''}</td></tr>
  </table>
  <p>Caso ainda não tenha efetuado o pagamento, realize-o hoje para evitar encargos.</p>
  <p class="muted">Em caso de dúvidas, estamos à disposição.</p>
</div></body></html>`;
}

export function renderAvisoDesativacao(
  charge: MonthlyCharge,
  customer: { name: string },
  boleto?: Boleto,
): string {
  const valor = boleto
    ? boleto.valor.toFixed(2).replace('.', ',')
    : (charge.valorCents / 100).toFixed(2).replace('.', ',');
  const linhaDigitavel = boleto?.linhaDigitavel || 'enviada por email';
  return `
<!DOCTYPE html>
<html lang="pt-BR">
<head><meta charset="UTF-8"><title>Aviso de atraso</title>
<style>${baseStyle}</style></head>
<body><div class="container">
  <h2 style="color:#c0392b;">Olá, ${customer.name}.</h2>
  <div class="warning">
    ⚠️ <strong>Identificamos que seu boleto está em atraso há 5 dias.</strong>
  </div>
  <table>
    <tr><td><strong>Valor</strong></td><td>R$ ${valor}</td></tr>
    <tr><td><strong>Vencimento</strong></td><td>${dayjs(charge.vencimento).format('DD/MM/YYYY')}</td></tr>
    <tr><td><strong>Linha digitável</strong></td><td style="font-family: monospace;">${linhaDigitavel}</td></tr>
  </table>
  <p>Se o pagamento <strong>não for regularizado</strong>, seu acesso ao sistema será desativado.</p>
  <p>Para regularizar, entre em contato ou pague pelo boleto atualizado enviado por email.</p>
  <p class="muted">Estamos à disposição para ajudar.</p>
</div></body></html>`;
}

export function renderNfseAutorizada(
  nfse: NfseEntity,
  customer: { name: string },
  charge: MonthlyCharge,
): string {
  const competencia = dayjs(charge.competencia).format('MM/YYYY');
  const valor = (charge.valorCents / 100).toFixed(2).replace('.', ',');
  return `
<!DOCTYPE html>
<html lang="pt-BR">
<head><meta charset="UTF-8"><title>NFSe emitida</title>
<style>${baseStyle}</style></head>
<body><div class="container">
  <h2>Olá, ${customer.name}!</h2>
  <p>Sua <strong>Nota Fiscal de Serviços Eletrônica (NFSe)</strong> da mensalidade de <strong>${competencia}</strong> foi emitida.</p>
  <table>
    <tr><td><strong>Número</strong></td><td>${nfse.nfseNumber || '(processando)'}</td></tr>
    <tr><td><strong>Código de verificação</strong></td><td>${nfse.protocolo || '(processando)'}</td></tr>
    <tr><td><strong>Valor</strong></td><td>R$ ${valor}</td></tr>
    <tr><td><strong>Data de emissão</strong></td><td>${dayjs(nfse.createdAt).format('DD/MM/YYYY')}</td></tr>
  </table>
  <p>O PDF e o XML da NFSe estão anexados a este email. Guarde-os para seus registros contábeis.</p>
  <p class="muted">Obrigado pela confiança!</p>
</div></body></html>`;
}
