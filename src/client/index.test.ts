import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  getDataFastVisitorId,
  hasDataFastVisitorId,
  buildCheckoutUrlWithVisitorId,
  addVisitorIdToMetadata,
  getVisitorIdFromUrl,
  getVisitorIdWithFallback,
  DataFastClient,
} from '../../src/client/index.js';

describe('Browser client helpers', () => {
  let mockDocument: { cookie: string };

  beforeEach(() => {
    vi.resetModules();
    mockDocument = { cookie: '' };
    vi.stubGlobal('document', mockDocument);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  describe('getDataFastVisitorId (browser)', () => {
    it('returns null when document is undefined (SSR)', async () => {
      vi.stubGlobal('document', undefined);
      const { getDataFastVisitorId } = await import('../../src/client/index.js');
      const result = getDataFastVisitorId();
      expect(result).toBeNull();
    });

    it('reads visitor ID from document.cookie', () => {
      mockDocument.cookie = 'datafast_visitor_id=df_browser123; other=value';
      const result = getDataFastVisitorId();
      expect(result).toBe('df_browser123');
    });

    it('returns null when cookie not found', () => {
      mockDocument.cookie = 'other_cookie=value';
      const result = getDataFastVisitorId();
      expect(result).toBeNull();
    });

    it('uses custom cookie name', () => {
      mockDocument.cookie = 'custom_id=df_custom';
      const result = getDataFastVisitorId('custom_id');
      expect(result).toBe('df_custom');
    });

    it('handles equals signs in value', () => {
      mockDocument.cookie = 'datafast_visitor_id=abc=def=ghi';
      const result = getDataFastVisitorId();
      expect(result).toBe('abc=def=ghi');
    });
  });

  describe('hasDataFastVisitorId', () => {
    it('returns true when visitor ID exists', () => {
      mockDocument.cookie = 'datafast_visitor_id=df_123';
      expect(hasDataFastVisitorId()).toBe(true);
    });

    it('returns false when visitor ID does not exist', () => {
      mockDocument.cookie = 'other=value';
      expect(hasDataFastVisitorId()).toBe(false);
    });

    it('returns false in SSR', async () => {
      vi.stubGlobal('document', undefined);
      const { hasDataFastVisitorId } = await import('../../src/client/index.js');
      expect(hasDataFastVisitorId()).toBe(false);
    });
  });

  describe('buildCheckoutUrlWithVisitorId', () => {
    it('returns original URL when no visitor ID available', () => {
      mockDocument.cookie = '';
      const result = buildCheckoutUrlWithVisitorId('https://checkout.creem.io/abc', null);
      expect(result).toBe('https://checkout.creem.io/abc');
    });

    it('adds visitor ID as query param when provided', () => {
      const result = buildCheckoutUrlWithVisitorId(
        'https://checkout.creem.io/abc',
        'df_explicit_123'
      );
      expect(result).toContain('datafast_visitor_id=df_explicit_123');
    });

    it('reads visitor ID from browser cookie if not provided', () => {
      mockDocument.cookie = 'datafast_visitor_id=df_cookie_read';
      const result = buildCheckoutUrlWithVisitorId('https://checkout.creem.io/abc', null);
      expect(result).toContain('datafast_visitor_id=df_cookie_read');
    });

    it('uses custom cookie name', () => {
      mockDocument.cookie = 'custom=df_custom';
      const result = buildCheckoutUrlWithVisitorId('https://checkout.creem.io/abc', null, 'custom');
      expect(result).toContain('custom=df_custom');
    });

    it('preserves existing query params', () => {
      const result = buildCheckoutUrlWithVisitorId(
        'https://checkout.creem.io/abc?existing=param',
        'df_123'
      );
      expect(result).toContain('existing=param');
      expect(result).toContain('datafast_visitor_id=df_123');
    });
  });

  describe('addVisitorIdToMetadata', () => {
    it('returns original metadata when no visitor ID', () => {
      mockDocument.cookie = '';
      const metadata = { existing: 'field' };
      const result = addVisitorIdToMetadata(metadata, null);
      expect(result).toEqual(metadata);
    });

    it('adds visitor ID to metadata when explicitly provided', () => {
      const metadata = { existing: 'field' };
      const result = addVisitorIdToMetadata(metadata, 'df_explicit');
      expect(result).toEqual({
        existing: 'field',
        datafast_visitor_id: 'df_explicit',
      });
    });

    it('reads visitor ID from browser when not provided', () => {
      mockDocument.cookie = 'datafast_visitor_id=df_cookie';
      const metadata = { existing: 'field' };
      const result = addVisitorIdToMetadata(metadata);
      expect(result).toEqual({
        existing: 'field',
        datafast_visitor_id: 'df_cookie',
      });
    });

    it('creates metadata object if not provided', () => {
      const result = addVisitorIdToMetadata(undefined, 'df_123');
      expect(result).toEqual({ datafast_visitor_id: 'df_123' });
    });
  });

  describe('DataFastClient', () => {
    it('exports all helper methods', () => {
      expect(DataFastClient.getVisitorId).toBeDefined();
      expect(DataFastClient.hasVisitorId).toBeDefined();
      expect(DataFastClient.buildCheckoutUrl).toBeDefined();
      expect(DataFastClient.addToMetadata).toBeDefined();
      expect(DataFastClient.getVisitorIdFromUrl).toBeDefined();
      expect(DataFastClient.getVisitorIdWithFallback).toBeDefined();
    });
  });

  describe('getVisitorIdFromUrl', () => {
    it('extracts visitor ID from a full URL string', () => {
      const id = getVisitorIdFromUrl('https://example.com/success?datafast_visitor_id=abc123');
      expect(id).toBe('abc123');
    });

    it('extracts visitor ID from a bare query string', () => {
      const id = getVisitorIdFromUrl('?datafast_visitor_id=qry_456');
      expect(id).toBe('qry_456');
    });

    it('returns null when param is absent', () => {
      const id = getVisitorIdFromUrl('https://example.com/success?other=val');
      expect(id).toBeNull();
    });

    it('respects a custom param name', () => {
      const id = getVisitorIdFromUrl('https://example.com/?my_vid=xyz', 'my_vid');
      expect(id).toBe('xyz');
    });

    it('accepts a URLSearchParams instance', () => {
      const params = new URLSearchParams('datafast_visitor_id=sp_789');
      expect(getVisitorIdFromUrl(params)).toBe('sp_789');
    });
  });

  describe('getVisitorIdWithFallback', () => {
    it('returns cookie value when available', () => {
      mockDocument.cookie = 'datafast_visitor_id=cookie_val';
      const id = getVisitorIdWithFallback('datafast_visitor_id', '?datafast_visitor_id=url_val');
      expect(id).toBe('cookie_val');
    });

    it('falls back to URL param when cookie is absent', () => {
      mockDocument.cookie = '';
      const id = getVisitorIdWithFallback('datafast_visitor_id', '?datafast_visitor_id=url_val');
      expect(id).toBe('url_val');
    });

    it('returns null when both cookie and URL param are absent', () => {
      mockDocument.cookie = '';
      const id = getVisitorIdWithFallback('datafast_visitor_id', '?other=val');
      expect(id).toBeNull();
    });
  });
});
