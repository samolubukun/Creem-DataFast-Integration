# Production Idempotency

This package deduplicates incoming Creem webhook events before forwarding payments to DataFast.

## Why it matters

Creem can retry webhook deliveries. Without idempotency, a retry can create duplicate payment events in DataFast.

## Default behavior

- Default store: `MemoryIdempotencyStore`
- Good for: local development, single process
- Not enough for: multiple instances, serverless cold starts, process restarts

## Recommended production setup

Use a durable distributed store, such as Upstash Redis:

```ts
import { Redis } from '@upstash/redis';
import { createCreemDataFast, UpstashIdempotencyStore } from 'creem-datafast-integration';

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

const cd = createCreemDataFast({
  creemApiKey: process.env.CREEM_API_KEY!,
  creemWebhookSecret: process.env.CREEM_WEBHOOK_SECRET!,
  datafastApiKey: process.env.DATAFAST_API_KEY!,
  idempotencyStore: UpstashIdempotencyStore(redis),
});
```

## TTL guidance

- `idempotencyInFlightTtlSeconds` default: `300`
- `idempotencyProcessedTtlSeconds` default: `86400`

Suggested values:

- Keep in-flight TTL between `300` and `900` seconds
- Keep processed TTL at least `24h`; increase to `72h` if retries are frequent

## Failure modes

- **Store unavailable**: webhook handling can fail to claim or complete keys
- **TTL too short**: duplicate forwards can happen on delayed retries
- **In-memory in multi-instance**: each instance can process the same event

## Replay strategy

- Use `replayWebhook(...)` when intentionally reprocessing known events
- Keep replay usage explicit and logged
- Prefer dry-run (`webhookDryRun`) first during incident validation
