import { defineConfig } from 'tsup';

export default defineConfig({
  clean: true,
  dts: true,
  entry: {
    index: 'src/index.ts',
    client: 'src/client.ts',
    browser: 'src/browser/auto.ts',
    next: 'src/next.ts',
    express: 'src/express.ts',
    'idempotency/upstash': 'src/storage/upstash.ts',
  },
  format: ['esm'],
  sourcemap: true,
  target: 'node18',
});
