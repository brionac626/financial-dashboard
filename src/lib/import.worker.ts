import { parseFile } from '@/lib/import';
import type { ImportWorkerRequest } from '@/types/finance';
self.onmessage = (event: MessageEvent<ImportWorkerRequest>) => {
  const { buffer, source, id } = event.data;
  self.postMessage(parseFile(buffer, source, id));
};
