// scripts/test-tickets-api.js
// Smoke test do módulo de Chamados (Tickets). Requer a API rodando em http://localhost:3001
// e um cliente cadastrado (pega o primeiro da lista /customers).
// Uso: node scripts/test-tickets-api.js

const BASE = process.env.BASE_URL || 'http://localhost:3001'

async function main() {
  // 1) login
  const loginRes = await fetch(`${BASE}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'luiz', password: '832010pj' }),
  })
  if (!loginRes.ok) throw new Error(`login falhou: ${loginRes.status}`)
  const { token } = await loginRes.json()
  const auth = { Authorization: `Bearer ${token}` }
  console.log('✓ login ok')

  // 2) pega um cliente existente
  const cRes = await fetch(`${BASE}/api/customers`, { headers: auth })
  if (!cRes.ok) throw new Error(`listar customers falhou: ${cRes.status}`)
  const customers = await cRes.json()
  if (!customers.length) throw new Error('nenhum cliente cadastrado — cadastre um antes')
  const clientId = customers[0].id
  console.log(`✓ cliente selecionado: ${customers[0].name} (${clientId})`)

  // 3) cria um chamado sem anexos (JSON)
  const createRes = await fetch(`${BASE}/api/tickets`, {
    method: 'POST',
    headers: { ...auth, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      clientId,
      title: 'Chamado de teste',
      description: 'Descrição do chamado de teste',
      priority: 'high',
      status: 'open',
      assigneeName: 'Carlos',
      dueDate: '2026-12-31T12:00:00.000Z',
    }),
  })
  if (!createRes.ok) {
    const text = await createRes.text()
    throw new Error(`criar ticket falhou: ${createRes.status} ${text}`)
  }
  const created = await createRes.json()
  console.log('✓ ticket criado:', created.id)
  if (created.clientName !== customers[0].name) {
    throw new Error(`clientName denormalizado errado: ${created.clientName}`)
  }
  console.log('✓ clientName denormalizado correto')

  // 4) cria um chamado com anexo (multipart)
  const fd = new FormData()
  fd.append('clientId', clientId)
  fd.append('title', 'Chamado com anexo')
  fd.append('description', 'Testando upload')
  fd.append('priority', 'medium')
  fd.append('status', 'in_progress')
  fd.append('files', new Blob(['conteudo de teste'], { type: 'text/plain' }), 'nota.txt')
  const createWithFileRes = await fetch(`${BASE}/api/tickets`, {
    method: 'POST',
    headers: auth, // sem Content-Type — fetch seta multipart boundary
    body: fd,
  })
  if (!createWithFileRes.ok) {
    const text = await createWithFileRes.text()
    throw new Error(`criar ticket com anexo falhou: ${createWithFileRes.status} ${text}`)
  }
  const createdWithFile = await createWithFileRes.json()
  console.log('✓ ticket com anexo criado:', createdWithFile.id)
  console.log('  attachments:', JSON.stringify(createdWithFile.attachments))

  // 5) lista
  const listRes = await fetch(`${BASE}/api/tickets`, { headers: auth })
  const list = await listRes.json()
  console.log(`✓ listagem: ${list.length} ticket(s)`)
  if (list[0].clientName !== customers[0].name) {
    throw new Error(`clientName denormalizado errado na lista: ${list[0].clientName}`)
  }

  // 6) atualiza
  const updRes = await fetch(`${BASE}/api/tickets/${created.id}`, {
    method: 'PUT',
    headers: { ...auth, 'Content-Type': 'application/json' },
    body: JSON.stringify({ status: 'resolved' }),
  })
  if (!updRes.ok) throw new Error(`atualizar falhou: ${updRes.status}`)
  const updated = await updRes.json()
  console.log(`✓ ticket atualizado: status=${updated.status}`)

  // 7) busca por id
  const oneRes = await fetch(`${BASE}/api/tickets/${created.id}`, { headers: auth })
  const one = await oneRes.json()
  console.log(`✓ GET /tickets/:id: status=${one.status}`)

  // 8) filtro por status
  const fRes = await fetch(`${BASE}/api/tickets?status=resolved`, { headers: auth })
  const filtered = await fRes.json()
  console.log(`✓ filtro status=resolved: ${filtered.length} ticket(s)`)

  // 9) erro negativo: clientId inválido
  const errRes = await fetch(`${BASE}/api/tickets`, {
    method: 'POST',
    headers: { ...auth, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      clientId: '00000000-0000-0000-0000-000000000000',
      title: 'inválido',
      description: 'teste',
    }),
  })
  console.log(`✓ POST com clientId inválido: status=${errRes.status} (esperado 404)`)
  if (errRes.status !== 404) {
    const text = await errRes.text()
    throw new Error(`esperava 404, recebi ${errRes.status}: ${text}`)
  }

  // 10) deleta
  const delRes = await fetch(`${BASE}/api/tickets/${created.id}`, { method: 'DELETE', headers: auth })
  console.log(`✓ DELETE /tickets/:id: status=${delRes.status}`)
  const del2 = await fetch(`${BASE}/api/tickets/${createdWithFile.id}`, { method: 'DELETE', headers: auth })
  console.log(`✓ DELETE 2º ticket: status=${del2.status}`)

  console.log('\n✅ Smoke test completo — todos os checks passaram.')
}

main().catch((e) => {
  console.error('❌', e.message)
  process.exit(1)
})
