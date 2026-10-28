import { parseFile } from '@/lib/import';
self.onmessage = (event: MessageEvent<{ buffer: ArrayBuffer; source: string; id: string }>) => {
  const { buffer, source, id } = event.data;
  self.postMessage(parseFile(buffer, source, id));
};
