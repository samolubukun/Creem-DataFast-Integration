import { createHmac } from 'node:crypto';
import { readFileSync } from 'node:fs';

const baseUrl = process.env.WEBHOOK_URL;
const secret = process.env.CREEM_WEBHOOK_SECRET;
const fixturePath = process.env.FIXTURE_PATH || new URL('../tests/fixtures/checkout-completed.json', import.meta.url);

if (!baseUrl) {
  console.error('Missing WEBHOOK_URL');
  process.exit(1);
}

if (!secret) {
  console.error('Missing CREEM_WEBHOOK_SECRET');
  process.exit(1);
}

const rawBody = readFileSync(fixturePath, 'utf8');
const signature = createHmac('sha256', secret).update(rawBody).digest('hex');

const response = await fetch(baseUrl, {
  method: 'POST',
  headers: {
    'content-type': 'application/json',
    'creem-signature': signature,
  },
  body: rawBody,
});

const text = await response.text();
console.log(`status=${response.status}`);
console.log(text);

if (!response.ok) {
  process.exit(1);
}
