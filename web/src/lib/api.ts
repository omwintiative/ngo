/*
  One place for talking to the OMWI API (the Express app in ../server).

  Every request goes to /api on the same site:
  - On Vercel, web/vercel.json forwards /api/* to the API on Render.
  - In `npm run dev`, astro.config.mjs forwards /api/* to API_PROXY_TARGET
    (your local API by default).
*/

export const API_BASE = '/api';

export class ApiError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

/**
 * Calls the API and returns the parsed JSON body.
 * Throws ApiError with the API's own `message` when the response is not OK.
 */
export async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  if (init.body && !(init.body instanceof FormData) && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  const response = await fetch(`${API_BASE}${path}`, { ...init, headers });
  const isJson = response.headers.get('Content-Type')?.includes('application/json');
  const body: unknown = isJson ? await response.json() : null;

  if (!response.ok) {
    const message =
      body && typeof body === 'object' && 'message' in body && typeof body.message === 'string'
        ? body.message
        : 'Something went wrong. Please try again.';
    throw new ApiError(message, response.status);
  }

  return body as T;
}
