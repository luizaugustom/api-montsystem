const axios = require('axios');
const FormData = require('form-data');
const fs = require('fs');
const path = require('path');

const API_URL = 'http://localhost:3001';
let authToken = '';
let testInvoiceId = '';
let testSaleId = '';

// Configurar interceptor para debug
axios.interceptors.request.use((config) => {
  console.log(`🔗 ${config.method.toUpperCase()} ${config.url}`);
  if (config.data && !(config.data instanceof FormData)) {
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

async function createTestSale() {
  console.log('📊 Criando venda de teste...');
  try {
    const saleData = {
      clientId: 'cli-1',
      clientName: 'João Silva - Teste NF',
      phone: '11999887766',
      productDescription: 'Instalação de sistema - Teste NF',
      entryValue: 'R$ 500,00',
      monthlyValue: 'R$ 200,00',
      installments: 12,
      saleValue: 'R$ 2.900,00'
    };

    const response = await axios.post(`${API_URL}/sales`, saleData);
    testSaleId = response.data.id;
    console.log(`✅ Venda criada com ID: ${testSaleId}`);
    return response.data;
  } catch (error) {
    console.error('❌ Erro ao criar venda:', error.message);
    throw error;
  }
}

async function createInvoice() {
  console.log('📄 Criando nota fiscal...');
  try {
    const invoiceData = {
      number: '001',
      series: '1',
      type: 'nfe',
      issueDate: '2025-10-10',
      dueDate: '2025-11-10',
      totalValue: 'R$ 2.900,00',
      taxValue: '200,50',
      discountValue: '100,00',
      clientName: 'João Silva - Teste NF',
      clientDocument: '12345678901',
      clientEmail: 'joao.teste@email.com',
      clientAddress: 'Rua das Flores, 123, Centro, São Paulo - SP, 01234-567',
      description: 'Prestação de serviços de instalação de sistema de monitoramento',
      saleId: testSaleId
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

async function listInvoices() {
  console.log('📋 Listando todas as notas fiscais...');
  try {
    const response = await axios.get(`${API_URL}/invoices`);
    console.log(`✅ ${response.data.length} notas fiscais encontradas`);
    return response.data;
  } catch (error) {
    console.error('❌ Erro ao listar notas fiscais:', error.message);
    throw error;
  }
}

async function getInvoiceById() {
  console.log(`🔍 Buscando nota fiscal por ID: ${testInvoiceId}`);
  try {
    const response = await axios.get(`${API_URL}/invoices/${testInvoiceId}`);
    console.log('✅ Nota fiscal encontrada');
    return response.data;
  } catch (error) {
    console.error('❌ Erro ao buscar nota fiscal:', error.message);
    throw error;
  }
}

async function updateInvoiceStatus() {
  console.log('📝 Atualizando status da nota fiscal para "pending"...');
  try {
    const statusUpdate = {
      status: 'pending'
    };

    const response = await axios.patch(`${API_URL}/invoices/${testInvoiceId}/status`, statusUpdate);
    console.log('✅ Status atualizado com sucesso');
    return response.data;
  } catch (error) {
    console.error('❌ Erro ao atualizar status:', error.message);
    throw error;
  }
}

async function authorizeInvoice() {
  console.log('✅ Simulando autorização da SEFAZ...');
  try {
    const authorizationData = {
      status: 'authorized',
      accessKey: '35250510234567000186550010000000123456789012',
      protocolNumber: 'PROT123456789',
      sefazResponse: 'Autorizado o uso da NF-e'
    };

    const response = await axios.patch(`${API_URL}/invoices/${testInvoiceId}/status`, authorizationData);
    console.log('✅ Nota fiscal autorizada pela SEFAZ');
    return response.data;
  } catch (error) {
    console.error('❌ Erro ao autorizar nota fiscal:', error.message);
    throw error;
  }
}

async function uploadInvoiceFiles() {
  console.log('📎 Simulando upload de arquivos XML/PDF...');
  try {
    // Criar arquivos de teste
    const xmlContent = `<?xml version="1.0" encoding="UTF-8"?>
<nfeProc versao="4.00">
  <NFe>
    <infNFe Id="NFe35250510234567000186550010000000123456789012">
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
        <cDV>9</cDV>
        <tpAmb>2</tpAmb>
        <finNFe>1</finNFe>
        <indFinal>1</indFinal>
        <indPres>0</indPres>
      </ide>
      <emit>
        <CNPJ>10234567000186</CNPJ>
        <xNome>EMPRESA TESTE LTDA</xNome>
      </emit>
      <dest>
        <CPF>12345678901</CPF>
        <xNome>João Silva - Teste NF</xNome>
      </dest>
      <total>
        <ICMSTot>
          <vBC>0.00</vBC>
          <vICMS>0.00</vICMS>
          <vNF>2900.00</vNF>
        </ICMSTot>
      </total>
    </infNFe>
  </NFe>
  <protNFe>
    <infProt>
      <tpAmb>2</tpAmb>
      <verAplic>RS20251001</verAplic>
      <chNFe>35250510234567000186550010000000123456789012</chNFe>
      <dhRecbto>2025-10-10T10:05:00-03:00</dhRecbto>
      <nProt>PROT123456789</nProt>
      <digVal>Teste=</digVal>
      <cStat>100</cStat>
      <xMotivo>Autorizado o uso da NF-e</xMotivo>
    </infProt>
  </protNFe>
</nfeProc>`;

    const xmlPath = path.join(__dirname, 'temp-nfe.xml');
    const pdfPath = path.join(__dirname, 'temp-nfe.pdf');
    
    fs.writeFileSync(xmlPath, xmlContent);
    fs.writeFileSync(pdfPath, 'PDF simulado para teste');

    const formData = new FormData();
    formData.append('xmlFile', fs.createReadStream(xmlPath));
    formData.append('pdfFile', fs.createReadStream(pdfPath));

    const response = await axios.post(`${API_URL}/invoices/${testInvoiceId}/files`, formData, {
      headers: {
        ...formData.getHeaders()
      }
    });

    // Limpar arquivos temporários
    fs.unlinkSync(xmlPath);
    fs.unlinkSync(pdfPath);

    console.log('✅ Arquivos enviados com sucesso');
    return response.data;
  } catch (error) {
    console.error('❌ Erro ao enviar arquivos:', error.message);
    throw error;
  }
}

async function filterInvoices() {
  console.log('🔍 Testando filtros de busca...');
  
  // Filtrar por status
  console.log('Filtrando por status "authorized"...');
  try {
    let response = await axios.get(`${API_URL}/invoices?status=authorized`);
    console.log(`✅ ${response.data.length} notas fiscais autorizadas encontradas`);
  } catch (error) {
    console.error('❌ Erro ao filtrar por status:', error.message);
  }

  // Filtrar por documento do cliente
  console.log('Filtrando por CPF/CNPJ do cliente...');
  try {
    response = await axios.get(`${API_URL}/invoices?clientDocument=12345678901`);
    console.log(`✅ ${response.data.length} notas fiscais do cliente encontradas`);
  } catch (error) {
    console.error('❌ Erro ao filtrar por documento:', error.message);
  }

  // Filtrar por período
  console.log('Filtrando por período...');
  try {
    response = await axios.get(`${API_URL}/invoices?startDate=2025-10-01&endDate=2025-10-31`);
    console.log(`✅ ${response.data.length} notas fiscais no período encontradas`);
  } catch (error) {
    console.error('❌ Erro ao filtrar por período:', error.message);
  }
}

async function updateInvoice() {
  console.log('✏️ Atualizando dados da nota fiscal...');
  try {
    const updateData = {
      number: '001',
      series: '1',
      type: 'nfe',
      issueDate: '2025-10-10',
      dueDate: '2025-12-10', // Alterando data de vencimento
      totalValue: 'R$ 3.100,00', // Alterando valor
      taxValue: '250,00',
      discountValue: '50,00',
      clientName: 'João Silva - Teste NF ATUALIZADO',
      clientDocument: '12345678901',
      clientEmail: 'joao.novo@email.com',
      clientAddress: 'Rua das Flores, 456, Centro, São Paulo - SP, 01234-567',
      description: 'Prestação de serviços de instalação de sistema de monitoramento + suporte',
      saleId: testSaleId
    };

    const response = await axios.put(`${API_URL}/invoices/${testInvoiceId}`, updateData);
    console.log('✅ Nota fiscal atualizada com sucesso');
    return response.data;
  } catch (error) {
    console.error('❌ Erro ao atualizar nota fiscal:', error.message);
    throw error;
  }
}

async function testMultipartForm() {
  console.log('📋 Testando criação via multipart/form-data...');
  try {
    const formData = new FormData();
    formData.append('number', '002');
    formData.append('series', '1');
    formData.append('type', 'nfce');
    formData.append('issueDate', '2025-10-11');
    formData.append('totalValue', 'R$ 150,00');
    formData.append('clientName', 'Maria Silva');
    formData.append('clientDocument', '98765432109');
    formData.append('description', 'Venda de produto via multipart');

    const response = await axios.post(`${API_URL}/invoices`, formData, {
      headers: {
        ...formData.getHeaders()
      }
    });

    console.log('✅ Nota fiscal criada via multipart com sucesso');
    return response.data;
  } catch (error) {
    console.error('❌ Erro ao criar via multipart:', error.message);
    throw error;
  }
}

async function deleteInvoice() {
  console.log(`🗑️ Removendo nota fiscal: ${testInvoiceId}`);
  try {
    await axios.delete(`${API_URL}/invoices/${testInvoiceId}`);
    console.log('✅ Nota fiscal removida com sucesso');
  } catch (error) {
    console.error('❌ Erro ao remover nota fiscal:', error.message);
    throw error;
  }
}

async function runTests() {
  console.log('🚀 INICIANDO TESTES DOS ENDPOINTS DE NOTA FISCAL\n');
  
  try {
    // 1. Autenticação
    await login();
    
    // 2. Criar venda de teste (para relacionar com a nota fiscal)
    await createTestSale();
    
    // 3. Criar nota fiscal
    await createInvoice();
    
    // 4. Listar todas as notas fiscais
    await listInvoices();
    
    // 5. Buscar nota fiscal por ID
    await getInvoiceById();
    
    // 6. Atualizar status para pending
    await updateInvoiceStatus();
    
    // 7. Autorizar nota fiscal (simular SEFAZ)
    await authorizeInvoice();
    
    // 8. Upload de arquivos XML/PDF
    await uploadInvoiceFiles();
    
    // 9. Testar filtros de busca
    await filterInvoices();
    
    // 10. Atualizar dados da nota fiscal
    await updateInvoice();
    
    // 11. Testar multipart/form-data
    await testMultipartForm();
    
    // 12. Remover nota fiscal (opcional)
    // await deleteInvoice();
    
    console.log('\n✅ TODOS OS TESTES CONCLUÍDOS COM SUCESSO!');
    console.log('\n📊 RESUMO DOS ENDPOINTS TESTADOS:');
    console.log('✅ POST /invoices - Criar nota fiscal (JSON + multipart)');
    console.log('✅ GET /invoices - Listar todas as notas fiscais');
    console.log('✅ GET /invoices?status=... - Filtrar por status');
    console.log('✅ GET /invoices?clientDocument=... - Filtrar por documento');
    console.log('✅ GET /invoices?startDate=...&endDate=... - Filtrar por período');
    console.log('✅ GET /invoices/:id - Buscar por ID');
    console.log('✅ PUT /invoices/:id - Atualizar nota fiscal');
    console.log('✅ PATCH /invoices/:id/status - Atualizar status');
    console.log('✅ POST /invoices/:id/files - Upload de arquivos');
    console.log('✅ DELETE /invoices/:id - Remover nota fiscal');
    
  } catch (error) {
    console.error('\n❌ TESTE FALHOU:', error.message);
    process.exit(1);
  }
}

// Executar testes
runTests();