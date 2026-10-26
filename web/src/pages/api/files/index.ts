import type { APIRoute } from 'astro';
import { defaultFileStore } from '../../../lib/file-store-config.ts';

export const prerender = false;

export const GET: APIRoute = async () => {
  const names = await defaultFileStore.list();
  return new Response(JSON.stringify(names), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
};
