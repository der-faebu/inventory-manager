import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

export class InvalidFilenameError extends Error {}
export class FileNotFoundError extends Error {}

const ALLOWED_EXTENSIONS = ['.xlsx', '.bestand'];

function hasAllowedExtension(name: string): boolean {
  return ALLOWED_EXTENSIONS.some((ext) => name.endsWith(ext));
}

function assertValidFilename(name: string): void {
  if (
    typeof name !== 'string' ||
    name.length === 0 ||
    !hasAllowedExtension(name) ||
    name.includes('\0') ||
    name.includes('/') ||
    name.includes('\\') ||
    name !== path.basename(name)
  ) {
    throw new InvalidFilenameError(`Invalid filename: ${name}`);
  }
}

export class FileStore {
  #dir: string;

  constructor(dir: string) {
    this.#dir = dir;
  }

  async list(): Promise<string[]> {
    const entries = await readdir(this.#dir, { withFileTypes: true }).catch(async (err) => {
      if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
        await mkdir(this.#dir, { recursive: true });
        return [];
      }
      throw err;
    });
    return entries
      .filter((entry) => entry.isFile() && hasAllowedExtension(entry.name))
      .map((entry) => entry.name)
      .sort();
  }

  async read(name: string): Promise<Buffer> {
    assertValidFilename(name);
    try {
      return await readFile(path.join(this.#dir, name));
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
        throw new FileNotFoundError(`File not found: ${name}`);
      }
      throw err;
    }
  }

  async write(name: string, data: Buffer): Promise<void> {
    assertValidFilename(name);
    await mkdir(this.#dir, { recursive: true });
    await writeFile(path.join(this.#dir, name), data);
  }
}
