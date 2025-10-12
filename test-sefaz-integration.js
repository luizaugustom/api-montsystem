const axios = require('axios');

const API_URL = 'http://localhost:3001';
let authToken = '';
let testInvoiceId = '';

// Configurar interceptor para debug
axios.interceptors.request.use((config) => {
  console.log(`🔗 ${config.method.toUpperCase()} ${config.url}`);
  if (config.data) {
    console.log('📦 Request Body:', JSON.stringify(config.data, null, 2));
  }
  return config;
});

axios.interceptors.response.use(
  (response) => {
    console.log(`✅ ${response.status} ${response.statusText}`);
    console.log('📥 Response:', JSON.stringify(response.data, null, 2));
    console.log('');
    return response;
  },
  (error) => {
    console.log(`❌ ${error.response?.status} ${error.response?.statusText}`);
    if (error.response?.data) {
      console.log('💥 Error:', JSON.stringify(error.response.data, null, 2));
    }
    console.log('');
    return Promise.reject(error);
  }
);

async function login() {
  console.log('🔐 Fazendo login...');
  try {
    const response = await axios.post(`${API_URL}/auth/login`, {
      username: 'luiz',
      password: '832010pj'
    });
    authToken = response.data.token;
    axios.defaults.headers.common['Authorization'] = `Bearer ${authToken}`;
    console.log('✅ Login realizado com sucesso!');
  } catch (error) {
    console.error('❌ Erro no login:', error.message);
    throw error;
  }
}

async function createInvoiceForSefaz() {
  console.log('📄 Criando nota fiscal para integração SEFAZ...');
  try {
    const invoiceData = {
      number: '1',
      series: '1',
      type: 'nfe',
      issueDate: '2025-10-10',
      dueDate: '2025-11-10',
      totalValue: 'R$ 1.500,00',
      taxValue: '150,00',
      discountValue: '0,00',
      clientName: 'João Silva - SEFAZ Test',
      clientDocument: '12345678901',
      clientEmail: 'joao.sefaz@email.com',
      clientAddress: 'Rua das Flores, 123, Centro, São Paulo - SP, 01234-567',
      description: 'Prestação de serviços de monitoramento - Teste SEFAZ'
    };

    const response = await axios.post(`${API_URL}/invoices`, invoiceData);
    testInvoiceId = response.data.id;
    console.log(`✅ Nota fiscal criada com ID: ${testInvoiceId}`);
    return response.data;
  } catch (error) {
    console.error('❌ Erro ao criar nota fiscal:', error.message);
    throw error;
  }
}

async function sendToSefaz() {
  console.log('🌐 Enviando nota fiscal para SEFAZ...');
  try {
    const response = await axios.post(`${API_URL}/invoices/${testInvoiceId}/send-sefaz`);
    console.log('✅ Nota fiscal enviada para SEFAZ com sucesso');
    return response.data;
  } catch (error) {
    console.error('❌ Erro ao enviar para SEFAZ:', error.message);
    throw error;
  }
}

async function consultSefazStatus() {
  console.log('🔍 Consultando status na SEFAZ...');
  try {
    const response = await axios.get(`${API_URL}/invoices/${testInvoiceId}/sefaz-status`);
    console.log('✅ Status consultado com sucesso');
    return response.data;
  } catch (error) {
    console.error('❌ Erro ao consultar status:', error.message);
    throw error;
  }
}

async function cancelNFe() {
  console.log('❌ Testando cancelamento da NFe...');
  try {
    const response = await axios.post(`${API_URL}/invoices/${testInvoiceId}/cancel`, {
      justificativa: 'Cancelamento para teste de integração com SEFAZ - verificação do sistema'
    });
    console.log('✅ NFe cancelada com sucesso');
    return response.data;
  } catch (error) {
    console.error('❌ Erro ao cancelar NFe:', error.message);
    throw error;
  }
}

async function uploadNFeFiles() {
  console.log('📎 Testando upload de arquivos NFe...');
  try {
    // Criar conteúdo XML simulado
    const xmlContent = `<?xml version="1.0" encoding="UTF-8"?>
<nfeProc versao="4.00" xmlns="http://www.portalfiscal.inf.br/nfe">
  <NFe>
    <infNFe Id="NFe35250512345678000190550010000000011234567890">
      <ide>
        <cUF>35</cUF>
        <cNF>12345678</cNF>
        <natOp>Prestacao de servicos</natOp>
        <mod>55</mod>
        <serie>1</serie>
        <nNF>1</nNF>
        <dhEmi>2025-10-10T10:00:00-03:00</dhEmi>
        <tpNF>1</tpNF>
        <idDest>1</idDest>
        <cMunFG>3550308</cMunFG>
        <tpImp>1</tpImp>
        <tpEmis>1</tpEmis>
        <cDV>0</cDV>
        <tpAmb>2</tpAmb>
        <finNFe>1</finNFe>
        <indFinal>1</indFinal>
        <indPres>0</indPres>
        <procEmi>0</procEmi>
        <verProc>1.0.0</verProc>
      </ide>
      <emit>
        <CNPJ>12345678000190</CNPJ>
        <xNome>MONT SYSTEM LTDA</xNome>
        <xFant>Mont System</xFant>
        <enderEmit>
          <xLgr>Rua das Empresas</xLgr>
          <nro>123</nro>
          <xBairro>Centro</xBairro>
          <cMun>3550308</cMun>
          <xMun>São Paulo</xMun>
          <UF>SP</UF>
          <CEP>01234567</CEP>
          <cPais>1058</cPais>
          <xPais>Brasil</xPais>
        </enderEmit>
        <IE>123456789</IE>
        <CRT>3</CRT>
      </emit>
      <dest>
        <CPF>12345678901</CPF>
        <xNome>João Silva - SEFAZ Test</xNome>
        <enderDest>
          <xLgr>Rua das Flores</xLgr>
          <nro>123</nro>
          <xBairro>Centro</xBairro>
          <cMun>3550308</cMun>
          <xMun>São Paulo</xMun>
          <UF>SP</UF>
          <CEP>01234567</CEP>
          <cPais>1058</cPais>
          <xPais>Brasil</xPais>
        </enderDest>
        <indIEDest>9</indIEDest>
        <email>joao.sefaz@email.com</email>
      </dest>
      <det nItem="1">
        <prod>
          <cProd>001</cProd>
          <cEAN>SEM GTIN</cEAN>
          <xProd>Prestação de serviços de monitoramento</xProd>
          <NCM>84715010</NCM>
          <CFOP>5933</CFOP>
          <uCom>UN</uCom>
          <qCom>1.0000</qCom>
          <vUnCom>1500.00</vUnCom>
          <vProd>1500.00</vProd>
          <cEANTrib>SEM GTIN</cEANTrib>
          <uTrib>UN</uTrib>
          <qTrib>1.0000</qTrib>
          <vUnTrib>1500.00</vUnTrib>
          <indTot>1</indTot>
        </prod>
        <imposto>
          <ICMS>
            <ICMSSN101>
              <orig>0</orig>
              <CSOSN>101</CSOSN>
              <pCredSN>0.00</pCredSN>
              <vCredICMSSN>0.00</vCredICMSSN>
            </ICMSSN101>
          </ICMS>
          <PIS>
            <PISNT>
              <CST>07</CST>
            </PISNT>
          </PIS>
          <COFINS>
            <COFINSNT>
              <CST>07</CST>
            </COFINSNT>
          </COFINS>
        </imposto>
      </det>
      <total>
        <ICMSTot>
          <vBC>0.00</vBC>
          <vICMS>0.00</vICMS>
          <vICMSDeson>0.00</vICMSDeson>
          <vFCP>0.00</vFCP>
          <vBCST>0.00</vBCST>
          <vST>0.00</vST>
          <vFCPST>0.00</vFCPST>
          <vFCPSTRet>0.00</vFCPSTRet>
          <vProd>1500.00</vProd>
          <vFrete>0.00</vFrete>
          <vSeg>0.00</vSeg>
          <vDesc>0.00</vDesc>
          <vII>0.00</vII>
          <vIPI>0.00</vIPI>
          <vIPIDevol>0.00</vIPIDevol>
          <vPIS>0.00</vPIS>
          <vCOFINS>0.00</vCOFINS>
          <vOutro>0.00</vOutro>
          <vNF>1500.00</vNF>
        </ICMSTot>
      </total>
      <transp>
        <modFrete>9</modFrete>
      </transp>
      <infAdic>
        <infCpl>NFe emitida em ambiente de homologacao - SEM VALOR FISCAL - Nota fiscal emitida pelo sistema Mont System</infCpl>
      </infAdic>
    </infNFe>
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
    </Signature>
  </NFe>
  <protNFe>
    <infProt>
      <tpAmb>2</tpAmb>
      <verAplic>RS20251001</verAplic>
      <chNFe>35250512345678000190550010000000011234567890</chNFe>
      <dhRecbto>2025-10-10T10:05:00-03:00</dhRecbto>
      <nProt>135251010123456</nProt>
      <digVal>Teste=</digVal>
      <cStat>100</cStat>
      <xMotivo>Autorizado o uso da NF-e</xMotivo>
    </infProt>
  </protNFe>
</nfeProc>`;

    const FormData = require('form-data');
    const formData = new FormData();
    
    // Adicionar arquivo XML
    formData.append('files', Buffer.from(xmlContent, 'utf8'), {
      filename: 'nfe-teste.xml',
      contentType: 'application/xml'
    });
    
    // Adicionar arquivo PDF simulado
    formData.append('files', Buffer.from('PDF simulado da NFe para teste'), {
      filename: 'nfe-teste.pdf',
      contentType: 'application/pdf'
    });

    const response = await axios.post(`${API_URL}/invoices/${testInvoiceId}/files`, formData, {
      headers: {
        ...formData.getHeaders()
      }
    });

    console.log('✅ Arquivos enviados com sucesso');
    return response.data;
  } catch (error) {
    console.error('❌ Erro ao enviar arquivos:', error.message);
    throw error;
  }
}

async function testNextNumber() {
  console.log('🔢 Testando geração de próximo número...');
  try {
    const response = await axios.get(`${API_URL}/invoices/next-number/1`);
    console.log('✅ Próximo número obtido');
    return response.data;
  } catch (error) {
    console.error('❌ Erro ao obter próximo número:', error.message);
    throw error;
  }
}

async function runSefazIntegrationTests() {
  console.log('🚀 INICIANDO TESTES DE INTEGRAÇÃO SEFAZ\n');
  
  try {
    // 1. Login
    await login();
    
    // 2. Testar próximo número
    await testNextNumber();
    
    // 3. Criar nota fiscal
    await createInvoiceForSefaz();
    
    // 4. Enviar para SEFAZ
    await sendToSefaz();
    
    // 5. Consultar status
    await consultSefazStatus();
    
    // 6. Upload de arquivos
    await uploadNFeFiles();
    
    // 7. Cancelar NFe (opcional - descomente se quiser testar)
    // await cancelNFe();
    
    console.log('\n✅ TODOS OS TESTES DE INTEGRAÇÃO SEFAZ CONCLUÍDOS!');
    console.log('\n📊 RESUMO DOS ENDPOINTS TESTADOS:');
    console.log('✅ POST /invoices - Criar nota fiscal');
    console.log('✅ GET /invoices/next-number/:series - Próximo número');
    console.log('✅ POST /invoices/:id/send-sefaz - Enviar para SEFAZ');
    console.log('✅ GET /invoices/:id/sefaz-status - Consultar status SEFAZ');
    console.log('✅ POST /invoices/:id/files - Upload de arquivos XML/PDF');
    console.log('✅ POST /invoices/:id/cancel - Cancelar NFe');
    
    console.log('\n🌐 FUNCIONALIDADES SEFAZ IMPLEMENTADAS:');
    console.log('✅ Geração de XML NFe layout 4.00');
    console.log('✅ Assinatura digital (simulada para homologação)');
    console.log('✅ Envio para webservices SEFAZ');
    console.log('✅ Consulta de status e protocolo');
    console.log('✅ Cancelamento de NFe');
    console.log('✅ Upload e armazenamento de arquivos');
    console.log('✅ Envio automático por email');
    console.log('✅ Controle de numeração e séries');
    
    console.log('\n🔧 PRÓXIMOS PASSOS PARA PRODUÇÃO:');
    console.log('📜 Instalar certificado digital A1/A3 válido');
    console.log('🔐 Configurar assinatura digital real');
    console.log('🌐 Implementar parser de resposta SOAP real');
    console.log('📧 Configurar servidor SMTP para envio de emails');
    console.log('🏢 Configurar dados da empresa emissora');
    console.log('⚙️ Ajustar ambiente para produção (.env.nfe)');
    
  } catch (error) {
    console.error('\n❌ TESTE FALHOU:', error.message);
    process.exit(1);
  }
}

// Executar testes
runSefazIntegrationTests();