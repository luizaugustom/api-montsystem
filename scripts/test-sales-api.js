/**
 * Script para testar a API de vendas com valores formatados
 * Testa criação de venda única e cliente mensal
 */

(async () => {
  try {
    const base = 'http://localhost:3001';
    
    console.log('🔐 Fazendo login...');
    // Login para obter token
    const loginRes = await fetch(base + '/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'luiz', password: '832010pj' }),
    });
    
    if (!loginRes.ok) {
      console.error('❌ Login falhou', loginRes.status, await loginRes.text());
      process.exit(1);
    }
    
    const { token } = await loginRes.json();
    console.log('✅ Token obtido:', token.slice(0, 20) + '...');

    const authHeaders = { 
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json' 
    };

    // Teste 1: Criar venda única com valor formatado
    console.log('\n📦 Teste 1: Criando venda única com valor "R$ 1.234,56"...');
    const vendaUnica = {
      clientName: 'João Silva',
      phone: '11999999999',
      clientId: 'cli-1',
      saleValue: 'R$ 1.234,56',
      saleDate: '2025-10-01',
      productDescription: 'Instalação X',
      isMonthly: false
    };

    const res1 = await fetch(base + '/api/sales', {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify(vendaUnica),
    });

    console.log('Status:', res1.status);
    const response1 = await res1.json();
    console.log('Resposta:', JSON.stringify(response1, null, 2));

    if (res1.ok) {
      console.log('✅ Venda única criada com sucesso!');
      console.log(`   saleValue: ${response1.saleValue} (convertido de "R$ 1.234,56")`);
      console.log(`   saleValueCents: ${response1.saleValueCents}`);
    } else {
      console.log('❌ Erro ao criar venda única');
    }

    // Teste 2: Criar cliente mensal com valores formatados
    console.log('\n👥 Teste 2: Criando cliente mensal com entryValue="200,00" e monthlyValue="150,00"...');
    const clienteMensal = {
      clientName: 'Maria Santos',
      phone: '11888888888',
      clientId: 'cli-2',
      isMonthly: true,
      entryValue: '200,00',
      monthlyValue: '150,00',
      nextPaymentDate: '2025-11-01',
      productDescription: 'Contrato mensal Y'
    };

    const res2 = await fetch(base + '/api/sales', {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify(clienteMensal),
    });

    console.log('Status:', res2.status);
    const response2 = await res2.json();
    console.log('Resposta:', JSON.stringify(response2, null, 2));

    if (res2.ok) {
      console.log('✅ Cliente mensal criado com sucesso!');
      console.log(`   entryValue: ${response2.entryValue} (convertido de "200,00")`);
      console.log(`   monthlyValue: ${response2.monthlyValue} (convertido de "150,00")`);
      console.log(`   isMonthly: ${response2.isMonthly}`);
    } else {
      console.log('❌ Erro ao criar cliente mensal');
    }

    // Teste 3: Listar todas as vendas para verificar persistência
    console.log('\n📋 Teste 3: Listando todas as vendas...');
    const res3 = await fetch(base + '/api/sales', {
      method: 'GET',
      headers: { 'Authorization': `Bearer ${token}` },
    });

    console.log('Status:', res3.status);
    const sales = await res3.json();
    console.log(`Total de vendas: ${Array.isArray(sales) ? sales.length : 'N/A'}`);
    
    if (Array.isArray(sales) && sales.length > 0) {
      console.log('✅ Vendas listadas com sucesso!');
      sales.forEach((sale, index) => {
        console.log(`\n   Venda ${index + 1}:`);
        console.log(`   - Cliente: ${sale.clientName}`);
        console.log(`   - Valor: R$ ${sale.saleValue || 'N/A'}`);
        console.log(`   - Mensal: ${sale.isMonthly ? 'Sim' : 'Não'}`);
        if (sale.isMonthly) {
          console.log(`   - Entrada: R$ ${sale.entryValue || 'N/A'}`);
          console.log(`   - Mensalidade: R$ ${sale.monthlyValue || 'N/A'}`);
        }
      });
    }

    // Teste 4: Teste com multipart/form-data (similar ao teste de customers)
    console.log('\n📤 Teste 4: Criando venda via multipart/form-data...');
    const form = new FormData();
    form.append('clientName', 'Pedro Oliveira');
    form.append('phone', '11777777777');
    form.append('saleValue', '2.500,75');
    form.append('productDescription', 'Serviço especial');
    form.append('isMonthly', 'false');

    const res4 = await fetch(base + '/api/sales', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}` },
      body: form,
    });

    console.log('Status:', res4.status);
    const response4 = await res4.json();
    console.log('Resposta:', JSON.stringify(response4, null, 2));

    if (res4.ok) {
      console.log('✅ Venda via multipart criada com sucesso!');
      console.log(`   saleValue: ${response4.saleValue} (convertido de "2.500,75")`);
    } else {
      console.log('❌ Erro ao criar venda via multipart');
    }

    console.log('\n🎉 Testes concluídos!');

  } catch (err) {
    console.error('❌ Erro durante os testes:', err);
    process.exit(1);
  }
})();