import { Body, Controller, Get, Post, UseGuards, UploadedFile, UseInterceptors } from '@nestjs/common';
import { CompanyService, CompanyConfig } from './company.service';
import { AuthGuard } from '../auth/auth.guard';
import { FileInterceptor } from '@nestjs/platform-express';
import * as fs from 'fs';
import * as path from 'path';
import { NFeSignatureService } from '../nfe/services/nfe-signature.service';
import { NFeConfigService } from '../nfe/services/nfe-config.service';

@Controller('company')
@UseGuards(AuthGuard)
export class CompanyController {
  constructor(private readonly service: CompanyService, private readonly nfeSignature: NFeSignatureService, private readonly nfeConfig: NFeConfigService) {}

  @Get()
  getConfig() {
    return this.service.get();
  }

  @Post()
  saveConfig(@Body() body: CompanyConfig) {
    const res = this.service.save(body);
    this.nfeConfig.reload();
    return res;
  }

  @Post('certificate')
  @UseInterceptors(FileInterceptor('file'))
  uploadCertificate(@UploadedFile() file: Express.Multer.File, @Body('password') password: string) {
    if (!file) {
      return { message: 'Arquivo não enviado' };
    }
    const dir = path.join(process.cwd(), 'storage', 'certs');
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    const certPath = path.join(dir, file.originalname);
    fs.writeFileSync(certPath, file.buffer);

    const cfg = this.service.get() || ({} as any);
    const newCfg = { ...(cfg || {}), certificate: { path: certPath, password } };
    this.service.save(newCfg);
    this.nfeConfig.reload();
    return { message: 'Certificado salvo', path: certPath };
  }

  @Get('certificate-info')
  certificateInfo() {
    const cfg = this.service.get();
    if (!cfg?.certificate?.path) return { valid: false, message: 'Certificado não configurado' };
    try {
      const info = this.nfeSignature.getCertificateInfo(cfg.certificate.path, cfg.certificate.password);
      return { valid: true, info };
    } catch (e: any) {
      return { valid: false, message: e.message };
    }
  }
}
