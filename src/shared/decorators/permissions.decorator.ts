import { SetMetadata } from '@nestjs/common';
import type { Resource, Level } from '../permissions/resources';

export const PERMISSIONS_METADATA_KEY = 'permissions:required';

/**
 * Marca uma rota (ou classe) com a permissão mínima necessária para acessá-la.
 * Combinado com `PermissionsGuard`, devolve 403 quando o usuário autenticado
 * não satisfaz `(resource, level)`. Admins (`role === 'admin'`) ignoram esta
 * checagem — ver `PermissionsGuard`.
 *
 * Uso:
 *   @Permissions('customers', 'view')    // em GETs
 *   @Permissions('customers', 'edit')    // em POST/PUT/DELETE
 */
export const Permissions = (resource: Resource, level: Level) =>
  SetMetadata(PERMISSIONS_METADATA_KEY, { resource, level });
