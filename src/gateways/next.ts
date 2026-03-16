import { InvalidCreemSignatureError } from '../foundation/errors.js';
import type {
  CreemDataFastClient,
  HandleWebhookResult,
  NextWebhookHandlerOptions,
} from '../foundation/types.js';

export async function handleWebhookRequest(
  client: CreemDataFastClient,
  request: Request
): Promise<HandleWebhookResult> {
  const rawBody = await request.text();
  return client.handleWebhook({
    rawBody,
    headers: request.headers,
  });
}

export function createNextWebhookHandler(
  client: CreemDataFastClient,
  options: NextWebhookHandlerOptions = {}
): (request: Request) => Promise<Response> {
  return async (request: Request) => {
    try {
      await handleWebhookRequest(client, request);
      return new Response('OK', { status: 200 });
    } catch (error) {
      await options.onError?.(error);
      if (error instanceof InvalidCreemSignatureError) {
        return new Response('Invalid signature', { status: 400 });
      }
      return new Response('Internal error', { status: 500 });
    }
  };
}
