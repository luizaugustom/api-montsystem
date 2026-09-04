import { Body, Controller, Get, Param, Post, Put, UseGuards } from '@nestjs/common';
import { IntegrationsService } from './integrations.service';
import { IntegrationKey } from './integrations-storage';
import { AuthGuard } from '../auth/auth.guard';
import { PermissionsGuard } from '../../shared/guards/permissions.guard';
import { Permissions } from '../../shared/decorators/permissions.decorator';

const VALID_KEYS: IntegrationKey[] = ['unimake', 'focus-nfe', 'resend', 'zapi'];

@Controller('integrations')
@UseGuards(AuthGuard, PermissionsGuard)
export class IntegrationsController {
  constructor(private service: IntegrationsService) {}

  @Get()
  @Permissions('integrations', 'view')
  list() {
    return this.service.getAll(true);
  }

  @Get(':key')
  @Permissions('integrations', 'view')
  getOne(@Param('key') key: string) {
    if (!VALID_KEYS.includes(key as IntegrationKey)) {
      return { error: 'Integração inválida' };
    }
    return this.service.getOne(key as IntegrationKey);
  }

  @Put(':key')
  @Permissions('integrations', 'edit')
  update(@Param('key') key: string, @Body() body: any) {
    if (!VALID_KEYS.includes(key as IntegrationKey)) {
      return { error: 'Integração inválida' };
    }
    return this.service.save(key as IntegrationKey, body);
  }

  @Post(':key/test')
  @Permissions('integrations', 'view')
  async test(@Param('key') key: string) {
    if (!VALID_KEYS.includes(key as IntegrationKey)) {
      return { ok: false, message: 'Integração inválida' };
    }
    return this.service.testConnection(key as IntegrationKey);
  }
}
