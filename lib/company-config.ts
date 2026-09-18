export type BankOption = {
  id: string;
  name: string;
  url: string;
  featured?: boolean;
};

export const BANKS: BankOption[] = [
  { id: 'caixabank', name: 'CaixaBank', url: 'https://www.caixabank.es/', featured: true },
  { id: 'santander', name: 'Banco Santander', url: 'https://www.bancosantander.es/', featured: true },
  { id: 'bbva', name: 'BBVA', url: 'https://www.bbva.es/', featured: true },
  { id: 'ing', name: 'ING', url: 'https://www.ing.es/', featured: true },
  { id: 'sabadell', name: 'Banco Sabadell', url: 'https://www.bancsabadell.com/', featured: true },
  { id: 'bankinter', name: 'Bankinter', url: 'https://www.bankinter.com/' },
  { id: 'unicaja', name: 'Unicaja', url: 'https://www.unicajabanco.es/' },
  { id: 'abanca', name: 'ABANCA', url: 'https://www.abanca.com/' },
  { id: 'ibercaja', name: 'Ibercaja', url: 'https://www.ibercaja.es/' },
  { id: 'cajamar', name: 'Cajamar', url: 'https://www.grupocajamar.es/' },
];

export type CompanyConfig = {
  businessName: string;
  legalName: string;
  taxId: string;
  address: string;
  postalCode: string;
  city: string;
  province: string;
  phone: string;
  email: string;
  contactFirstName: string;
  contactLastName: string;
  contactPhone: string;
  contactEmail: string;
  selectedBankIds: string[];
  screenName: string;
  labelsHours: number;
  publicScreenEnabled: boolean;
  driveFolderId: string;
  driveFolderUrl: string;
  driveConnected: boolean;
};

export const COMPANY_STORAGE_KEY = 'ca46:company-config:v1';

export const DEFAULT_COMPANY_CONFIG: CompanyConfig = {
  businessName: '',
  legalName: '',
  taxId: '',
  address: '',
  postalCode: '',
  city: '',
  province: '',
  phone: '',
  email: '',
  contactFirstName: '',
  contactLastName: '',
  contactPhone: '',
  contactEmail: '',
  selectedBankIds: [],
  screenName: '',
  labelsHours: 72,
  publicScreenEnabled: true,
  driveFolderId: '',
  driveFolderUrl: '',
  driveConnected: false,
};

export function loadCompanyConfig(): CompanyConfig {
  if (typeof window === 'undefined') return DEFAULT_COMPANY_CONFIG;
  try {
    const raw = window.localStorage.getItem(COMPANY_STORAGE_KEY);
    if (!raw) return DEFAULT_COMPANY_CONFIG;
    return { ...DEFAULT_COMPANY_CONFIG, ...JSON.parse(raw) };
  } catch {
    return DEFAULT_COMPANY_CONFIG;
  }
}

export function saveCompanyConfig(config: CompanyConfig) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(COMPANY_STORAGE_KEY, JSON.stringify(config));
  window.dispatchEvent(new CustomEvent('ca46-company-config-updated'));
}
