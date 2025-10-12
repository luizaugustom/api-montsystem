const axios = require('axios');

const BASE = 'http://127.0.0.1:3001';

async function waitForServer(url, timeout = 30000) {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    try {
      await axios.get(url + '/health').catch(() => {});
      return true;
    } catch (err) {
      await new Promise(r => setTimeout(r, 1000));
    }
  }
  return false;
}

(async () => {
  const up = await waitForServer(BASE);
  if (!up) {
    console.error('Servidor não disponível em', BASE);
    process.exit(1);
  }

  try {
    console.log('Fazendo login...');
    const loginRes = await axios.post(BASE + '/auth/login', {
      username: 'luiz',
      password: '832010pj'
    }).catch(err => {
      console.error('Erro no login:', err.response ? err.response.data : err.message);
      process.exit(1);
    });

    const token = loginRes.data.token;
    console.log('Token recebido:', token && token.slice(0, 20) + '...');

    const invoices = await axios.get(BASE + '/invoices', {
      headers: { Authorization: `Bearer ${token}` }
    }).catch(err => {
      console.error('Erro ao buscar invoices:', err.response ? err.response.data : err.message);
      process.exit(1);
    });

    console.log('Invoices:', invoices.data ? invoices.data.length + ' registros' : invoices.data);
  } catch (err) {
    console.error('Erro inesperado:', err);
    process.exit(1);
  }
})();
