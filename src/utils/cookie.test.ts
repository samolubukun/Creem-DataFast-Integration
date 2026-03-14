import { describe, it, expect } from 'vitest';
import {
  getDataFastVisitorId,
  parseCookieHeader,
} from '../../src/utils/cookie';

describe('getDataFastVisitorId', () => {
  describe('with string cookie input', () => {
    it('returns visitor id from cookie string', () => {
      const cookies = 'datafast_visitor_id=df_abc123xyz; other_cookie=foo';
      const result = getDataFastVisitorId(cookies);
      expect(result).toBe('df_abc123xyz');
    });

    it('returns null when cookie not found', () => {
      const cookies = 'other_cookie=foo; another=baz';
      const result = getDataFastVisitorId(cookies);
      expect(result).toBeNull();
    });

    it('returns null for empty string', () => {
      const result = getDataFastVisitorId('');
      expect(result).toBeNull();
    });

    it('handles cookies without trailing semicolon', () => {
      const cookies = 'datafast_visitor_id=df_xyz';
      const result = getDataFastVisitorId(cookies);
      expect(result).toBe('df_xyz');
    });

    it('handles cookie value with equals sign', () => {
      const cookies = 'datafast_visitor_id=abc=def=ghi';
      const result = getDataFastVisitorId(cookies);
      expect(result).toBe('abc=def=ghi');
    });

    it('returns null for empty cookie value', () => {
      const cookies = 'datafast_visitor_id=; other=value';
      const result = getDataFastVisitorId(cookies);
      expect(result).toBeNull();
    });

    it('returns empty string as null when accessing via object', () => {
      const cookies = { datafast_visitor_id: '' };
      const result = getDataFastVisitorId(cookies);
      expect(result).toBeNull();
    });

    it('uses custom cookie name', () => {
      const cookies = 'my_custom_id=df_custom123';
      const result = getDataFastVisitorId(cookies, 'my_custom_id');
      expect(result).toBe('df_custom123');
    });

    it('returns null for undefined cookie name in string', () => {
      const cookies = 'datafast_visitor_id=; other=value';
      const result = getDataFastVisitorId(cookies);
      expect(result).toBeNull();
    });
  });

  describe('with object cookie input', () => {
    it('returns visitor id from cookie object', () => {
      const cookies = { datafast_visitor_id: 'df_obj123' };
      const result = getDataFastVisitorId(cookies);
      expect(result).toBe('df_obj123');
    });

    it('returns null when key not found in object', () => {
      const cookies = { other_key: 'value' };
      const result = getDataFastVisitorId(cookies);
      expect(result).toBeNull();
    });

    it('returns null for empty object', () => {
      const result = getDataFastVisitorId({});
      expect(result).toBeNull();
    });

    it('uses custom cookie name with object', () => {
      const cookies = { custom_id: 'df_custom' };
      const result = getDataFastVisitorId(cookies, 'custom_id');
      expect(result).toBe('df_custom');
    });

    it('returns empty string as null', () => {
      const cookies = { datafast_visitor_id: '' };
      const result = getDataFastVisitorId(cookies);
      expect(result).toBeNull();
    });
  });

  it('returns null for null/undefined input', () => {
    expect(getDataFastVisitorId(null as any)).toBeNull();
    expect(getDataFastVisitorId(undefined as any)).toBeNull();
  });
});

describe('parseCookieHeader', () => {
  it('parses single cookie', () => {
    const result = parseCookieHeader('cookie=value');
    expect(result).toEqual({ cookie: 'value' });
  });

  it('parses multiple cookies', () => {
    const result = parseCookieHeader('a=1; b=2; c=3');
    expect(result).toEqual({ a: '1', b: '2', c: '3' });
  });

  it('parses cookie with empty value', () => {
    const result = parseCookieHeader('empty=');
    expect(result).toEqual({ empty: '' });
  });

  it('handles array input', () => {
    const result = parseCookieHeader(['a=1', 'b=2']);
    expect(result).toEqual({ a: '1', b: '2' });
  });

  it('returns empty object for undefined', () => {
    expect(parseCookieHeader(undefined)).toEqual({});
  });

  it('handles cookie value with equals sign', () => {
    const result = parseCookieHeader('token=abc=def');
    expect(result).toEqual({ token: 'abc=def' });
  });

  it('handles whitespace around cookies', () => {
    const result = parseCookieHeader('  a=1 ; b=2  ');
    expect(result).toEqual({ a: '1', b: '2' });
  });
});
