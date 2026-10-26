import path from 'node:path';
import { FileStore } from './file-store.ts';

function resolveDataDir(): string {
  const configured = process.env.INVENTORY_DATA_DIR;
  return configured ? path.resolve(configured) : path.resolve('data');
}

export const defaultFileStore = new FileStore(resolveDataDir());
