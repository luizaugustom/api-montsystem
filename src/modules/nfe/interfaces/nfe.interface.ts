export interface NFeConfig {
  environment: 'homologacao' | 'producao';
  uf: string;
  timeout: number;
  
  company: {
    cnpj: string;
    ie: string;
    name: string;
    fantasy: string;
    crt: number;
    address: {
      street: string;
      number: string;
      neighborhood: string;
      cep: string;
      city: string;
      cityCode: string;
      state: string;
    };
    contact: {
      phone: string;
      email: string;
    };
  };
  
  certificate: {
    path: string;
    password: string;
  };
  
  email: {
    host: string;
    port: number;
    secure: boolean;
    user: string;
    pass: string;
  };
  
  series: number;
  lastNumber: number;
  
  paths: {
    logo?: string;
    danfeTemplate?: string;
  };
}

export interface WebServiceUrls {
  autorizacao: string;
  retAutorizacao: string;
  consultaProtocolo: string;
  statusServico: string;
  recepcaoEvento: string;
}

// URLs dos webservices por UF e ambiente
export const WEBSERVICE_URLS: Record<string, Record<string, WebServiceUrls>> = {
  SP: {
    homologacao: {
      autorizacao: 'https://homologacao.nfe.fazenda.sp.gov.br/ws/nfeautorizacao4.asmx',
      retAutorizacao: 'https://homologacao.nfe.fazenda.sp.gov.br/ws/nferetautorizacao4.asmx',
      consultaProtocolo: 'https://homologacao.nfe.fazenda.sp.gov.br/ws/nfeconsultaprotocolo4.asmx',
      statusServico: 'https://homologacao.nfe.fazenda.sp.gov.br/ws/nfestatusservico4.asmx',
      recepcaoEvento: 'https://homologacao.nfe.fazenda.sp.gov.br/ws/nferecepcaoevento4.asmx'
    },
    producao: {
      autorizacao: 'https://nfe.fazenda.sp.gov.br/ws/nfeautorizacao4.asmx',
      retAutorizacao: 'https://nfe.fazenda.sp.gov.br/ws/nferetautorizacao4.asmx',
      consultaProtocolo: 'https://nfe.fazenda.sp.gov.br/ws/nfeconsultaprotocolo4.asmx',
      statusServico: 'https://nfe.fazenda.sp.gov.br/ws/nfestatusservico4.asmx',
      recepcaoEvento: 'https://nfe.fazenda.sp.gov.br/ws/nferecepcaoevento4.asmx'
    }
  },
  // Adicionar outros estados conforme necessário
  RJ: {
    homologacao: {
      autorizacao: 'https://hom.nfe.fazenda.rj.gov.br/ws/nfeautorizacao4.asmx',
      retAutorizacao: 'https://hom.nfe.fazenda.rj.gov.br/ws/nferetautorizacao4.asmx',
      consultaProtocolo: 'https://hom.nfe.fazenda.rj.gov.br/ws/nfeconsultaprotocolo4.asmx',
      statusServico: 'https://hom.nfe.fazenda.rj.gov.br/ws/nfestatusservico4.asmx',
      recepcaoEvento: 'https://hom.nfe.fazenda.rj.gov.br/ws/nferecepcaoevento4.asmx'
    },
    producao: {
      autorizacao: 'https://nfe.fazenda.rj.gov.br/ws/nfeautorizacao4.asmx',
      retAutorizacao: 'https://nfe.fazenda.rj.gov.br/ws/nferetautorizacao4.asmx',
      consultaProtocolo: 'https://nfe.fazenda.rj.gov.br/ws/nfeconsultaprotocolo4.asmx',
      statusServico: 'https://nfe.fazenda.rj.gov.br/ws/nfestatusservico4.asmx',
      recepcaoEvento: 'https://nfe.fazenda.rj.gov.br/ws/nferecepcaoevento4.asmx'
    }
  }
};

export enum NFeStatus {
  DRAFT = 'draft',
  PENDING = 'pending',
  SENT = 'sent',
  AUTHORIZED = 'authorized',
  CANCELLED = 'cancelled',
  REJECTED = 'rejected'
}

export enum EventType {
  CANCELAMENTO = '110111',
  CARTA_CORRECAO = '110110',
  EPEC = '110140'
}

export interface NFeItem {
  codigo: string;
  descricao: string;
  ncm: string;
  cfop: string;
  unidade: string;
  quantidade: number;
  valorUnitario: number;
  valorTotal: number;
  // Impostos
  icms?: {
    origem: string;
    cst: string;
    aliquota?: number;
    valor?: number;
  };
  pis?: {
    cst: string;
    aliquota?: number;
    valor?: number;
  };
  cofins?: {
    cst: string;
    aliquota?: number;
    valor?: number;
  };
}

export interface NFeData {
  // Identificação
  numero: string;
  serie: string;
  dhEmi: Date;
  dhSaiEnt?: Date;
  
  // Destinatário
  destinatario: {
    cpfCnpj: string;
    ie?: string;
    nome: string;
    endereco: {
      logradouro: string;
      numero: string;
      complemento?: string;
      bairro: string;
      cep: string;
      cidade: string;
      codigoMunicipio: string;
      uf: string;
    };
    email?: string;
  };
  
  // Itens
  items: NFeItem[];
  
  // Totais
  total: {
    valorProdutos: number;
    valorFrete?: number;
    valorSeguro?: number;
    valorDesconto?: number;
    valorIcms?: number;
    valorIpi?: number;
    valorPis?: number;
    valorCofins?: number;
    valorNota: number;
  };
  
  // Informações adicionais
  infAdic?: string;
  
  // Transporte
  transporte?: {
    modalidade: string;
    transportador?: {
      cpfCnpj: string;
      nome: string;
      ie?: string;
      endereco?: string;
    };
  };
}