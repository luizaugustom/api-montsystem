const axios = require('axios');
const fs = require('fs');

const BASE = process.env.BASE_URL || 'http://127.0.0.1:3001';
const TOKEN = process.env.TEST_TOKEN || null; // Se fornecido, usa token

async function run(invoiceId) {
  try {
    console.log('Validando pré-envio...');
    const headers = TOKEN ? { Authorization: `Bearer ${TOKEN}` } : {};
    const valRes = await axios.post(`${BASE}/invoices/${invoiceId}/validate-before-send`, {}, { headers }).catch(e => e.response && e.response.data ? e.response.data : e.message);

    console.log('Resultado validação:', valRes.data || valRes);
    if (valRes.data && valRes.data.valid === false) {
      console.log('Não é seguro enviar: ', valRes.data.errors);
      return;
    }

    console.log('Enviando para SEFAZ...');
    const sendRes = await axios.post(`${BASE}/invoices/${invoiceId}/send-sefaz`, {}, { headers }).catch(e => e.response && e.response.data ? e.response.data : e.message);
    console.log('Resposta envio:', sendRes.data || sendRes);

  } catch (err) {
    console.error('Erro no teste:', err.response ? err.response.data : err.message);
  }
}

if (process.argv.length < 3) {
  console.error('Uso: node scripts/test-send-nfe.js <invoiceId>');
  process.exit(1);
}

run(process.argv[2]);
