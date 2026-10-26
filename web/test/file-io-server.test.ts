import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as Schema from '../src/lib/schema.ts';
import * as FileIO from '../src/lib/file-io.ts';

function withMockFetch(handler: typeof fetch, fn: () => Promise<void>) {
  const original = globalThis.fetch;
  globalThis.fetch = handler;
  return fn().finally(() => {
    globalThis.fetch = original;
  });
}

test('listServerFiles fetches /api/files and returns the JSON array', async () => {
  let requestedUrl: string | undefined;
  await withMockFetch(
    (async (url: string) => {
      requestedUrl = url;
      return new Response(JSON.stringify(['a.bestand', 'b.bestand']), { status: 200 });
    }) as typeof fetch,
    async () => {
      const names = await FileIO.listServerFiles();
      assert.deepEqual(names, ['a.bestand', 'b.bestand']);
      assert.equal(requestedUrl, '/api/files');
    },
  );
});

test('listServerFiles throws when the server responds with an error status', async () => {
  await withMockFetch(
    (async () => new Response('boom', { status: 500 })) as typeof fetch,
    async () => {
      await assert.rejects(() => FileIO.listServerFiles());
    },
  );
});

test('saveDocumentToServer PUTs the serialized document under the given name', async () => {
  let requestedUrl: string | undefined;
  let requestedMethod: string | undefined;
  let requestedBody: string | undefined;
  const doc = Schema.emptyDocument();
  doc.customer.name = 'Acme';

  await withMockFetch(
    (async (url: string, init?: RequestInit) => {
      requestedUrl = url;
      requestedMethod = init?.method;
      requestedBody = init?.body as string;
      return new Response(null, { status: 204 });
    }) as typeof fetch,
    async () => {
      await FileIO.saveDocumentToServer(doc, 'client.bestand');
      assert.equal(requestedUrl, '/api/files/client.bestand');
      assert.equal(requestedMethod, 'PUT');
      assert.deepEqual(JSON.parse(requestedBody as string), doc);
    },
  );
});

test('saveDocumentToServer throws when the server responds with an error status', async () => {
  const doc = Schema.emptyDocument();
  await withMockFetch(
    (async () => new Response('boom', { status: 500 })) as typeof fetch,
    async () => {
      await assert.rejects(() => FileIO.saveDocumentToServer(doc, 'client.bestand'));
    },
  );
});

test('loadDocumentFromServer GETs and parses the named document', async () => {
  let requestedUrl: string | undefined;
  const doc = Schema.emptyDocument();
  doc.customer.name = 'Acme';
  const json = FileIO.serializeDocument(doc);

  await withMockFetch(
    (async (url: string) => {
      requestedUrl = url;
      return new Response(json, { status: 200 });
    }) as typeof fetch,
    async () => {
      const loaded = await FileIO.loadDocumentFromServer('client.bestand');
      assert.deepEqual(loaded, doc);
      assert.equal(requestedUrl, '/api/files/client.bestand');
    },
  );
});

test('loadDocumentFromServer throws when the server responds with 404', async () => {
  await withMockFetch(
    (async () => new Response('not found', { status: 404 })) as typeof fetch,
    async () => {
      await assert.rejects(() => FileIO.loadDocumentFromServer('missing.bestand'));
    },
  );
});
