import ImportWorker from '@/lib/import.worker?worker';
import type { ImportResult, ImportWorkerRequest } from '@/types/finance';

export function parseInWorker(file: File): Promise<ImportResult> {
  const id = crypto.randomUUID();
  const failure = (message: string): ImportResult => ({ id, source: file.name, months: [], errors: [message], notes: [] });
  if (!file.name.toLowerCase().endsWith('.xlsx')) return Promise.resolve(failure('僅支援 .xlsx 檔案。'));
  if (file.size > 10 * 1024 * 1024) return Promise.resolve(failure('單一檔案不可超過 10 MB。'));
  return new Promise(resolve => {
    let worker: Worker;
    try { worker = new ImportWorker(); }
    catch { resolve(failure('無法啟動檔案解析，請確認瀏覽器支援 Web Worker。')); return; }
    let settled = false;
    const finish = (result: ImportResult) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      worker.terminate();
      resolve(result);
    };
    const timeout = setTimeout(() => finish(failure('解析逾時，請確認檔案內容或減少資料量。')), 20000);
    worker.onmessage = (event: MessageEvent<ImportResult>) => finish(event.data);
    worker.onerror = () => finish(failure('解析失敗，請確認檔案完整且沒有加密。'));
    file.arrayBuffer().then(buffer => {
      if (settled) return;
      const request: ImportWorkerRequest = { buffer, source: file.name, id };
      worker.postMessage(request, [buffer]);
    }).catch(() => finish(failure('無法讀取檔案，請重新選取。')));
  });
}

