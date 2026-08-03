import { describe, it, expect } from 'vitest';
import { buildCustomerAddress } from '../src/modules/customers/customer-address';

describe('buildCustomerAddress', () => {
  it('monta payload completo quando todos os campos estão preenchidos', () => {
    const addr = buildCustomerAddress({
      cep: '01310100',
      street: 'Avenida Paulista',
      number: '1000',
      complement: 'Sala 501',
      neighborhood: 'Bela Vista',
      city: 'São Paulo',
      state: 'SP',
    } as any);

    expect(addr).toEqual({
      logradouro: 'Avenida Paulista',
      numero: '1000',
      complemento: 'Sala 501',
      bairro: 'Bela Vista',
      cep: '01310100',
      cidade: 'São Paulo',
      uf: 'SP',
      codigoMunicipio: '3550308',
    });
  });

  it('aplica fallbacks quando campos estão ausentes', () => {
    const addr = buildCustomerAddress({} as any);

    expect(addr.logradouro).toBe('Não informado');
    expect(addr.numero).toBe('S/N');
    expect(addr.complemento).toBeUndefined();
    expect(addr.bairro).toBe('Centro');
    expect(addr.cep).toBe('00000000');
    expect(addr.cidade).toBe('Não informada');
    expect(addr.uf).toBe('SP');
    expect(addr.codigoMunicipio).toBe('3550308');
  });

  it('tem as chaves esperadas pelo boletos.service', () => {
    const addr = buildCustomerAddress({} as any);
    expect(Object.keys(addr).sort()).toEqual(
      ['bairro', 'cep', 'cidade', 'codigoMunicipio', 'complemento', 'logradouro', 'numero', 'uf'].sort()
    );
  });
});