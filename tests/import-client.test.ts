import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ImportResult } from '@/types/finance';
import { parseInWorker } from '@/lib/import-client';

const control = vi.hoisted(() => ({
  worker: {
    onmessage: null as ((event: MessageEvent<ImportResult>) => void) | null,
    onerror: null as (() => void) | null,
    postMessage: vi.fn(),
    terminate: vi.fn(),
  },
  create: vi.fn(),
}));
vi.mock('@/lib/import.worker?worker', () => ({ default: control.create }));

const result: ImportResult = { id: 'parsed', source: 'test.xlsx', months: [], errors: [], notes: [] };
const file = () => new File(['PK'], 'test.xlsx');
const flushRead = async () => { await Promise.resolve(); await Promise.resolve(); };

beforeEach(() => {
  vi.useFakeTimers();
  vi.resetAllMocks();
  control.worker.onmessage = null;
  control.worker.onerror = null;
  control.create.mockImplementation(function () { return control.worker; });
});
afterEach(() => { vi.useRealTimers(); });

describe('Worker 匯入協調', () => {
  it('傳送 buffer ownership，成功後終止 Worker 並清除計時器', async () => {
    const input = file();
    const buffer = new ArrayBuffer(2);
    vi.spyOn(input, 'arrayBuffer').mockResolvedValue(buffer);
    const pending = parseInWorker(input);
    await flushRead();
    expect(control.worker.postMessage).toHaveBeenCalledWith({ buffer, source: input.name, id: expect.any(String) }, [buffer]);
    control.worker.onmessage?.(new MessageEvent('message', { data: result }));
    expect(await pending).toBe(result);
    expect(control.worker.terminate).toHaveBeenCalledTimes(1);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('副檔名與超過 10 MB 的檔案不建立 Worker', async () => {
    expect((await parseInWorker(new File([], 'test.csv'))).errors).toEqual(['僅支援 .xlsx 檔案。']);
    const large = file();
    Object.defineProperty(large, 'size', { value: 10 * 1024 * 1024 + 1 });
    expect((await parseInWorker(large)).errors).toEqual(['單一檔案不可超過 10 MB。']);
    expect(control.create).not.toHaveBeenCalled();
  });

  it('恰好 10 MB 與大寫副檔名仍可解析', async () => {
    const input = new File([], 'TEST.XLSX');
    Object.defineProperty(input, 'size', { value: 10 * 1024 * 1024 });
    const pending = parseInWorker(input);
    control.worker.onmessage?.(new MessageEvent('message', { data: result }));
    expect(await pending).toBe(result);
  });

  it('無法建立 Worker 時回傳既有錯誤文案', async () => {
    control.create.mockImplementation(() => { throw new Error('blocked'); });
    expect((await parseInWorker(file())).errors[0]).toContain('無法啟動檔案解析');
    expect(vi.getTimerCount()).toBe(0);
  });

  it('讀檔失敗時回報並釋放 Worker', async () => {
    const input = file();
    vi.spyOn(input, 'arrayBuffer').mockRejectedValue(new Error('read failed'));
    expect((await parseInWorker(input)).errors[0]).toContain('無法讀取檔案');
    expect(control.worker.terminate).toHaveBeenCalledTimes(1);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('Worker 錯誤時回報並釋放資源', async () => {
    const pending = parseInWorker(file());
    control.worker.onerror?.();
    expect((await pending).errors[0]).toContain('解析失敗');
    expect(control.worker.terminate).toHaveBeenCalledTimes(1);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('保留解析器回傳的錯誤結果', async () => {
    const pending = parseInWorker(file());
    const invalid = { ...result, errors: ['缺少表頭'] };
    control.worker.onmessage?.(new MessageEvent('message', { data: invalid }));
    expect(await pending).toEqual(invalid);
    expect(control.worker.terminate).toHaveBeenCalledTimes(1);
  });

  it('傳送失敗仍會回報並終止 Worker', async () => {
    control.worker.postMessage.mockImplementation(() => { throw new Error('transfer failed'); });
    expect((await parseInWorker(file())).errors[0]).toContain('無法讀取檔案');
    expect(control.worker.terminate).toHaveBeenCalledTimes(1);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('20 秒逾時，忽略遲到的讀檔結果與 Worker 回呼', async () => {
    const input = file();
    let finishRead: (buffer: ArrayBuffer) => void = () => {};
    vi.spyOn(input, 'arrayBuffer').mockImplementation(() => new Promise(resolve => { finishRead = resolve; }));
    const pending = parseInWorker(input);
    await vi.advanceTimersByTimeAsync(19999);
    expect(control.worker.terminate).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    expect((await pending).errors[0]).toContain('解析逾時');
    finishRead(new ArrayBuffer(2));
    await flushRead();
    control.worker.onerror?.();
    control.worker.onmessage?.(new MessageEvent('message', { data: result }));
    expect(control.worker.postMessage).not.toHaveBeenCalled();
    expect(control.worker.terminate).toHaveBeenCalledTimes(1);
    expect(vi.getTimerCount()).toBe(0);
  });
});
