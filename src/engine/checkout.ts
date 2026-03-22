import { getHeaderValue } from '../infrastructure/http.js';
import { mergeTrackingIntoMetadata, readTrackingFromMetadata } from '../infrastructure/context.js';
import { readTrackingFromCookieHeader } from '../infrastructure/http.js';
import {
  CreemDataFastError,
  MetadataCollisionError,
  MissingTrackingError,
} from '../foundation/errors.js';
import type {
  CheckoutDependencies,
  CreateCheckoutContext,
  CreateCheckoutParams,
  CreateCheckoutResult,
  DataFastTracking,
} from '../foundation/types.js';

function hasExplicitTracking(tracking?: DataFastTracking): boolean {
  return Boolean(tracking?.visitorId || tracking?.sessionId);
}

function resolveTracking(
  explicit: DataFastTracking | undefined,
  metadataTracking: DataFastTracking,
  queryTracking: DataFastTracking,
  cookieTracking: DataFastTracking,
  captureSessionId: boolean
): DataFastTracking {
  return {
    visitorId:
      explicit?.visitorId ??
      metadataTracking.visitorId ??
      queryTracking.visitorId ??
      cookieTracking.visitorId,
    sessionId: captureSessionId
      ? explicit?.sessionId ??
        metadataTracking.sessionId ??
        queryTracking.sessionId ??
        cookieTracking.sessionId
      : undefined,
  };
}

function resolveCookieTracking(context?: CreateCheckoutContext): DataFastTracking {
  const requestCookieTracking = readTrackingFromCookieHeader(
    context?.request ? getHeaderValue(context.request.headers, 'cookie') : undefined
  );
  const fallbackCookieTracking = readTrackingFromCookieHeader(context?.cookieHeader);

  return {
    visitorId: requestCookieTracking.visitorId ?? fallbackCookieTracking.visitorId,
    sessionId: requestCookieTracking.sessionId ?? fallbackCookieTracking.sessionId,
  };
}

function readTrackingFromRequestUrl(request?: CreateCheckoutContext['request']): DataFastTracking {
  const requestUrl = request?.url;
  if (!requestUrl) {
    return {};
  }

  try {
    const url = new URL(requestUrl, 'http://localhost');
    return {
      visitorId: url.searchParams.get('datafast_visitor_id') ?? undefined,
      sessionId: url.searchParams.get('datafast_session_id') ?? undefined,
    };
  } catch {
    return {};
  }
}

export async function createCheckout(
  params: CreateCheckoutParams,
  context: CreateCheckoutContext | undefined,
  dependencies: CheckoutDependencies
): Promise<CreateCheckoutResult> {
  const cookieTracking = resolveCookieTracking(context);
  const metadataTracking = readTrackingFromMetadata(params.metadata);
  const queryTracking = readTrackingFromRequestUrl(context?.request);
  const tracking = resolveTracking(
    params.tracking,
    metadataTracking,
    queryTracking,
    cookieTracking,
    dependencies.captureSessionId
  );

  const strictTracking = context?.strictTracking ?? dependencies.strictTracking;
  if (strictTracking && !tracking.visitorId) {
    throw new MissingTrackingError('Missing datafast_visitor_id while strict tracking is enabled.');
  }

  if (!tracking.visitorId) {
    dependencies.logger.warn('Creating Creem checkout without DataFast visitor tracking.');
  }

  const finalMetadata = mergeTrackingIntoMetadata(params.metadata, tracking, {
    captureSessionId: dependencies.captureSessionId,
    preferTracking: hasExplicitTracking(params.tracking),
  });

  if (
    params.mergeStrategy === 'error' &&
    tracking.visitorId &&
    metadataTracking.visitorId &&
    tracking.visitorId !== metadataTracking.visitorId
  ) {
    throw new MetadataCollisionError(
      'Metadata already contains datafast_visitor_id with a different value.'
    );
  }

  if (params.mergeStrategy === 'overwrite' && tracking.visitorId) {
    finalMetadata.datafast_visitor_id = tracking.visitorId;
  }

  if (params.mergeStrategy === 'overwrite' && dependencies.captureSessionId && tracking.sessionId) {
    finalMetadata.datafast_session_id = tracking.sessionId;
  }

  const raw = await dependencies.creem.createCheckout({
    productId: params.productId,
    successUrl: params.successUrl,
    requestId: params.requestId,
    units: params.units,
    discountCode: params.discountCode,
    customer: params.customer,
    customFields: params.customFields,
    metadata: finalMetadata,
  });

  const checkoutId = raw.id;
  const checkoutUrl = raw.checkoutUrl ?? raw.checkout_url;

  if (typeof checkoutId !== 'string' || typeof checkoutUrl !== 'string') {
    throw new CreemDataFastError('Creem checkout response is missing id or checkoutUrl.');
  }

  return {
    checkoutId,
    checkoutUrl,
    injectedTracking: tracking,
    finalMetadata,
    raw,
  };
}
