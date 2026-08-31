/**
 * Catálogo único de recursos e níveis de permissão do Montsystem.
 *
 * KEEP IN SYNC: este arquivo é espelhado em front-montsystem/lib/permissions.ts.
 * Ao adicionar/renomear um recurso aqui, atualize também o frontend e a matriz
 * de permissões no formulário de criação/edição de usuários.
 */
export const RESOURCES = [
  'customers',
  'sales',
  'invoices',
  'boletos',
  'mensalidades',
  'nfse',
  'whatsapp',
  'tickets',
  'company',
  'integrations',
  'users',
  'expenses',
  'contacts',
] as const;

export type Resource = (typeof RESOURCES)[number];

export const LEVELS = ['view', 'edit'] as const;
export type Level = (typeof LEVELS)[number];

/** Ranking numérico usado para comparar "view" vs "edit". */
export const levelRank = (level: Level): number => (level === 'edit' ? 2 : 1);

/**
 * Verifica se `actual` cobre `required`. Lembrando que 'edit' implica 'view'.
 * Retorna `false` para inputs inválidos.
 */
export const satisfies = (actual: Level, required: Level): boolean =>
  levelRank(actual) >= levelRank(required);

/** Rótulos em português para uso na UI de matriz de permissões. */
export const RESOURCE_LABELS: Record<Resource, string> = {
  customers: 'Clientes',
  sales: 'Vendas',
  invoices: 'Notas Fiscais (NFe)',
  boletos: 'Boletos',
  mensalidades: 'Mensalidades',
  nfse: 'NFS-e',
  whatsapp: 'WhatsApp',
  tickets: 'Chamados',
  company: 'Empresa',
  integrations: 'Integrações',
  users: 'Usuários',
  expenses: 'Despesas',
  contacts: 'Contatos',
};
