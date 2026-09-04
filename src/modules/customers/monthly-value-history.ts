export type MonthlyValueChange = { value: number; effectiveFrom: string }

export function todayISO(d = new Date()): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function toNumber(v: unknown): number | null {
  if (v === null || v === undefined || v === '') return null
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}

/** Semântica: histórico ordenado; o valor vigente em `dateISO` é o último com effectiveFrom <= dateISO. */
export function resolveMonthlyValueAtDate(
  customer: {
    monthlyValue?: number | null
    monthlyValueHistory?: MonthlyValueChange[] | null
  },
  dateISO: string,
): number | null {
  const history = [...(customer.monthlyValueHistory || [])].sort((a, b) =>
    a.effectiveFrom.localeCompare(b.effectiveFrom),
  )
  if (history.length === 0) {
    return toNumber(customer.monthlyValue)
  }

  let value: number | null = null
  for (const h of history) {
    if (h.effectiveFrom <= dateISO) value = toNumber(h.value)
    else break
  }
  // Antes da primeira mudança conhecida, usa o primeiro valor registrado
  if (value === null) value = toNumber(history[0].value)
  return value
}

export function seedMonthlyValueHistory(
  monthlyValue: number | null | undefined,
  effectiveFrom?: string | null,
): MonthlyValueChange[] | undefined {
  const n = toNumber(monthlyValue)
  if (n === null) return undefined
  return [{ value: n, effectiveFrom: effectiveFrom || todayISO() }]
}

/**
 * Ao alterar o valor mensal, registra o valor anterior (se ainda não estiver no histórico)
 * e anexa a nova vigência a partir de `effectiveFrom` (padrão: hoje).
 */
export function buildMonthlyValueHistoryOnChange(
  existing: {
    monthlyValue?: number | null
    monthlyValueHistory?: MonthlyValueChange[] | null
    acquisitionDate?: string | null
    nextPaymentDate?: string | null
  },
  newValue: number | null | undefined,
  effectiveFrom: string = todayISO(),
): MonthlyValueChange[] | undefined {
  const next = toNumber(newValue)
  const current = toNumber(existing.monthlyValue)
  if (next === null) return existing.monthlyValueHistory || undefined
  if (current !== null && current === next) {
    return existing.monthlyValueHistory?.length
      ? existing.monthlyValueHistory
      : seedMonthlyValueHistory(next, existing.acquisitionDate || effectiveFrom)
  }

  const history = [...(existing.monthlyValueHistory || [])]

  if (current !== null) {
    const last = history[history.length - 1]
    if (!last || toNumber(last.value) !== current) {
      history.push({
        value: current,
        effectiveFrom: existing.acquisitionDate || existing.nextPaymentDate || effectiveFrom,
      })
    }
  }

  history.push({ value: next, effectiveFrom })
  return history
}
