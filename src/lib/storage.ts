import type { StoredData } from '@/types/finance';
import { categories, emptyData } from '@/lib/finance';

export const STORAGE_KEY = 'jiayi.finance.v1';
type StoragePort = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;
const object = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);
const strings = (value: Record<string, unknown>, keys: string[]) => keys.every(key => typeof value[key] === 'string');
export function validData(value: unknown): value is StoredData {
  if (!object(value) || value.version !== 1 || !Array.isArray(value.months) || !Array.isArray(value.insurance) || !object(value.preferences) || !strings(value.preferences, ['month', 'insuranceId'])) return false;
  const months = new Set<string>();
  for (const month of value.months) {
    if (!object(month) || !strings(month, ['month', 'source']) || !/^(19|20|21)\d{2}-(0[1-9]|1[0-2])$/.test(String(month.month)) || !Array.isArray(month.accounts) || months.has(String(month.month))) return false;
    months.add(String(month.month));
    for (const account of month.accounts) {
      if (!object(account) || !strings(account, ['id', 'category', 'account', 'purpose', 'goal']) || !categories.includes(account.category as typeof categories[number]) || typeof account.amount !== 'number' || !Number.isFinite(account.amount) || Math.abs(account.amount) > 1e12) return false;
    }
  }
  const ids = new Set<string>();
  for (const snapshot of value.insurance) {
    if (!object(snapshot) || !strings(snapshot, ['id', 'source', 'importedAt']) || !Array.isArray(snapshot.records) || ids.has(String(snapshot.id))) return false;
    ids.add(String(snapshot.id));
    for (const record of snapshot.records) {
      if (!object(record) || !strings(record, ['category', 'holder', 'kind']) || !['人壽保險', '產物保險', '政府保險'].includes(String(record.category)) || !object(record.fields) || !Object.values(record.fields).every(field => typeof field === 'string')) return false;
    }
  }
  return true;
}
export function loadData(storage: StoragePort): { data: StoredData; warning: string; writable: boolean } {
  try {
    const raw = storage.getItem(STORAGE_KEY);
    if (!raw) return { data: emptyData(), warning: '', writable: true };
    const value: unknown = JSON.parse(raw);
    if (!validData(value)) throw new Error('invalid');
    value.months.sort((a, b) => a.month.localeCompare(b.month));
    return { data: value, warning: '', writable: true };
  } catch {
    return { data: emptyData(), warning: '無法讀取本機紀錄，可能已損壞或瀏覽器禁止存取。目前僅使用記憶體；清除紀錄後可重新嘗試保存。', writable: false };
  }
}
export function saveData(storage: StoragePort, data: StoredData): string {
  try { storage.setItem(STORAGE_KEY, JSON.stringify(data)); return ''; }
  catch { return '本機保存失敗，可能空間不足或儲存被停用。資料仍可在本次頁面查看，重新整理後將不會保留本次變更。'; }
}
export function clearData(storage: StoragePort): string {
  try { storage.removeItem(STORAGE_KEY); return ''; }
  catch { return '無法清除瀏覽器內的紀錄，請允許網站儲存權限後重試。'; }
}
