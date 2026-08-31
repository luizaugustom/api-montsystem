/**
 * Defaults anti-ban para disparo em massa de WhatsApp.
 * Podem ser sobrescritos via env vars.
 *
 * Camadas:
 *  - BULK_DELAY_MIN_MS / BULK_DELAY_MAX_MS: delay aleatório entre envios
 *  - BULK_HOURLY_LIMIT: máximo de mensagens enviadas com sucesso em 60 min
 *  - BULK_DAILY_LIMIT: máximo em 24 h
 *  - BULK_BUSINESS_HOURS_START / END: janela em que o cron aceita despachar
 *  - BULK_TICK_LIMIT: máximo de mensagens processadas por tick do cron
 *  - BULK_MAX_ATTEMPTS: limite de retry por mensagem
 *  - BULK_JITTER_MAX_MS: jitter extra entre destinatários (camada 6)
 *  - BULK_VALIDATE_NUMBERS: se true, valida números via Evolution antes de enfileirar
 */

const envNum = (key: string, fallback: number): number => {
  const raw = process.env[key];
  if (!raw) return fallback;
  const n = Number(raw);
  return Number.isFinite(n) ? n : fallback;
};

const envBool = (key: string, fallback: boolean): boolean => {
  const raw = process.env[key];
  if (raw === undefined) return fallback;
  return raw === 'true' || raw === '1';
};

export const BULK_DELAY_MIN_MS = envNum('WHATSAPP_BULK_DELAY_MIN_MS', 10000); // 10s
export const BULK_DELAY_MAX_MS = envNum('WHATSAPP_BULK_DELAY_MAX_MS', 20000); // 20s
export const BULK_HOURLY_LIMIT = envNum('WHATSAPP_HOURLY_LIMIT', 80);
export const BULK_DAILY_LIMIT = envNum('WHATSAPP_DAILY_LIMIT', 500);
export const BULK_BUSINESS_HOURS_START = envNum('WHATSAPP_BUSINESS_HOURS_START', 8);
export const BULK_BUSINESS_HOURS_END = envNum('WHATSAPP_BUSINESS_HOURS_END', 21);
export const BULK_TICK_LIMIT = envNum('WHATSAPP_BULK_TICK_LIMIT', 10);
export const BULK_MAX_ATTEMPTS = envNum('WHATSAPP_BULK_MAX_ATTEMPTS', 3);
export const BULK_JITTER_MAX_MS = envNum('WHATSAPP_BULK_JITTER_MAX_MS', 5 * 60 * 1000); // 5 min
export const BULK_VALIDATE_NUMBERS = envBool('WHATSAPP_VALIDATE_NUMBERS', true);

export const BULK_DEFAULTS = {
  BULK_DELAY_MIN_MS,
  BULK_DELAY_MAX_MS,
  BULK_HOURLY_LIMIT,
  BULK_DAILY_LIMIT,
  BULK_BUSINESS_HOURS_START,
  BULK_BUSINESS_HOURS_END,
  BULK_TICK_LIMIT,
  BULK_MAX_ATTEMPTS,
  BULK_JITTER_MAX_MS,
  BULK_VALIDATE_NUMBERS,
} as const;