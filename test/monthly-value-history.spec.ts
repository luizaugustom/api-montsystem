import { describe, it, expect } from 'vitest'
import {
  buildMonthlyValueHistoryOnChange,
  resolveMonthlyValueAtDate,
  seedMonthlyValueHistory,
} from '../src/modules/customers/monthly-value-history'

describe('monthly-value-history', () => {
  it('seed cria primeira vigência a partir da aquisição', () => {
    expect(seedMonthlyValueHistory(100, '2024-01-15')).toEqual([
      { value: 100, effectiveFrom: '2024-01-15' },
    ])
  })

  it('ao mudar o valor, parcelas anteriores mantêm o antigo e as seguintes usam o novo', () => {
    const history = buildMonthlyValueHistoryOnChange(
      {
        monthlyValue: 100,
        acquisitionDate: '2024-01-15',
        monthlyValueHistory: [{ value: 100, effectiveFrom: '2024-01-15' }],
      },
      150,
      '2025-09-04',
    )

    const customer = { monthlyValue: 150, monthlyValueHistory: history }

    expect(resolveMonthlyValueAtDate(customer, '2024-06-15')).toBe(100)
    expect(resolveMonthlyValueAtDate(customer, '2025-08-15')).toBe(100)
    expect(resolveMonthlyValueAtDate(customer, '2025-09-04')).toBe(150)
    expect(resolveMonthlyValueAtDate(customer, '2025-10-15')).toBe(150)
  })

  it('sem histórico prévio, registra o valor atual antes de aplicar o novo', () => {
    const history = buildMonthlyValueHistoryOnChange(
      { monthlyValue: 80, acquisitionDate: '2023-05-01' },
      120,
      '2025-09-04',
    )

    expect(history).toEqual([
      { value: 80, effectiveFrom: '2023-05-01' },
      { value: 120, effectiveFrom: '2025-09-04' },
    ])
  })

  it('sem histórico, resolve tudo com o monthlyValue atual (legado)', () => {
    expect(resolveMonthlyValueAtDate({ monthlyValue: 99 }, '2024-01-01')).toBe(99)
  })
})
