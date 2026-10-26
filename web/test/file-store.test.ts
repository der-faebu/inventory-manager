import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { FileStore, InvalidFilenameError, FileNotFoundError } from '../src/lib/file-store.ts';

async function withTempDir(fn: (dir: string) => Promise<void>) {
  const dir = await mkdtemp(path.join(tmpdir(), 'file-store-test-'));
  try {
    await fn(dir);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

test('list creates the directory if it does not exist yet', async () => {
  await withTempDir(async (dir) => {
    const nested = path.join(dir, 'nested');
    const store = new FileStore(nested);
    assert.deepEqual(await store.list(), []);
  });
});

test('list returns empty array for an empty directory', async () => {
  await withTempDir(async (dir) => {
    const store = new FileStore(dir);
    assert.deepEqual(await store.list(), []);
  });
});

test('write then list shows the written file', async () => {
  await withTempDir(async (dir) => {
    const store = new FileStore(dir);
    await store.write('foo.xlsx', Buffer.from('hello'));
    assert.deepEqual(await store.list(), ['foo.xlsx']);
  });
});

test('list only returns .xlsx files', async () => {
  await withTempDir(async (dir) => {
    const store = new FileStore(dir);
    await store.write('foo.xlsx', Buffer.from('a'));
    await writeFile(path.join(dir, 'notes.txt'), Buffer.from('b'));
    assert.deepEqual(await store.list(), ['foo.xlsx']);
  });
});

test('write then read round-trips bytes', async () => {
  await withTempDir(async (dir) => {
    const store = new FileStore(dir);
    const bytes = Buffer.from([1, 2, 3, 4]);
    await store.write('foo.xlsx', bytes);
    assert.deepEqual(await store.read('foo.xlsx'), bytes);
  });
});

test('write overwrites an existing file', async () => {
  await withTempDir(async (dir) => {
    const store = new FileStore(dir);
    await store.write('foo.xlsx', Buffer.from('first'));
    await store.write('foo.xlsx', Buffer.from('second'));
    assert.deepEqual(await store.read('foo.xlsx'), Buffer.from('second'));
  });
});

test('read throws FileNotFoundError for a missing file', async () => {
  await withTempDir(async (dir) => {
    const store = new FileStore(dir);
    await assert.rejects(() => store.read('missing.xlsx'), FileNotFoundError);
  });
});

test('rejects filenames that are not .xlsx', async () => {
  await withTempDir(async (dir) => {
    const store = new FileStore(dir);
    await assert.rejects(() => store.write('foo.txt', Buffer.from('x')), InvalidFilenameError);
    await assert.rejects(() => store.read('foo.txt'), InvalidFilenameError);
  });
});

test('rejects path traversal attempts', async () => {
  await withTempDir(async (dir) => {
    const store = new FileStore(dir);
    await assert.rejects(() => store.read('../secret.xlsx'), InvalidFilenameError);
    await assert.rejects(() => store.write('../../evil.xlsx', Buffer.from('x')), InvalidFilenameError);
    await assert.rejects(() => store.read('sub/dir.xlsx'), InvalidFilenameError);
  });
});

test('rejects absolute paths and null bytes', async () => {
  await withTempDir(async (dir) => {
    const store = new FileStore(dir);
    await assert.rejects(() => store.read('/etc/passwd.xlsx'), InvalidFilenameError);
    await assert.rejects(() => store.read('foo\0bar.xlsx'), InvalidFilenameError);
  });
});
