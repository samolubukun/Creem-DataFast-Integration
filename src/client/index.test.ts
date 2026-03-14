import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  getDataFastVisitorId,
  hasDataFastVisitorId,
  buildCheckoutUrlWithVisitorId,
  addVisitorIdToMetadata,
  DataFastClient,
} from '../../src/client/index';

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
      const { getDataFastVisitorId } = await import('../../src/client/index');
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
      const { hasDataFastVisitorId } = await import('../../src/client/index');
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
    });
  });
});
