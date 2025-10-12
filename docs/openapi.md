Documentação da API (para Frontend, App e n8n)

Base URL local:
- API: http://localhost:3000/api
- Swagger (auto): http://localhost:3000/api/docs

Autenticação (obrigatória para todas as rotas, exceto login)
- Tipo: Bearer JWT
- Header: Authorization: Bearer <token>
- Único usuário: username: "luiz", password: "832010pj"

Erros (formato padrão NestJS)
- Exemplo:
  { "statusCode": 401, "message": "Unauthorized", "error": "Unauthorized" }

Tipos principais (frontend)
- Customer (mensal):
  {
    "id": string,
    "name": string,
    "phone": string,
    "email"?: string,
    "cpfOrCnpj"?: string,
    "address"?: string,
    "acquisitionDate"?: "YYYY-MM-DD",
    "entryValue"?: number,
    "monthlyValue"?: number,
    "nextPaymentDate"?: "YYYY-MM-DD",
    "productDescription"?: string,
    "invoices"?: string[]
  }

- Sale (venda única):
  {
    "id": string,
    "clientName": string,
    "phone": string,
    "cpfOrCnpj"?: string,
    "address"?: string,
    "saleDate"?: "YYYY-MM-DD",
    "warrantyEndDate"?: "YYYY-MM-DD",
    "productDescription"?: string,
    "contractFile"?: string,
    "invoiceFile"?: string
  }

1) Auth
- POST /auth/login
  - Body JSON: { "username": "luiz", "password": "832010pj" }
  - 200/201: { "token": "<jwt>" }
  - 401: credenciais inválidas

Exemplo cURL:
  curl -X POST http://localhost:3000/api/auth/login -H "Content-Type: application/json" -d "{\"username\":\"luiz\",\"password\":\"832010pj\"}"

2) Customers (mensal) — protegido

- POST /customers (criar)
  - Content-Type: multipart/form-data
  - Campos (form): name (string, obrigatório), phone (string, obrigatório), email? (string), cpfOrCnpj? (string), address? (string), acquisitionDate? (YYYY-MM-DD), entryValue? (number), monthlyValue? (number), nextPaymentDate? (YYYY-MM-DD), productDescription? (string)
  - Arquivos: invoices[] (múltiplos)
  - 201: Customer

  Exemplo cURL (PowerShell use " for strings):
    curl -X POST http://localhost:3000/api/customers ^
      -H "Authorization: Bearer <token>" ^
      -F "name=João" -F "phone=5599999999" -F "monthlyValue=199.9" -F "nextPaymentDate=2025-11-10" ^
      -F "invoices=@C:\\caminho\\nota1.pdf" -F "invoices=@C:\\caminho\\nota2.pdf"

- GET /customers (listar todos)
  - 200: Customer[]

- GET /customers/:id (detalhe)
  - 200: Customer | 404

- PUT /customers/:id (atualizar)
  - Body JSON parcial (mesmos campos do POST, sem arquivos)
  - 200: Customer

- DELETE /customers/:id
  - 200: { ok: true }

- POST /customers/list-by-month
  - Body JSON: { "months": ["YYYY-MM", "YYYY-MM"] }
  - Regra: filtra por prefixo em nextPaymentDate
  - 200: Customer[]

3) Sales (venda única) — protegido

- POST /sales (criar)
  - Content-Type: multipart/form-data
  - Campos (form): clientName (string, obrigatório), phone (string, obrigatório), cpfOrCnpj?, address?, saleDate? (YYYY-MM-DD), warrantyEndDate? (YYYY-MM-DD), productDescription?
  - Arquivos: files[] (múltiplos). Dica: se o nome do arquivo contiver "contract" será mapeado em contractFile; se contiver "invoice" ou "nota" será mapeado em invoiceFile.
  - 201: Sale

  Exemplo cURL:
    curl -X POST http://localhost:3000/api/sales ^
      -H "Authorization: Bearer <token>" ^
      -F "clientName=Maria" -F "phone=55988888888" -F "saleDate=2025-10-01" ^
      -F "files=@C:\\caminho\\contract.pdf" -F "files=@C:\\caminho\\nota-fiscal.pdf"

- GET /sales
  - 200: Sale[]

- GET /sales/:id
  - 200: Sale | 404

- PUT /sales/:id
  - Body JSON parcial (sem upload)
  - 200: Sale

- DELETE /sales/:id
  - 200: { ok: true }

- POST /sales/list-by-month
  - Body JSON: { "months": ["YYYY-MM", "YYYY-MM"] }
  - Regra: filtra por prefixo em saleDate
  - 200: Sale[]

4) Domain events e notificação
- Ao criar Customer ou Sale, eventos são emitidos internamente: "customer.created" e "sale.created".
- Um listener posta no microserviço de notification: POST http://notification:4000/events com body: { type, payload }
- Para desenvolvimento local sem Docker, configure NOTIFICATION_URL=http://localhost:4000/events.

5) Dicas para frontend com ChatGPT
- Sempre peça para o ChatGPT respeitar os contratos acima e usar Authorization: Bearer <token>.
- Exemplos de prompts:
  - "Gere um serviço TypeScript com Axios que faça login em POST /api/auth/login e mantenha o token em um interceptor, com tipagens para as respostas."
  - "Crie um formulário React (Next.js) para criar Customer, enviando multipart/form-data com invoices[]. Campos: name, phone, email, cpfOrCnpj, address, acquisitionDate, entryValue, monthlyValue, nextPaymentDate, productDescription."
  - "Implemente uma página com tabela para listar Customers e botão para filtrar por meses via POST /api/customers/list-by-month com months em [YYYY-MM]."
  - "Crie hooks React para Sales (listar, criar com upload de contract/invoice, editar, deletar)."

6) Integração com n8n
- Passos típicos:
  1. HTTP Request Node -> POST /api/auth/login -> extrair token
  2. Set Node -> salvar token em variável
  3. HTTP Request Node(s) -> chamadas protegidas com header Authorization: Bearer {{$json.token}}
  4. Para upload, use multipart/form-data com campo files[] ou invoices[] conforme endpoint.

7) Schemas OpenAPI
- Para tooling automático, use o arquivo docs/openapi.yaml (OpenAPI 3.0) e/ou Swagger em /api/docs.

