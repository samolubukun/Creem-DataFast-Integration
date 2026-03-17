import { describe, it, expect } from 'vitest';
import { getHeaderValue, readTrackingFromCookieHeader } from './http.js';
import { readTrackingFromMetadata, mergeTrackingIntoMetadata } from './context.js';
import { minorToMajor } from './finance.js';

describe('infrastructure', () => {
  describe('http utils', () => {
    it('extracts headers from Record', () => {
      expect(getHeaderValue({ 'content-type': 'application/json' }, 'Content-Type')).toBe('application/json');
    });

    it('extracts headers from Headers object', () => {
      const h = new Headers();
      h.append('X-Test', 'val');
      expect(getHeaderValue(h, 'x-test')).toBe('val');
    });

    it('reads tracking from cookie header', () => {
      const cookie = 'other=val; datafast_visitor_id=v123; datafast_session_id=s456; more=val';
      const result = readTrackingFromCookieHeader(cookie);
      expect(result).toEqual({ visitorId: 'v123', sessionId: 's456' });
    });
  });

  describe('context utils', () => {
    it('reads tracking from metadata', () => {
      const metadata = { datafast_visitor_id: 'v1', datafast_session_id: 's1' };
      expect(readTrackingFromMetadata(metadata)).toEqual({ visitorId: 'v1', sessionId: 's1' });
    });

    it('merges tracking into metadata', () => {
      const tracking = { visitorId: 'v_new', sessionId: 's_new' };
      const options = { captureSessionId: true, preferTracking: true };
      const result = mergeTrackingIntoMetadata({ existing: 'val' }, tracking, options);
      expect(result).toEqual({
        existing: 'val',
        datafast_visitor_id: 'v_new',
        datafast_session_id: 's_new',
      });
    });
  });

  describe('finance utils', () => {
    it('converts USD (2 decimals)', () => {
      expect(minorToMajor(1050, 'USD')).toBe(10.5);
    });

    it('converts JPY (0 decimals)', () => {
      expect(minorToMajor(1000, 'JPY')).toBe(1000);
    });

    it('converts OMR (3 decimals)', () => {
      expect(minorToMajor(1000, 'OMR')).toBe(1);
    });
  });
});
