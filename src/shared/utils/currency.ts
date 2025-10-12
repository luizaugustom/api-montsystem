/**
 * Helper para converter strings monetárias em valores numéricos
 * Aceita formatos como "R$ 1.234,56", "1234,56", "1234.56"
 * @param val - valor a ser convertido
 * @returns número ou undefined se inválido
 */
export const parseCurrency = (val: any): number | undefined => {
  if (val === undefined || val === null || val === '') return undefined;
  if (typeof val === 'number') return val;
  if (typeof val !== 'string') return undefined;
  
  // Remove espaços e símbolos de moeda
  let s = val.trim().replace(/R\$\s*/g, '');
  
  // Se usa separador de milhares '.' e decimal ',', converte para float
  if (/^[0-9\.]+,[0-9]{1,2}$/.test(s)) {
    s = s.replace(/\./g, '').replace(/,/, '.');
  } else if (/^[0-9,]+\.[0-9]{1,2}$/.test(s)) {
    // Se usa separador de milhares ',' e decimal '.', remove vírgulas
    s = s.replace(/,/g, '');
  } else {
    // Remove possíveis milhares (vírgulas) e normaliza decimal ponto
    s = s.replace(/,/g, '.');
  }
  
  const n = Number(s);
  return Number.isFinite(n) && n >= 0 ? n : undefined;
};

/**
 * Converte valor em reais para centavos (inteiro)
 * @param value - valor em reais
 * @returns valor em centavos
 */
export const toCents = (value: number): number => {
  return Math.round(value * 100);
};

/**
 * Converte valor em centavos para reais
 * @param cents - valor em centavos
 * @returns valor em reais
 */
export const fromCents = (cents: number): number => {
  return cents / 100;
};