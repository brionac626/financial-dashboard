export type Category = 'cash' | 'investment' | 'nonCurrentAsset' | 'currentLiability' | 'nonCurrentLiability';
export interface AccountBalance {
  id: string;
  category: Category;
  account: string;
  purpose: string;
  goal: string;
  amount: number;
}
export interface MonthlySnapshot {
  month: string;
  source: string;
  accounts: AccountBalance[];
}
export interface FinancialSummary {
  grouped: Record<Category, number>;
  assets: number;
  liabilities: number;
  netWorth: number;
  debtRatio: number | null;
}
export interface BalanceComposition {
  state: 'ready' | 'empty' | 'zero' | 'negative';
  items: { name: string; value: number; percentage: number | null; fill: string }[];
}
export type InsuranceCategory = '人壽保險' | '產物保險' | '政府保險';
export interface InsuranceRecord {
  category: InsuranceCategory;
  holder: string;
  kind: string;
  fields: Record<string, string>;
}
export interface InsuranceSnapshot {
  id: string;
  source: string;
  importedAt: string;
  records: InsuranceRecord[];
}
export interface ImportResult {
  id: string;
  source: string;
  months: MonthlySnapshot[];
  insurance?: InsuranceSnapshot;
  errors: string[];
  notes: string[];
}
export interface StoredData {
  version: 1;
  months: MonthlySnapshot[];
  insurance: InsuranceSnapshot[];
  preferences: { month: string; insuranceId: string };
}

export interface ImportWorkerRequest {
  buffer: ArrayBuffer;
  source: string;
  id: string;
}
