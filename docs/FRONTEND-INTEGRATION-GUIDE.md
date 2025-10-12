# 📋 DOCUMENTAÇÃO COMPLETA - API MONT SYSTEM

## 🎯 VISÃO GERAL

Esta é a documentação técnica completa da **API Mont System** - um sistema de gestão com funcionalidades de vendas, clientes, notas fiscais e integração SEFAZ. A API é desenvolvida em **NestJS + TypeScript** com autenticação JWT e integração completa para emissão de NFe.

---

## 🔐 AUTENTICAÇÃO

### Base URL
```
http://localhost:3001
```

### Login
```http
POST /auth/login
Content-Type: application/json

{
  "username": "luiz",
  "password": "832010pj"
}
```

**Resposta:**
```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

### Headers Obrigatórios
```http
Authorization: Bearer {token}
```

---

## 💰 UTILITÁRIOS DE MOEDA

A API aceita valores monetários em **múltiplos formatos**:

### Formatos Aceitos:
- `"R$ 1.234,56"` ✅
- `"1.234,56"` ✅  
- `"1234.56"` ✅
- `1234.56` (number) ✅

### Conversão Automática:
- **Frontend → API**: Envie `"R$ 1.234,56"`
- **API → Database**: Converte para `1234.56` (float) e `123456` (cents)
- **API → Frontend**: Retorna `1234.56` (float)

---

## 👥 MÓDULO CLIENTES

### 1. Listar Clientes
```http
GET /customers
Authorization: Bearer {token}
```

### 2. Buscar Cliente por ID
```http
GET /customers/{id}
Authorization: Bearer {token}
```

### 3. Criar Cliente
```http
POST /customers
Authorization: Bearer {token}
Content-Type: application/json

{
  "clientName": "João Silva",
  "phone": "11999887766",
  "entryValue": "R$ 500,00",      // Valor entrada
  "monthlyValue": "R$ 200,00"     // Valor mensal
}
```

### 4. Atualizar Cliente
```http
PUT /customers/{id}
Authorization: Bearer {token}
Content-Type: application/json

{
  "clientName": "João Silva Atualizado",
  "phone": "11999887766",
  "entryValue": "R$ 600,00",
  "monthlyValue": "R$ 250,00"
}
```

### 5. Deletar Cliente
```http
DELETE /customers/{id}
Authorization: Bearer {token}
```

**Estrutura do Cliente:**
```typescript
interface Customer {
  id: string;
  clientName: string;
  phone: string;
  entryValue: number;        // Valor como float
  entryValueCents: number;   // Valor em centavos
  monthlyValue: number;      // Valor como float
  monthlyValueCents: number; // Valor em centavos
  createdAt: string;
  updatedAt: string;
}
```

---

## 🛒 MÓDULO VENDAS

### 1. Listar Vendas
```http
GET /sales
Authorization: Bearer {token}
```

### 2. Buscar Venda por ID
```http
GET /sales/{id}
Authorization: Bearer {token}
```

### 3. Criar Venda
```http
POST /sales
Authorization: Bearer {token}
Content-Type: application/json

{
  "clientId": "uuid-do-cliente",          // Opcional
  "clientName": "Maria Silva",
  "phone": "11988776655", 
  "productDescription": "Sistema de monitoramento Premium",
  "entryValue": "R$ 1.000,00",           // Valor entrada
  "monthlyValue": "R$ 300,00",           // Valor mensal
  "installments": 12,                     // Parcelas
  "saleValue": "R$ 4.600,00"             // Valor total da venda
}
```

### 4. Atualizar Venda
```http
PUT /sales/{id}
Authorization: Bearer {token}
Content-Type: application/json

{
  "clientName": "Maria Silva Costa",
  "phone": "11988776655",
  "productDescription": "Sistema Premium Atualizado", 
  "entryValue": "R$ 1.200,00",
  "monthlyValue": "R$ 350,00",
  "installments": 10,
  "saleValue": "R$ 4.700,00"
}
```

### 5. Deletar Venda
```http
DELETE /sales/{id}
Authorization: Bearer {token}
```

**Estrutura da Venda:**
```typescript
interface Sale {
  id: string;
  clientId?: string;
  clientName: string;
  phone: string;
  productDescription: string;
  entryValue: number;        // Valor como float
  entryValueCents: number;   // Valor em centavos
  monthlyValue: number;      // Valor como float  
  monthlyValueCents: number; // Valor em centavos
  installments: number;
  saleValue: number;         // Valor como float
  saleValueCents: number;    // Valor em centavos
  createdAt: string;
  updatedAt: string;
}
```

---

## 📄 MÓDULO NOTAS FISCAIS

### 1. Listar Notas Fiscais
```http
GET /invoices
Authorization: Bearer {token}

# Com filtros opcionais:
GET /invoices?status=authorized
GET /invoices?clientDocument=12345678901
GET /invoices?startDate=2025-10-01&endDate=2025-10-31
```

### 2. Buscar Nota Fiscal por ID
```http
GET /invoices/{id}
Authorization: Bearer {token}
```

### 3. Criar Nota Fiscal
```http
POST /invoices
Authorization: Bearer {token}
Content-Type: application/json

{
  "number": "123",
  "series": "1", 
  "type": "nfe",                        // nfe, nfce, nfse
  "issueDate": "2025-10-10",
  "dueDate": "2025-11-10",              // Opcional
  "totalValue": "R$ 1.500,00",
  "taxValue": "150,00",                 // Opcional
  "discountValue": "50,00",             // Opcional
  "clientName": "João Silva",
  "clientDocument": "12345678901",      // CPF/CNPJ
  "clientEmail": "joao@email.com",      // Opcional
  "clientAddress": "Rua A, 123, SP",    // Opcional
  "description": "Prestação de serviços de monitoramento",
  "saleId": "uuid-da-venda"             // Opcional
}
```

### 4. Atualizar Nota Fiscal
```http
PUT /invoices/{id}
Authorization: Bearer {token}
Content-Type: application/json

{
  "clientName": "João Silva Atualizado",
  "totalValue": "R$ 1.600,00",
  "description": "Serviços atualizados"
}
```

### 5. Atualizar Status
```http
PUT /invoices/{id}/status
Authorization: Bearer {token}
Content-Type: application/json

{
  "status": "authorized",               // draft, pending, sent, authorized, cancelled, rejected
  "accessKey": "35250512345678000190550010000000011234567890",  // Opcional
  "protocolNumber": "135251010123456",  // Opcional
  "sefazResponse": "Autorizado o uso da NF-e"  // Opcional
}
```

### 6. Deletar Nota Fiscal
```http
DELETE /invoices/{id}
Authorization: Bearer {token}
```

**Estrutura da Nota Fiscal:**
```typescript
interface Invoice {
  id: string;
  number: string;
  series: string;
  type: 'nfe' | 'nfce' | 'nfse';
  status: 'draft' | 'pending' | 'sent' | 'authorized' | 'cancelled' | 'rejected';
  issueDate: string;
  dueDate?: string;
  totalValue: number;
  totalValueCents: number;
  taxValue?: number;
  discountValue?: number;
  clientName: string;
  clientDocument: string;
  clientEmail?: string;
  clientAddress?: string;
  description: string;
  saleId?: string;
  accessKey?: string;
  protocolNumber?: string;
  sefazResponse?: string;
  rejectionReason?: string;
  xmlFilePath?: string;
  pdfFilePath?: string;
  createdAt: string;
  updatedAt: string;
  sale?: Sale;  // Relacionamento
}
```

---

## 🌐 INTEGRAÇÃO SEFAZ (NFe)

### 1. Enviar para SEFAZ
```http
POST /invoices/{id}/send-sefaz
Authorization: Bearer {token}
```

**Processo automático:**
1. Gera XML NFe (layout 4.00)
2. Assina digitalmente 
3. Envia para SEFAZ
4. Consulta retorno
5. Atualiza status
6. Envia email automaticamente

### 2. Consultar Status SEFAZ
```http
GET /invoices/{id}/sefaz-status
Authorization: Bearer {token}
```

### 3. Cancelar NFe
```http
POST /invoices/{id}/cancel
Authorization: Bearer {token}
Content-Type: application/json

{
  "justificativa": "Motivo do cancelamento com pelo menos 15 caracteres"
}
```

### 4. Upload de Arquivos XML/PDF
```http
POST /invoices/{id}/files
Authorization: Bearer {token}
Content-Type: multipart/form-data

files: [arquivo.xml, arquivo.pdf]
```

### 5. Próximo Número da Série
```http
GET /invoices/next-number/{series}
Authorization: Bearer {token}
```

**Resposta:**
```json
{
  "series": "1",
  "nextNumber": "124"
}
```

---

## 📊 ESTATÍSTICAS

### Estatísticas de Notas Fiscais
```http
GET /invoices/stats
Authorization: Bearer {token}
```

**Resposta:**
```json
{
  "total": 150,
  "authorized": 140,
  "pending": 5,
  "rejected": 3,
  "cancelled": 2,
  "totalValue": 45000.00,
  "currentMonth": {
    "total": 25,
    "value": 8500.00
  }
}
```

---

## 🎨 COMPONENTES DE INTERFACE SUGERIDOS

### 1. **FormulárioCliente**
```typescript
interface ClienteForm {
  clientName: string;
  phone: string;
  entryValue: string;    // "R$ 500,00"
  monthlyValue: string;  // "R$ 200,00"
}

// Validações:
// - clientName: obrigatório, min 2 chars
// - phone: obrigatório, formato brasileiro
// - entryValue: obrigatório, moeda válida
// - monthlyValue: obrigatório, moeda válida
```

### 2. **FormulárioVenda** 
```typescript
interface VendaForm {
  clientId?: string;           // Select de clientes existentes
  clientName: string;
  phone: string;
  productDescription: string;
  entryValue: string;         // "R$ 1.000,00"
  monthlyValue: string;       // "R$ 300,00"
  installments: number;       // Slider 1-60
  saleValue: string;          // "R$ 4.600,00" (calculado automaticamente)
}

// Cálculo automático:
// saleValue = entryValue + (monthlyValue * installments)
```

### 3. **FormulárioNotaFiscal**
```typescript
interface NotaFiscalForm {
  number: string;             // Auto-incrementado via API
  series: string;             // Select "1", "2", etc
  type: 'nfe' | 'nfce' | 'nfse';
  issueDate: string;          // Date picker, default hoje
  dueDate?: string;           // Date picker opcional
  totalValue: string;         // "R$ 1.500,00"
  taxValue?: string;          // "R$ 150,00" opcional
  discountValue?: string;     // "R$ 50,00" opcional
  clientName: string;
  clientDocument: string;     // Máscara CPF/CNPJ
  clientEmail?: string;       // Email válido
  clientAddress?: string;     // Textarea
  description: string;        // Textarea obrigatória
  saleId?: string;           // Select de vendas
}
```

### 4. **StatusBadge NFe**
```typescript
interface StatusProps {
  status: 'draft' | 'pending' | 'sent' | 'authorized' | 'cancelled' | 'rejected';
}

// Cores:
// draft: gray
// pending: yellow  
// sent: blue
// authorized: green
// cancelled: orange
// rejected: red
```

### 5. **ModalSEFAZ**
```typescript
interface SefazModalProps {
  invoiceId: string;
  onSuccess: () => void;
}

// Ações:
// - Enviar para SEFAZ
// - Consultar Status
// - Cancelar (com justificativa)
// - Download XML/PDF
```

---

## 🔄 ESTADOS E FLUXOS

### Estados da Nota Fiscal:
```
draft → pending → sent → authorized
                    ↓
                 rejected
                    
authorized → cancelled (com justificativa)
```

### Fluxo Completo NFe:
1. **Criar** nota fiscal (status: draft)
2. **Enviar SEFAZ** → gera XML → assina → envia (status: pending)
3. **SEFAZ autoriza** → recebe protocolo (status: authorized)
4. **Email enviado** automaticamente para cliente
5. **Arquivos disponíveis** para download (XML + PDF)

---

## ⚠️ TRATAMENTO DE ERROS

### Códigos de Status HTTP:
- `200` - Sucesso
- `201` - Criado com sucesso
- `400` - Dados inválidos (Bad Request)
- `401` - Token inválido/expirado (Unauthorized)
- `404` - Recurso não encontrado (Not Found)
- `500` - Erro interno do servidor

### Estrutura de Erro:
```json
{
  "statusCode": 400,
  "message": "Descrição do erro",
  "error": "Bad Request"
}
```

### Erros Comuns:
- **Token expirado**: Redirecionar para login
- **Dados inválidos**: Mostrar mensagens nos campos
- **NFe rejeitada**: Exibir motivo da SEFAZ
- **Email falhou**: Mostrar aviso, mas manter NFe autorizada

---

## 🎯 BOAS PRÁTICAS FRONTEND

### 1. **Máscaras de Input**
```typescript
// Telefone: (11) 99999-9999
// CPF: 999.999.999-99
// CNPJ: 99.999.999/9999-99
// Moeda: R$ 9.999,99
// CEP: 99999-999
```

### 2. **Validações em Tempo Real**
```typescript
// Moeda: aceitar todos os formatos, validar se é número > 0
// Email: validação RFC completa
// CPF/CNPJ: validação com dígitos verificadores
// Telefone: formato brasileiro obrigatório
```

### 3. **Loading States**
```typescript
// Envio SEFAZ: "Enviando para SEFAZ..." (pode demorar 30s)
// Consulta status: "Consultando status..."
// Upload arquivos: Progress bar
// Listagens: Skeleton loading
```

### 4. **Cache Inteligente**
- Lista de clientes: cache 5min
- Lista de vendas: cache 2min  
- Status NFe: sempre fresh (não cachear)
- Próximo número: sempre fresh

### 5. **Notificações/Toasts**
```typescript
// Sucesso: "Cliente criado com sucesso!"
// SEFAZ: "NFe autorizada e email enviado!"
// Erro: "Erro ao salvar. Tente novamente."
// Warning: "NFe rejeitada: [motivo SEFAZ]"
```

---

## 📱 RESPONSIVIDADE

### Layouts Recomendados:

**Desktop:**
- Sidebar com navegação
- Tabelas com todas as colunas
- Modais para formulários
- Dashboard com cards de estatísticas

**Mobile:**
- Bottom navigation ou hamburger menu
- Cards em lista para registros
- Forms em páginas dedicadas
- Tabs para organizar informações

**Tablet:**
- Híbrido desktop/mobile
- Tabelas simplificadas
- Sidebar colapsável

---

## 🔒 SEGURANÇA

### Headers Obrigatórios:
```typescript
const api = axios.create({
  baseURL: 'http://localhost:3001',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  }
});
```

### Interceptors Recomendados:
```typescript
// Request: adicionar token automaticamente
// Response: tratar 401 (token expirado)
// Error: log de erros e tratamento global
```

---

## 🚀 FUNCIONALIDADES AVANÇADAS

### 1. **Auto-complete Clientes**
```http
GET /customers?search=joão
```

### 2. **Importação de Vendas**
```http
POST /sales/import
Content-Type: multipart/form-data
```

### 3. **Relatórios PDF**
```http
GET /invoices/{id}/danfe
Response: application/pdf
```

### 4. **WebSockets** (futuro)
```typescript
// Notificações em tempo real:
// - NFe autorizada
// - Status SEFAZ alterado
// - Novo cliente/venda
```

---

## 🧪 TESTES E DEBUG

### Scripts de Teste Disponíveis:
```bash
# Testar toda a API
node test-invoices-api.js

# Testar integração SEFAZ
node test-sefaz-integration.js

# Testar vendas
node scripts/test-sales-api.js
```

### Debug Headers:
```http
X-Debug: true  # Retorna logs detalhados
```

---

Esta documentação deve ser suficiente para implementar um frontend completo e robusto. A API está 100% funcional e testada! 🚀