import type { APIRoute } from 'astro';
import { defaultFileStore } from '../../../lib/file-store-config.ts';
import { FileNotFoundError, InvalidFilenameError } from '../../../lib/file-store.ts';

export const prerender = false;

const XLSX_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
const BESTAND_MIME = 'application/json';

function contentTypeFor(name: string): string {
  return name.endsWith('.xlsx') ? XLSX_MIME : BESTAND_MIME;
}

export const GET: APIRoute = async ({ params }) => {
  const name = params.name ?? '';
  try {
    const bytes = await defaultFileStore.read(name);
    return new Response(new Uint8Array(bytes), {
      status: 200,
      headers: { 'Content-Type': contentTypeFor(name) },
    });
  } catch (err) {
    if (err instanceof InvalidFilenameError) {
      return new Response(err.message, { status: 400 });
    }
    if (err instanceof FileNotFoundError) {
      return new Response(err.message, { status: 404 });
    }
    throw err;
  }
};

export const PUT: APIRoute = async ({ params, request }) => {
  const name = params.name ?? '';
  try {
    const bytes = Buffer.from(await request.arrayBuffer());
    await defaultFileStore.write(name, bytes);
    return new Response(null, { status: 204 });
  } catch (err) {
    if (err instanceof InvalidFilenameError) {
      return new Response(err.message, { status: 400 });
    }
    throw err;
  }
};
