(async () => {
  try {
    const base = 'http://localhost:3001';
    // login
    const loginRes = await fetch(base + '/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'luiz', password: '832010pj' }),
    });
    if (!loginRes.ok) {
      console.error('login failed', loginRes.status, await loginRes.text());
      process.exit(1);
    }
    const { token } = await loginRes.json();
    console.log('token:', token.slice(0, 20) + '...');

    const form = new FormData();
    form.append('name', 'Cliente Teste');
    form.append('phone', '123456789');
    form.append('entryValue', '1.234,56');
    form.append('monthlyValue', '99,99');

    const res = await fetch(base + '/api/customers', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: form,
    });

    console.log('status', res.status);
    const text = await res.text();
    console.log('body:', text);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
})();
