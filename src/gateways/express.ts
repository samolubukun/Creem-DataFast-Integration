import { InvalidCreemSignatureError } from '../foundation/errors.js';
import type {
  CreemDataFastClient,
  ExpressLikeRequest,
  ExpressLikeResponse,
  ExpressWebhookHandlerOptions,
} from '../foundation/types.js';

function getRawBody(body: Buffer | string): string {
  return typeof body === 'string' ? body : body.toString('utf8');
}

export function createExpressWebhookHandler(
  client: CreemDataFastClient,
  options: ExpressWebhookHandlerOptions = {}
): (req: ExpressLikeRequest, res: ExpressLikeResponse) => Promise<void> {
  return async (req: ExpressLikeRequest, res: ExpressLikeResponse) => {
    try {
      await client.handleWebhook({
        rawBody: getRawBody(req.body),
        headers: req.headers,
      });
      res.status(200).send('OK');
    } catch (error) {
      await options.onError?.(error);
      if (error instanceof InvalidCreemSignatureError) {
        res.status(400).send('Invalid signature');
        return;
      }
      res.status(500).send('Internal error');
    }
  };
}
