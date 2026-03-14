// Client (checkout wrapper)
export { CreemDataFastClient, createCreemDataFastClient } from './client/create-checkout.js';

// Client-side cookie helpers (browser)
export {
  getDataFastVisitorId as getDataFastVisitorIdBrowser,
  hasDataFastVisitorId,
  buildCheckoutUrlWithVisitorId,
  addVisitorIdToMetadata,
  DataFastClient,
} from './client/index.js';

// Server (webhook handlers)
export {
  WebhookHandler,
  createWebhookHandler,
  creemDataFastWebhook,
  creemDataFastWebhookHandler,
  createNextJsWebhookHandler,
  handleGenericWebhook,
} from './server/index.js';

// Types
export * from './types/index.js';

// Utilities
export {
  mapCreemEventToDataFast,
  mapToDataFastPaymentRequest,
} from './utils/map-payment.js';

export {
  getDataFastVisitorId,
  parseCookieHeader,
} from './utils/cookie.js';
