import { describe, it, expect } from 'vitest';
import { webcrypto } from 'node:crypto';
import { extractHeader, verifyCreemSignature } from './signature.js';

const crypto = (globalThis as any).crypto || webcrypto;

describe('signature', () => {
  describe('extractHeader', () => {
    it('extracts header value', () => {
      expect(extractHeader({ 'creem-signature': 'test' }, 'creem-signature')).toBe('test');
    });

    it('returns undefined if header missing', () => {
      expect(extractHeader({}, 'creem-signature')).toBeUndefined();
    });
  });

  describe('verifyCreemSignature', () => {
    const secret = 'test-secret';
    const rawBody = '{"test":true}';
    
    it('verifies valid signature', async () => {
      // Generate expected signature manually or via helper
      const encoder = new TextEncoder();
      const keyData = encoder.encode(secret);
      const data = encoder.encode(rawBody);
      const cryptoKey = await crypto.subtle.importKey(
        'raw',
        keyData,
        { name: 'HMAC', hash: 'SHA-256' },
        false,
        ['sign']
      );
      const signatureBuffer = await crypto.subtle.sign('HMAC', cryptoKey, data);
      const signature = Array.from(new Uint8Array(signatureBuffer))
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('');

      const isValid = await verifyCreemSignature(rawBody, secret, signature);
      expect(isValid).toBe(true);
    });

    it('rejects invalid signature', async () => {
      const isValid = await verifyCreemSignature(rawBody, secret, 'invalid-signature');
      expect(isValid).toBe(false);
    });
  });
});
