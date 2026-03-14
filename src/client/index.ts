const DEFAULT_COOKIE_NAME = 'datafast_visitor_id';

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

export function addVisitorIdToMetadata(
  metadata: Record<string, unknown> = {},
  visitorId?: string | null,
  cookieName: string = DEFAULT_COOKIE_NAME
): Record<string, unknown> {
  const id = visitorId ?? getDataFastVisitorId(cookieName);
  
  if (!id) {
    return metadata;
  }
  
  return {
    ...metadata,
    datafast_visitor_id: id,
  };
}

export const DataFastClient = {
  getVisitorId: getDataFastVisitorId,
  hasVisitorId: hasDataFastVisitorId,
  buildCheckoutUrl: buildCheckoutUrlWithVisitorId,
  addToMetadata: addVisitorIdToMetadata,
};

export default DataFastClient;
