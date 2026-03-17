import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getDataFastTracking, appendDataFastTracking } from './tracking.js';
import { initCreemDataFast } from './auto.js';

describe('browser layer', () => {
  describe('tracking', () => {
    it('retrieves tracking from document.cookie', () => {
      global.document = {
        cookie: 'datafast_visitor_id=v123; datafast_session_id=s456'
      } as any;

      const result = getDataFastTracking();
      expect(result).toEqual({ visitorId: 'v123', sessionId: 's456' });
    });

    it('appends tracking to absolute checkout url', () => {
      const tracking = { visitorId: 'v1', sessionId: 's1' };
      const url = 'https://checkout.creem.io/test';
      const result = appendDataFastTracking(url, tracking);
      
      expect(result).toContain('datafast_visitor_id=v1');
      expect(result).toContain('datafast_session_id=s1');
    });

    it('handles relative paths', () => {
      const tracking = { visitorId: 'v1' };
      const result = appendDataFastTracking('/buy', tracking);
      expect(result).toBe('/buy?datafast_visitor_id=v1');
    });
  });

  describe('auto init', () => {
    beforeEach(() => {
      vi.stubGlobal('document', {
        querySelectorAll: vi.fn().mockReturnValue([]),
        body: {
          addEventListener: vi.fn(),
        }
      });
      vi.stubGlobal('MutationObserver', vi.fn().mockImplementation(() => ({
          observe: vi.fn(),
          disconnect: vi.fn(),
      })));
      vi.stubGlobal('window', { location: { origin: 'http://localhost' } });
    });

    it('finds and updates checkout links', () => {
      const mockLink = {
        href: 'https://checkout.creem.io/p/123',
      };
      
      vi.mocked(document.querySelectorAll).mockReturnValue([mockLink] as any);
      
      // Setup tracking cookie
      vi.stubGlobal('document', {
        ...document,
        cookie: 'datafast_visitor_id=vabc',
        querySelectorAll: document.querySelectorAll,
        body: {}
      });

      initCreemDataFast();

      expect(mockLink.href).toContain('datafast_visitor_id=vabc');
    });
  });
});
