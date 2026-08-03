import { Customer } from './entities/customer.entity';

export interface CustomerAddressPayload {
  logradouro: string;
  numero: string;
  complemento?: string;
  bairro: string;
  cep: string;
  cidade: string;
  uf: string;
  codigoMunicipio: string;
}

/**
 * Monta o payload de endereço no shape esperado por boletos/NFe a partir
 * dos campos estruturados do cliente. Aplica fallbacks para campos vazios.
 * TODO: resolver codigoMunicipio por cidade/UF (lookup IBGE) - fora de escopo.
 */
export function buildCustomerAddress(c: Customer): CustomerAddressPayload {
  return {
    logradouro: c.street || 'Não informado',
    numero: c.number || 'S/N',
    complemento: c.complement || undefined,
    bairro: c.neighborhood || 'Centro',
    cep: c.cep || '00000000',
    cidade: c.city || 'Não informada',
    uf: c.state || 'SP',
    codigoMunicipio: '3550308',
  };
}