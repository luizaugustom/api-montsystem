# 🔧 EXEMPLOS PRÁTICOS - INTEGRAÇÃO FRONTEND

## 🚀 CONFIGURAÇÃO INICIAL

### 1. Configuração do Axios
```typescript
// api/client.ts
import axios from 'axios';

const API_BASE_URL = 'http://localhost:3001';

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000, // 30s para requisições SEFAZ
});

// Interceptor para adicionar token automaticamente
apiClient.interceptors.request.use((config) => {
  const token = localStorage.getItem('auth_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Interceptor para tratar respostas e erros
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Token expirado - redirecionar para login
      localStorage.removeItem('auth_token');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);
```

### 2. Service de Autenticação
```typescript
// services/auth.service.ts
import { apiClient } from '../api/client';

interface LoginCredentials {
  username: string;
  password: string;
}

interface AuthResponse {
  token: string;
}

export class AuthService {
  static async login(credentials: LoginCredentials): Promise<AuthResponse> {
    const response = await apiClient.post<AuthResponse>('/auth/login', credentials);
    
    // Salvar token no localStorage
    localStorage.setItem('auth_token', response.data.token);
    
    return response.data;
  }

  static logout(): void {
    localStorage.removeItem('auth_token');
    window.location.href = '/login';
  }

  static isAuthenticated(): boolean {
    return !!localStorage.getItem('auth_token');
  }

  static getToken(): string | null {
    return localStorage.getItem('auth_token');
  }
}
```

---

## 👥 SERVIÇOS - CLIENTES

```typescript
// services/customers.service.ts
import { apiClient } from '../api/client';

export interface Customer {
  id: string;
  clientName: string;
  phone: string;
  entryValue: number;
  entryValueCents: number;
  monthlyValue: number;
  monthlyValueCents: number;
  createdAt: string;
  updatedAt: string;
}

export interface CreateCustomerData {
  clientName: string;
  phone: string;
  entryValue: string; // "R$ 500,00"
  monthlyValue: string; // "R$ 200,00"
}

export class CustomersService {
  static async getAll(): Promise<Customer[]> {
    const response = await apiClient.get<Customer[]>('/customers');
    return response.data;
  }

  static async getById(id: string): Promise<Customer> {
    const response = await apiClient.get<Customer>(`/customers/${id}`);
    return response.data;
  }

  static async create(data: CreateCustomerData): Promise<Customer> {
    const response = await apiClient.post<Customer>('/customers', data);
    return response.data;
  }

  static async update(id: string, data: Partial<CreateCustomerData>): Promise<Customer> {
    const response = await apiClient.put<Customer>(`/customers/${id}`, data);
    return response.data;
  }

  static async delete(id: string): Promise<void> {
    await apiClient.delete(`/customers/${id}`);
  }
}
```

---

## 🛒 SERVIÇOS - VENDAS

```typescript
// services/sales.service.ts
import { apiClient } from '../api/client';

export interface Sale {
  id: string;
  clientId?: string;
  clientName: string;
  phone: string;
  productDescription: string;
  entryValue: number;
  entryValueCents: number;
  monthlyValue: number;
  monthlyValueCents: number;
  installments: number;
  saleValue: number;
  saleValueCents: number;
  createdAt: string;
  updatedAt: string;
}

export interface CreateSaleData {
  clientId?: string;
  clientName: string;
  phone: string;
  productDescription: string;
  entryValue: string; // "R$ 1.000,00"
  monthlyValue: string; // "R$ 300,00"
  installments: number;
  saleValue: string; // "R$ 4.600,00"
}

export class SalesService {
  static async getAll(): Promise<Sale[]> {
    const response = await apiClient.get<Sale[]>('/sales');
    return response.data;
  }

  static async getById(id: string): Promise<Sale> {
    const response = await apiClient.get<Sale>(`/sales/${id}`);
    return response.data;
  }

  static async create(data: CreateSaleData): Promise<Sale> {
    const response = await apiClient.post<Sale>('/sales', data);
    return response.data;
  }

  static async update(id: string, data: Partial<CreateSaleData>): Promise<Sale> {
    const response = await apiClient.put<Sale>(`/sales/${id}`, data);
    return response.data;
  }

  static async delete(id: string): Promise<void> {
    await apiClient.delete(`/sales/${id}`);
  }
}
```

---

## 📄 SERVIÇOS - NOTAS FISCAIS

```typescript
// services/invoices.service.ts
import { apiClient } from '../api/client';

export type InvoiceStatus = 'draft' | 'pending' | 'sent' | 'authorized' | 'cancelled' | 'rejected';
export type InvoiceType = 'nfe' | 'nfce' | 'nfse';

export interface Invoice {
  id: string;
  number: string;
  series: string;
  type: InvoiceType;
  status: InvoiceStatus;
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
}

export interface CreateInvoiceData {
  number: string;
  series: string;
  type?: InvoiceType;
  issueDate: string;
  dueDate?: string;
  totalValue: string; // "R$ 1.500,00"
  taxValue?: string;
  discountValue?: string;
  clientName: string;
  clientDocument: string;
  clientEmail?: string;
  clientAddress?: string;
  description: string;
  saleId?: string;
}

export interface InvoiceFilters {
  status?: InvoiceStatus;
  clientDocument?: string;
  startDate?: string;
  endDate?: string;
  saleId?: string;
}

export class InvoicesService {
  static async getAll(filters?: InvoiceFilters): Promise<Invoice[]> {
    const params = new URLSearchParams();
    
    if (filters) {
      Object.entries(filters).forEach(([key, value]) => {
        if (value) params.append(key, value);
      });
    }
    
    const response = await apiClient.get<Invoice[]>(`/invoices?${params.toString()}`);
    return response.data;
  }

  static async getById(id: string): Promise<Invoice> {
    const response = await apiClient.get<Invoice>(`/invoices/${id}`);
    return response.data;
  }

  static async create(data: CreateInvoiceData): Promise<Invoice> {
    const response = await apiClient.post<Invoice>('/invoices', data);
    return response.data;
  }

  static async update(id: string, data: Partial<CreateInvoiceData>): Promise<Invoice> {
    const response = await apiClient.put<Invoice>(`/invoices/${id}`, data);
    return response.data;
  }

  static async delete(id: string): Promise<void> {
    await apiClient.delete(`/invoices/${id}`);
  }

  static async getNextNumber(series: string): Promise<{ series: string; nextNumber: string }> {
    const response = await apiClient.get(`/invoices/next-number/${series}`);
    return response.data;
  }

  // === MÉTODOS SEFAZ ===

  static async sendToSefaz(id: string): Promise<Invoice> {
    const response = await apiClient.post<Invoice>(`/invoices/${id}/send-sefaz`);
    return response.data;
  }

  static async consultSefazStatus(id: string): Promise<{ invoice: Invoice; sefazStatus: any }> {
    const response = await apiClient.get(`/invoices/${id}/sefaz-status`);
    return response.data;
  }

  static async cancelNFe(id: string, justificativa: string): Promise<Invoice> {
    const response = await apiClient.post<Invoice>(`/invoices/${id}/cancel`, {
      justificativa
    });
    return response.data;
  }

  static async uploadFiles(id: string, files: File[]): Promise<{ message: string; files: any }> {
    const formData = new FormData();
    files.forEach(file => formData.append('files', file));
    
    const response = await apiClient.post(`/invoices/${id}/files`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    });
    return response.data;
  }

  static async getStats(): Promise<any> {
    const response = await apiClient.get('/invoices/stats');
    return response.data;
  }
}
```

---

## 🎨 COMPONENTES REACT - EXEMPLOS

### 1. Hook de Moeda
```typescript
// hooks/useCurrency.ts
import { useMemo } from 'react';

export const useCurrency = () => {
  const formatCurrency = (value: number): string => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value);
  };

  const parseCurrency = (value: string): number => {
    // Remove tudo exceto números, vírgula e ponto
    const cleaned = value.replace(/[^\d,.]/g, '');
    
    // Se tem vírgula, assumir formato brasileiro
    if (cleaned.includes(',')) {
      return parseFloat(cleaned.replace(/\./g, '').replace(',', '.'));
    }
    
    return parseFloat(cleaned);
  };

  const formatToCurrencyString = (value: number): string => {
    return formatCurrency(value);
  };

  return {
    formatCurrency,
    parseCurrency,
    formatToCurrencyString
  };
};
```

### 2. Input de Moeda
```typescript
// components/CurrencyInput.tsx
import React, { useState, useEffect } from 'react';
import { useCurrency } from '../hooks/useCurrency';

interface CurrencyInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
}

export const CurrencyInput: React.FC<CurrencyInputProps> = ({
  value,
  onChange,
  placeholder = "R$ 0,00",
  disabled = false
}) => {
  const [displayValue, setDisplayValue] = useState(value);
  const { parseCurrency, formatCurrency } = useCurrency();

  useEffect(() => {
    setDisplayValue(value);
  }, [value]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const inputValue = e.target.value;
    
    // Permitir apenas números, vírgula, ponto e R$
    const cleaned = inputValue.replace(/[^\d,.R$ ]/g, '');
    
    setDisplayValue(cleaned);
    onChange(cleaned);
  };

  const handleBlur = () => {
    try {
      const numericValue = parseCurrency(displayValue);
      if (!isNaN(numericValue)) {
        const formatted = formatCurrency(numericValue);
        setDisplayValue(formatted);
        onChange(formatted);
      }
    } catch (error) {
      console.warn('Erro ao formatar moeda:', error);
    }
  };

  return (
    <input
      type="text"
      value={displayValue}
      onChange={handleChange}
      onBlur={handleBlur}
      placeholder={placeholder}
      disabled={disabled}
      className="border rounded px-3 py-2 w-full"
    />
  );
};
```

### 3. Status Badge
```typescript
// components/StatusBadge.tsx
import React from 'react';
import { InvoiceStatus } from '../services/invoices.service';

interface StatusBadgeProps {
  status: InvoiceStatus;
}

const statusConfig = {
  draft: { label: 'Rascunho', color: 'bg-gray-500' },
  pending: { label: 'Pendente', color: 'bg-yellow-500' },
  sent: { label: 'Enviado', color: 'bg-blue-500' },
  authorized: { label: 'Autorizado', color: 'bg-green-500' },
  cancelled: { label: 'Cancelado', color: 'bg-orange-500' },
  rejected: { label: 'Rejeitado', color: 'bg-red-500' }
};

export const StatusBadge: React.FC<StatusBadgeProps> = ({ status }) => {
  const config = statusConfig[status];
  
  return (
    <span className={`inline-block px-2 py-1 text-xs font-semibold text-white rounded-full ${config.color}`}>
      {config.label}
    </span>
  );
};
```

### 4. Formulário de Nota Fiscal
```typescript
// components/InvoiceForm.tsx
import React, { useState, useEffect } from 'react';
import { CreateInvoiceData, InvoicesService } from '../services/invoices.service';
import { SalesService, Sale } from '../services/sales.service';
import { CurrencyInput } from './CurrencyInput';

interface InvoiceFormProps {
  onSubmit: (data: CreateInvoiceData) => void;
  onCancel: () => void;
  initialData?: Partial<CreateInvoiceData>;
}

export const InvoiceForm: React.FC<InvoiceFormProps> = ({
  onSubmit,
  onCancel,
  initialData = {}
}) => {
  const [formData, setFormData] = useState<CreateInvoiceData>({
    number: '',
    series: '1',
    type: 'nfe',
    issueDate: new Date().toISOString().split('T')[0],
    totalValue: 'R$ 0,00',
    clientName: '',
    clientDocument: '',
    description: '',
    ...initialData
  });

  const [sales, setSales] = useState<Sale[]>([]);
  const [nextNumber, setNextNumber] = useState<string>('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadInitialData();
  }, []);

  const loadInitialData = async () => {
    try {
      // Carregar vendas para select
      const salesData = await SalesService.getAll();
      setSales(salesData);

      // Obter próximo número
      const nextNum = await InvoicesService.getNextNumber(formData.series);
      setNextNumber(nextNum.nextNumber);
      setFormData(prev => ({ ...prev, number: nextNum.nextNumber }));
    } catch (error) {
      console.error('Erro ao carregar dados iniciais:', error);
    }
  };

  const handleSaleChange = (saleId: string) => {
    const sale = sales.find(s => s.id === saleId);
    if (sale) {
      setFormData(prev => ({
        ...prev,
        saleId,
        clientName: sale.clientName,
        totalValue: `R$ ${sale.saleValue.toFixed(2).replace('.', ',')}`,
        description: `Referente à venda: ${sale.productDescription}`
      }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    
    try {
      await onSubmit(formData);
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium mb-1">Número</label>
          <input
            type="text"
            value={formData.number}
            onChange={(e) => setFormData(prev => ({ ...prev, number: e.target.value }))}
            className="border rounded px-3 py-2 w-full"
            required
          />
        </div>
        
        <div>
          <label className="block text-sm font-medium mb-1">Série</label>
          <select
            value={formData.series}
            onChange={(e) => setFormData(prev => ({ ...prev, series: e.target.value }))}
            className="border rounded px-3 py-2 w-full"
            required
          >
            <option value="1">1</option>
            <option value="2">2</option>
            <option value="3">3</option>
          </select>
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium mb-1">Venda Relacionada (Opcional)</label>
        <select
          value={formData.saleId || ''}
          onChange={(e) => handleSaleChange(e.target.value)}
          className="border rounded px-3 py-2 w-full"
        >
          <option value="">Nenhuma venda selecionada</option>
          {sales.map(sale => (
            <option key={sale.id} value={sale.id}>
              {sale.clientName} - {sale.productDescription}
            </option>
          ))}
        </select>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium mb-1">Data de Emissão</label>
          <input
            type="date"
            value={formData.issueDate}
            onChange={(e) => setFormData(prev => ({ ...prev, issueDate: e.target.value }))}
            className="border rounded px-3 py-2 w-full"
            required
          />
        </div>
        
        <div>
          <label className="block text-sm font-medium mb-1">Data de Vencimento</label>
          <input
            type="date"
            value={formData.dueDate || ''}
            onChange={(e) => setFormData(prev => ({ ...prev, dueDate: e.target.value }))}
            className="border rounded px-3 py-2 w-full"
          />
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium mb-1">Valor Total</label>
        <CurrencyInput
          value={formData.totalValue}
          onChange={(value) => setFormData(prev => ({ ...prev, totalValue: value }))}
        />
      </div>

      <div>
        <label className="block text-sm font-medium mb-1">Cliente</label>
        <input
          type="text"
          value={formData.clientName}
          onChange={(e) => setFormData(prev => ({ ...prev, clientName: e.target.value }))}
          className="border rounded px-3 py-2 w-full"
          required
        />
      </div>

      <div>
        <label className="block text-sm font-medium mb-1">CPF/CNPJ</label>
        <input
          type="text"
          value={formData.clientDocument}
          onChange={(e) => setFormData(prev => ({ ...prev, clientDocument: e.target.value }))}
          className="border rounded px-3 py-2 w-full"
          required
        />
      </div>

      <div>
        <label className="block text-sm font-medium mb-1">Descrição</label>
        <textarea
          value={formData.description}
          onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
          className="border rounded px-3 py-2 w-full h-24"
          required
        />
      </div>

      <div className="flex gap-2 pt-4">
        <button
          type="submit"
          disabled={loading}
          className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600 disabled:opacity-50"
        >
          {loading ? 'Salvando...' : 'Salvar'}
        </button>
        
        <button
          type="button"
          onClick={onCancel}
          className="bg-gray-500 text-white px-4 py-2 rounded hover:bg-gray-600"
        >
          Cancelar
        </button>
      </div>
    </form>
  );
};
```

### 5. Modal SEFAZ
```typescript
// components/SefazModal.tsx
import React, { useState } from 'react';
import { Invoice, InvoicesService } from '../services/invoices.service';
import { StatusBadge } from './StatusBadge';

interface SefazModalProps {
  invoice: Invoice;
  isOpen: boolean;
  onClose: () => void;
  onUpdate: (invoice: Invoice) => void;
}

export const SefazModal: React.FC<SefazModalProps> = ({
  invoice,
  isOpen,
  onClose,
  onUpdate
}) => {
  const [loading, setLoading] = useState(false);
  const [cancelJustification, setCancelJustification] = useState('');

  if (!isOpen) return null;

  const handleSendToSefaz = async () => {
    setLoading(true);
    try {
      const updated = await InvoicesService.sendToSefaz(invoice.id);
      onUpdate(updated);
      alert('NFe enviada para SEFAZ com sucesso!');
    } catch (error: any) {
      alert(`Erro: ${error.response?.data?.message || error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleConsultStatus = async () => {
    setLoading(true);
    try {
      const result = await InvoicesService.consultSefazStatus(invoice.id);
      onUpdate(result.invoice);
      alert(`Status: ${result.sefazStatus.message}`);
    } catch (error: any) {
      alert(`Erro: ${error.response?.data?.message || error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = async () => {
    if (cancelJustification.length < 15) {
      alert('Justificativa deve ter pelo menos 15 caracteres');
      return;
    }

    setLoading(true);
    try {
      const updated = await InvoicesService.cancelNFe(invoice.id, cancelJustification);
      onUpdate(updated);
      alert('NFe cancelada com sucesso!');
      setCancelJustification('');
    } catch (error: any) {
      alert(`Erro: ${error.response?.data?.message || error.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-md">
        <h2 className="text-xl font-bold mb-4">SEFAZ - NFe {invoice.number}/{invoice.series}</h2>
        
        <div className="space-y-4">
          <div>
            <strong>Status:</strong> <StatusBadge status={invoice.status} />
          </div>
          
          {invoice.accessKey && (
            <div>
              <strong>Chave de Acesso:</strong>
              <br />
              <code className="text-xs bg-gray-100 p-1 rounded">{invoice.accessKey}</code>
            </div>
          )}
          
          {invoice.protocolNumber && (
            <div>
              <strong>Protocolo:</strong> {invoice.protocolNumber}
            </div>
          )}
          
          {invoice.sefazResponse && (
            <div>
              <strong>Resposta SEFAZ:</strong>
              <br />
              <small className="text-gray-600">{invoice.sefazResponse}</small>
            </div>
          )}

          <div className="space-y-2">
            {invoice.status === 'draft' && (
              <button
                onClick={handleSendToSefaz}
                disabled={loading}
                className="w-full bg-blue-500 text-white py-2 rounded hover:bg-blue-600 disabled:opacity-50"
              >
                {loading ? 'Enviando...' : 'Enviar para SEFAZ'}
              </button>
            )}

            {['authorized', 'rejected'].includes(invoice.status) && (
              <button
                onClick={handleConsultStatus}
                disabled={loading}
                className="w-full bg-green-500 text-white py-2 rounded hover:bg-green-600 disabled:opacity-50"
              >
                {loading ? 'Consultando...' : 'Consultar Status'}
              </button>
            )}

            {invoice.status === 'authorized' && (
              <div className="space-y-2">
                <textarea
                  value={cancelJustification}
                  onChange={(e) => setCancelJustification(e.target.value)}
                  placeholder="Justificativa para cancelamento (mín. 15 caracteres)"
                  className="w-full border rounded px-3 py-2 h-20"
                />
                <button
                  onClick={handleCancel}
                  disabled={loading || cancelJustification.length < 15}
                  className="w-full bg-red-500 text-white py-2 rounded hover:bg-red-600 disabled:opacity-50"
                >
                  {loading ? 'Cancelando...' : 'Cancelar NFe'}
                </button>
              </div>
            )}
          </div>
        </div>

        <button
          onClick={onClose}
          className="mt-4 w-full bg-gray-500 text-white py-2 rounded hover:bg-gray-600"
        >
          Fechar
        </button>
      </div>
    </div>
  );
};
```

---

## 🔄 HOOKS CUSTOMIZADOS

### Hook para Notificações Toast
```typescript
// hooks/useToast.ts
import { useState, useCallback } from 'react';

export type ToastType = 'success' | 'error' | 'warning' | 'info';

interface Toast {
  id: string;
  message: string;
  type: ToastType;
}

export const useToast = () => {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const addToast = useCallback((message: string, type: ToastType = 'info') => {
    const id = Math.random().toString(36).substr(2, 9);
    setToasts(prev => [...prev, { id, message, type }]);
    
    // Auto remove após 5 segundos
    setTimeout(() => {
      setToasts(prev => prev.filter(toast => toast.id !== id));
    }, 5000);
  }, []);

  const removeToast = useCallback((id: string) => {
    setToasts(prev => prev.filter(toast => toast.id !== id));
  }, []);

  return {
    toasts,
    addToast,
    removeToast,
    success: (message: string) => addToast(message, 'success'),
    error: (message: string) => addToast(message, 'error'),
    warning: (message: string) => addToast(message, 'warning'),
    info: (message: string) => addToast(message, 'info'),
  };
};
```

---

## 📱 EXEMPLO DE LAYOUT RESPONSIVO

```typescript
// components/Layout.tsx
import React from 'react';
import { useNavigate } from 'react-router-dom';
import { AuthService } from '../services/auth.service';

interface LayoutProps {
  children: React.ReactNode;
}

export const Layout: React.FC<LayoutProps> = ({ children }) => {
  const navigate = useNavigate();

  const handleLogout = () => {
    AuthService.logout();
    navigate('/login');
  };

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Header */}
      <header className="bg-blue-600 text-white p-4">
        <div className="container mx-auto flex justify-between items-center">
          <h1 className="text-xl font-bold">Mont System</h1>
          <button
            onClick={handleLogout}
            className="bg-blue-700 px-3 py-1 rounded hover:bg-blue-800"
          >
            Sair
          </button>
        </div>
      </header>

      <div className="container mx-auto flex">
        {/* Sidebar */}
        <nav className="w-64 bg-white shadow-lg h-screen sticky top-0">
          <div className="p-4">
            <ul className="space-y-2">
              <li>
                <a href="/dashboard" className="block p-2 hover:bg-gray-100 rounded">
                  📊 Dashboard
                </a>
              </li>
              <li>
                <a href="/customers" className="block p-2 hover:bg-gray-100 rounded">
                  👥 Clientes
                </a>
              </li>
              <li>
                <a href="/sales" className="block p-2 hover:bg-gray-100 rounded">
                  🛒 Vendas
                </a>
              </li>
              <li>
                <a href="/invoices" className="block p-2 hover:bg-gray-100 rounded">
                  📄 Notas Fiscais
                </a>
              </li>
            </ul>
          </div>
        </nav>

        {/* Main Content */}
        <main className="flex-1 p-6">
          {children}
        </main>
      </div>
    </div>
  );
};
```

---

Com estes exemplos práticos, você terá tudo o que precisa para implementar um frontend completo e funcional! 🚀