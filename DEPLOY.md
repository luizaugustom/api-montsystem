# Deploy — Mont System (produção)

Checklist para subir **sem** provisionar automaticamente: você cria os recursos; o código já está preparado.

## Arquitetura

| Peça | Onde |
|------|------|
| Frontend Next.js | Vercel |
| API NestJS | DigitalOcean App Platform (Dockerfile) |
| Postgres | DigitalOcean Managed Database |
| Anexos (tickets) | DigitalOcean Spaces |

**Fora deste guia:** Evolution/WhatsApp, serviço `notification`, disco local `storage/`.

---

## 1. Managed Postgres (DigitalOcean)

1. Crie um cluster Postgres (mesma região do App Platform, ex. `nyc`).
2. Crie o database `montsystem` (ou o nome que preferir).
3. Anote **host**, **port** (geralmente `25060` com SSL), **user**, **password**, **database**.
4. Em **Trusted Sources**, permita o App Platform (ou a VPC) acessar o banco.
5. Confirme que a extensão `uuid-ossp` pode ser criada (a migration inicial executa `CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`).

Mapeamento de envs da API:

| Env | Valor |
|-----|--------|
| `DATABASE_HOST` | host do cluster |
| `DATABASE_PORT` | porta (ex. `25060`) |
| `DATABASE_USER` | usuário |
| `DATABASE_PASSWORD` | senha |
| `DATABASE_NAME` | nome do DB |
| `DATABASE_SSL` | `true` |
| `TYPEORM_SYNC` | `false` |

No boot do container a API roda **migrations** e depois sobe o Nest (`Dockerfile` CMD).

---

## 2. Spaces (anexos)

1. Crie um Space (ex. `montsystem-chamados`) na região desejada.
2. Crie API key com permissão de leitura/escrita no Space.
3. Configure CDN/URL pública se for servir anexos diretamente.
4. Preencha:

- `DO_SPACES_REGION`
- `DO_SPACES_ENDPOINT` (ex. `https://nyc3.digitaloceanspaces.com`)
- `DO_SPACES_BUCKET`
- `DO_SPACES_ACCESS_KEY_ID`
- `DO_SPACES_SECRET_ACCESS_KEY`
- `DO_SPACES_PUBLIC_URL`
- `DO_SPACES_KEY_PREFIX` (ex. `tickets`)

Sem Spaces a API sobe; uploads de tickets ficam vazios.

---

## 3. App Platform (API)

1. Conecte o repositório `api-montsystem`.
2. Use o `Dockerfile` na raiz (ou importe `.do/app.yaml` e ajuste `github.repo`).
3. **HTTP port:** `3000`
4. **Health check:** `GET /health`
5. Envs obrigatórias:

| Env | Notas |
|-----|--------|
| `NODE_ENV` | `production` |
| `PORT` | `3000` |
| `JWT_SECRET` | `openssl rand -base64 48` |
| `CORS_ORIGINS` | origins do front, vírgula — ex. `https://seu-app.vercel.app,https://app.seudominio.com` |
| `ADMIN_USER` / `ADMIN_PASSWORD` | só no **primeiro** boot (tabela `users` vazia) |
| `DATABASE_*` / `DATABASE_SSL` | ver seção 1 |
| `TYPEORM_SYNC` | `false` |
| `DO_SPACES_*` | ver seção 2 |

6. Opcionais: Unimake, Focus NFe, Resend (ver `.env.example`).
7. Deploy. Confirme:
   - `https://<api-host>/health` → `{ "status": "ok" }`
   - `https://<api-host>/api/docs` → Swagger

**CORS:** em produção a API **não sobe** sem `CORS_ORIGINS`. Inclua também URLs de Preview da Vercel se for usá-las.

---

## 4. Vercel (frontend)

Repositório: `front-montsystem` (raiz do projeto Next).

1. Import project → Framework Preset **Next.js**.
2. Env **Production** (e Preview se quiser):

```
NEXT_PUBLIC_API_URL=https://<api-host>/api
```

3. Deploy.
4. Copie a URL (`*.vercel.app` ou domínio custom) e **adicione em `CORS_ORIGINS`** na API; redeploy a API se necessário.

Arquivo de referência local: `.env.local.example`.

---

## 5. Pós-deploy

1. Login com `ADMIN_USER` / `ADMIN_PASSWORD` e troque a senha.
2. Configure empresa/integrações na UI conforme necessário.
3. Teste upload de anexo em chamado (Spaces).
4. Não dependa de arquivos em `storage/` no App Platform (filesystem efêmero).

---

## Dev local (rápido)

```bash
# API
cp .env.example .env   # preencha JWT_SECRET, etc.
# TYPEORM_SYNC=true no .env para schema automático em dev
npm run start:dev

# Ou schema via migrations:
# TYPEORM_SYNC=false
npm run migration:run
npm run start:dev

# Front
NEXT_PUBLIC_API_URL=http://localhost:3000/api npm run dev
```

Scripts úteis:

- `npm run build` / `npm start` — produção local (sem migrate)
- `npm run start:prod` — migrate + start (após build)
- `npm run migration:generate -- src/migrations/NomeDaMudanca`
- `npm run migration:run` / `migration:revert`

---

## Critérios de pronto

- [ ] Postgres gerenciado acessível com SSL
- [ ] App Platform healthy em `/api/health`
- [ ] Migrations aplicadas (tabelas criadas)
- [ ] Front na Vercel com `NEXT_PUBLIC_API_URL` apontando para a API
- [ ] `CORS_ORIGINS` inclui a origin do front
- [ ] Spaces configurado (se for usar anexos)
