import { getHeaderValue } from '../infrastructure/http.js';
import type { HeadersLike } from '../foundation/types.js';
import { webcrypto } from 'node:crypto';

const crypto = (globalThis as any).crypto || webcrypto;

export function extractHeader(headers: HeadersLike, name: string): string | undefined {
  return getHeaderValue(headers, name);
}

function hexToBytes(hex: string): Uint8Array {
  if (hex.length % 2 !== 0) {
    return new Uint8Array();
  }

  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    const value = Number.parseInt(hex.slice(i, i + 2), 16);
    if (Number.isNaN(value)) {
      return new Uint8Array();
    }
    bytes[i / 2] = value;
  }
  return bytes;
}

function timingSafeEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) {
    return false;
  }

  let result = 0;
  for (let i = 0; i < a.length; i += 1) {
    result |= a[i] ^ b[i];
  }
  return result === 0;
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

  return timingSafeEqual(hexToBytes(expectedSignature), hexToBytes(signature));
}
