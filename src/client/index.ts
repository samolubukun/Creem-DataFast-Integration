const DEFAULT_COOKIE_NAME = 'datafast_visitor_id';
const DEFAULT_SESSION_COOKIE_NAME = 'datafast_session_id';

export interface BrowserTrackingResult {
  visitorId: string | null;
  sessionId: string | null;
}

export function getDataFastTracking(): BrowserTrackingResult {
  if (typeof document === 'undefined') {
    return { visitorId: null, sessionId: null };
  }

  const cookies = document.cookie.split(';');
  let visitorId: string | null = null;
  let sessionId: string | null = null;

  for (const cookie of cookies) {
    const [name, ...valueParts] = cookie.trim().split('=');
    if (name === DEFAULT_COOKIE_NAME) visitorId = valueParts.join('=') || null;
    if (name === DEFAULT_SESSION_COOKIE_NAME) sessionId = valueParts.join('=') || null;
  }

  return { visitorId, sessionId };
}

export function getDataFastVisitorId(cookieName: string = DEFAULT_COOKIE_NAME): string | null {
  if (typeof document === 'undefined') {
    return null;
  }

  const cookies = document.cookie.split(';');
  
  for (const cookie of cookies) {
    const [name, ...valueParts] = cookie.trim().split('=');
    if (name === cookieName) {
      const value = valueParts.join('=');
      return value || null;
    }
  }
  
  return null;
}

export function attributeCreemPaymentLink(
  paymentLink: string,
  tracking?: { visitorId: string | null; sessionId: string | null }
): string {
  const { visitorId, sessionId } = tracking ?? getDataFastTracking();
  if (!visitorId && !sessionId) return paymentLink;

  try {
    const url = new URL(paymentLink);
    if (visitorId) url.searchParams.set('datafast_visitor_id', visitorId);
    if (sessionId) url.searchParams.set('datafast_session_id', sessionId);
    return url.toString();
  } catch {
    return paymentLink;
  }
}

export function getDataFastSessionId(cookieName: string = DEFAULT_SESSION_COOKIE_NAME): string | null {
  if (typeof document === 'undefined') {
    return null;
  }

  const cookies = document.cookie.split(';');
  
  for (const cookie of cookies) {
    const [name, ...valueParts] = cookie.trim().split('=');
    if (name === cookieName) {
      const value = valueParts.join('=');
      return value || null;
    }
  }
  
  return null;
}

export function hasDataFastVisitorId(cookieName: string = DEFAULT_COOKIE_NAME): boolean {
  return getDataFastVisitorId(cookieName) !== null;
}

export function buildCheckoutUrlWithVisitorId(
  checkoutUrl: string,
  visitorId: string | null,
  cookieName: string = DEFAULT_COOKIE_NAME
): string {
  if (!visitorId) {
    visitorId = getDataFastVisitorId(cookieName);
  }
  
  if (!visitorId) {
    return checkoutUrl;
  }
  
  const url = new URL(checkoutUrl);
  url.searchParams.set(cookieName, visitorId);
  
  return url.toString();
}

export function addTrackingToMetadata(
  metadata: Record<string, unknown> = {},
  visitorId?: string | null,
  sessionId?: string | null,
  visitorCookieName: string = DEFAULT_COOKIE_NAME,
  sessionCookieName: string = DEFAULT_SESSION_COOKIE_NAME
): Record<string, unknown> {
  const vid = visitorId ?? getDataFastVisitorId(visitorCookieName);
  const sid = sessionId ?? getDataFastSessionId(sessionCookieName);
  
  if (!vid && !sid) {
    return metadata;
  }
  
  return {
    ...metadata,
    ...(vid && { datafast_visitor_id: vid }),
    ...(sid && { datafast_session_id: sid }),
  };
}

export const DataFastClient = {
  getVisitorId: getDataFastVisitorId,
  getSessionId: getDataFastSessionId,
  hasVisitorId: hasDataFastVisitorId,
  buildCheckoutUrl: buildCheckoutUrlWithVisitorId,
  addTrackingToMetadata,
};

export default DataFastClient;
