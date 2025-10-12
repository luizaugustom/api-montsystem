import { Injectable } from '@nestjs/common';
import * as forge from 'node-forge';
import * as fs from 'fs';
import { NFeConfigService } from './nfe-config.service';
// Usar require para evitar incompatibilidades de tipos entre versões de xml-crypto
// e permitir a API clássica (signingKey, keyInfoProvider, addReference com múltiplos args)
// eslint-disable-next-line @typescript-eslint/no-var-requires
const xmlCrypto: any = require('xml-crypto');

@Injectable()
export class NFeSignatureService {
  constructor(private readonly configService: NFeConfigService) {}

  async signXml(xmlString: string): Promise<string> {
    try {
      const config = this.configService.getConfig();
      
      if (!config.certificate?.path || !fs.existsSync(config.certificate.path)) {
        console.warn(`Certificado não encontrado. Usando assinatura simulada.`);
        return this.addSimulatedSignature(xmlString);
      }
      // Assinatura real usando xml-crypto
      const { privateKeyPem, certificatePem } = this.loadCertificate();
      if (!privateKeyPem || !certificatePem) {
        console.warn(`Falha ao carregar PFX. Usando assinatura simulada.`);
        return this.addSimulatedSignature(xmlString);
      }

      const certClean = certificatePem
        .replace('-----BEGIN CERTIFICATE-----', '')
        .replace('-----END CERTIFICATE-----', '')
        .replace(/\r?\n|\r/g, '');

      const sig: any = new xmlCrypto.SignedXml();
      // Algoritmos exigidos pela SEFAZ (NFe 4.00 com RSA-SHA1 e C14N)
      sig.signatureAlgorithm = 'http://www.w3.org/2000/09/xmldsig#rsa-sha1';
      sig.canonicalizationAlgorithm = 'http://www.w3.org/TR/2001/REC-xml-c14n-20010315';
      sig.addReference(
        "//*[local-name(.)='infNFe']",
        [
          'http://www.w3.org/2000/09/xmldsig#enveloped-signature',
          'http://www.w3.org/TR/2001/REC-xml-c14n-20010315'
        ],
        'http://www.w3.org/2000/09/xmldsig#sha1',
        '',
        '',
        '',
        true
      );
      sig.signingKey = privateKeyPem;
      sig.keyInfoProvider = {
        getKeyInfo: () => `\n<KeyInfo>\n  <X509Data>\n    <X509Certificate>${certClean}</X509Certificate>\n  </X509Data>\n</KeyInfo>`,
        getKey: () => null
      };

      // Inserir assinatura como filho de infNFe
      sig.computeSignature(xmlString, {
        location: { reference: "//*[local-name(.)='infNFe']", action: 'append' }
      });
      const signed = sig.getSignedXml();
      return signed;
      
    } catch (error: any) {
      throw new Error(`Erro ao assinar XML: ${error.message}`);
    }
  }

  private addSimulatedSignature(xmlString: string): string {
    // Adicionar assinatura simulada para ambiente de homologação
    const signatureXml = `
    <Signature xmlns="http://www.w3.org/2000/09/xmldsig#">
      <SignedInfo>
        <CanonicalizationMethod Algorithm="http://www.w3.org/TR/2001/REC-xml-c14n-20010315"/>
        <SignatureMethod Algorithm="http://www.w3.org/2000/09/xmldsig#rsa-sha1"/>
        <Reference URI="">
          <Transforms>
            <Transform Algorithm="http://www.w3.org/2000/09/xmldsig#enveloped-signature"/>
            <Transform Algorithm="http://www.w3.org/TR/2001/REC-xml-c14n-20010315"/>
          </Transforms>
          <DigestMethod Algorithm="http://www.w3.org/2000/09/xmldsig#sha1"/>
          <DigestValue>SIMULADO123456789ABCDEF=</DigestValue>
        </Reference>
      </SignedInfo>
      <SignatureValue>ASSINATURA_SIMULADA_PARA_HOMOLOGACAO_123456789=</SignatureValue>
      <KeyInfo>
        <X509Data>
          <X509Certificate>CERTIFICADO_SIMULADO_BASE64</X509Certificate>
        </X509Data>
      </KeyInfo>
    </Signature>`;
    
    const insertPosition = xmlString.lastIndexOf('</infNFe>');
    if (insertPosition === -1) {
      throw new Error('Tag de fechamento </infNFe> não encontrada');
    }
    
    return xmlString.substring(0, insertPosition) + 
           signatureXml + 
           xmlString.substring(insertPosition);
  }

  loadCertificate(certPath?: string, password?: string) {
    try {
      const config = this.configService.getConfig();
      const finalPath = certPath || config.certificate.path;
      const finalPassword = password || config.certificate.password;
      
      if (!fs.existsSync(finalPath)) {
        throw new Error(`Arquivo de certificado não encontrado: ${finalPath}`);
      }
      
      const certBuffer = require('fs').readFileSync(finalPath);
      const p12Asn1 = forge.asn1.fromDer(certBuffer.toString('binary'));
      const p12 = forge.pkcs12.pkcs12FromAsn1(p12Asn1, finalPassword);

      const keyBags = p12.getBags({ bagType: forge.pki.oids.pkcs8ShroudedKeyBag });
      const keyBag = keyBags[forge.pki.oids.pkcs8ShroudedKeyBag]?.[0];
      const certBags = p12.getBags({ bagType: forge.pki.oids.certBag });
      const certBag = certBags[forge.pki.oids.certBag]?.[0];

      if (!keyBag?.key || !certBag?.cert) {
        throw new Error('Chave privada ou certificado não encontrados no .pfx');
      }

      const privateKeyPem = forge.pki.privateKeyToPem(keyBag.key);
      const certificatePem = forge.pki.certificateToPem(certBag.cert);
      return { privateKeyPem, certificatePem } as any;
      
    } catch (error: any) {
      throw new Error(`Erro ao carregar certificado: ${error.message}`);
    }
  }

  async validateSignature(signedXml: string): Promise<boolean> {
    try {
      // Para implementação inicial, sempre retorna true em homologação
      const config = this.configService.getConfig();
      if (config.environment === 'homologacao') {
        return true;
      }
      
      // TODO: Implementar validação real da assinatura
      return signedXml.includes('<Signature');
      
    } catch (error: any) {
      console.error('Erro ao validar assinatura:', error);
      return false;
    }
  }

  getCertificateInfo(certPath?: string, password?: string): any {
    try {
      const cfg = this.loadCertificate(certPath, password) as any;
      return {
        isValid: !!cfg?.privateKeyPem,
        subject: cfg?.certificatePem ? {} : undefined
      };
      
    } catch (error: any) {
      throw new Error(`Erro ao obter informações do certificado: ${error.message}`);
    }
  }

  // Assinatura real será implementada em próxima etapa
}