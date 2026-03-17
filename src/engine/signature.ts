import { getHeaderValue } from '../infrastructure/http.js';
import type { HeadersLike } from '../foundation/types.js';
import { webcrypto } from 'node:crypto';

const crypto = (globalThis as any).crypto || webcrypto;

export function extractHeader(headers: HeadersLike, name: string): string | undefined {
  return getHeaderValue(headers, name);
}

/**
 * Verifies a Creem webhook signature using HMAC-SHA256 and Web Crypto API.
 */
export async function verifyCreemSignature(
  rawBody: string,
  secret: string,
  signature: string
): Promise<boolean> {
  const encoder = new TextEncoder();
  const keyData = encoder.encode(secret);
  const data = encoder.encode(rawBody);

  const key = await crypto.subtle.importKey(
    'raw',
    keyData,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );

  const signatureBuffer = await crypto.subtle.sign('HMAC', key, data);
  const hashArray = Array.from(new Uint8Array(signatureBuffer));
  const expectedSignature = hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');

  return expectedSignature === signature;
}
