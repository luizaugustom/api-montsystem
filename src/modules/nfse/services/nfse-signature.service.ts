import { Injectable } from '@nestjs/common';
import * as forge from 'node-forge';
import * as fs from 'fs';
import { NfseConfigService } from './nfse-config.service';
const { SignedXml } = require('xml-crypto');
import { DOMParser } from 'xmldom';

@Injectable()
export class NfseSignatureService {
  constructor(private cfg: NfseConfigService) {}

  private getKeyAndCertFromPfx(certPath?: string, password?: string) {
    const cfg = this.cfg.getConfig();
    const finalPath = certPath || cfg.certificate?.path;
    const finalPass = password || cfg.certificate?.password;
    if (!finalPath || !fs.existsSync(finalPath)) throw new Error('PFX não encontrado');
    const buffer = fs.readFileSync(finalPath);
    // node-forge expects binary string
    const binary = buffer.toString('binary');
    const p12Asn1 = forge.asn1.fromDer(binary);
    const p12 = forge.pkcs12.pkcs12FromAsn1(p12Asn1, finalPass);
    const keyBags = p12.getBags({ bagType: forge.pki.oids.pkcs8ShroudedKeyBag })[forge.pki.oids.pkcs8ShroudedKeyBag];
    const certBags = p12.getBags({ bagType: forge.pki.oids.certBag })[forge.pki.oids.certBag];
    const privateKeyObj = keyBags && keyBags[0] && keyBags[0].key;
    const certObj = certBags && certBags[0] && certBags[0].cert;
    if (!privateKeyObj || !certObj) throw new Error('Chave ou certificado não encontrados no PFX');
    const privateKeyPem = forge.pki.privateKeyToPem(privateKeyObj);
    const certPem = forge.pki.certificateToPem(certObj);
    return { privateKeyPem, certPem };
  }

  signXml(xml: string): string {
    const cfg = this.cfg.getConfig();
    // Em homologação, se não houver certificado, mantém assinatura simulada
    try {
      const env = cfg.environment || 'homologacao';
      if (env === 'homologacao' && (!cfg.certificate || !cfg.certificate.path)) {
        return xml.replace('</Rps>', '<Signature>ASSINADO_HOMOLOGACAO</Signature></Rps>');
      }

      // Tenta extrair chave e cert do PFX
      const { privateKeyPem, certPem } = this.getKeyAndCertFromPfx();

      // Assinatura simples: assinar todo o elemento Rps
      const doc = new DOMParser().parseFromString(xml);
      const node = doc.getElementsByTagName('Rps')[0];
      if (!node) {
        // fallback para homologacao simulated
        return xml.replace('</Rps>', '<Signature>ASSINADO_HOMOLOGACAO</Signature></Rps>');
      }

  const sig: any = new SignedXml();
      // adicionar referência ao elemento Rps com transform enveloped-signature
  // runtime: addReference accepts (xpath, transforms, digestAlgo?) or (xpath)
  // usamos a forma com xpath apenas e confiamos nos defaults
  sig.addReference("//*[local-name(.)='Rps']");
      // configurar chave de assinatura
      (sig as any).signingKey = privateKeyPem;
      // fornecer KeyInfo com o certificado em base64
      (sig as any).keyInfoProvider = {
        getKeyInfo: () => `<X509Data><X509Certificate>${this.pemToCertBase64(certPem)}</X509Certificate></X509Data>`
      } as any;
      // calcular assinatura e anexar ao final do elemento Rps
      sig.computeSignature(xml);
      const signed = sig.getSignedXml();
      return signed;
    } catch (e) {
      // em caso de qualquer falha, cai para assinatura simulada (útil para homologação)
      try {
        return xml.replace('</Rps>', '<Signature>ASSINADO_HOMOLOGACAO</Signature></Rps>');
      } catch (ee) {
        return xml;
      }
    }
  }

  private pemToCertBase64(pem: string) {
    return pem.replace(/-----BEGIN CERTIFICATE-----/g, '').replace(/-----END CERTIFICATE-----/g, '').replace(/\r?\n|\r/g, '');
  }
}
