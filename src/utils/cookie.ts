const DEFAULT_COOKIE_NAME = 'datafast_visitor_id';
const DEFAULT_SESSION_COOKIE_NAME = 'datafast_session_id';

export function getDataFastVisitorId(
  cookies: string | Record<string, string>,
  cookieName: string = DEFAULT_COOKIE_NAME
): string | null {
  if (!cookies) {
    return null;
  }
  
  if (typeof cookies === 'string') {
    const cookiePairs = cookies.split(';');
    
    for (const pair of cookiePairs) {
      const [name, ...valueParts] = pair.trim().split('=');
      if (name === cookieName) {
        const value = valueParts.join('=');
        return value || null;
      }
    }
    
    return null;
  }
  
  return cookies[cookieName] || null;
}

export function getDataFastSessionId(
  cookies: string | Record<string, string>,
  cookieName: string = DEFAULT_SESSION_COOKIE_NAME
): string | null {
  if (!cookies) {
    return null;
  }
  
  if (typeof cookies === 'string') {
    const cookiePairs = cookies.split(';');
    
    for (const pair of cookiePairs) {
      const [name, ...valueParts] = pair.trim().split('=');
      if (name === cookieName) {
        const value = valueParts.join('=');
        return value || null;
      }
    }
    
    return null;
  }
  
  return cookies[cookieName] || null;
}

export function parseCookieHeader(cookieHeader: string | string[] | undefined): Record<string, string> {
  if (!cookieHeader) {
    return {};
  }
  
  const cookies: Record<string, string> = {};
  const headerValue = Array.isArray(cookieHeader) ? cookieHeader.join('; ') : cookieHeader;
  
  const cookiePairs = headerValue.split(';');
  
  for (const pair of cookiePairs) {
    const [name, ...valueParts] = pair.trim().split('=');
    if (name) {
      cookies[name] = valueParts.join('=');
    }
  }
  
  return cookies;
}
