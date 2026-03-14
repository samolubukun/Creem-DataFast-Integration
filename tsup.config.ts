import { defineConfig } from 'tsup';

export default defineConfig({
  entry: {
    'index': 'src/index.ts',
    'client/index': 'src/client/index.ts',
    'server/index': 'src/server/index.ts',
    'utils/idempotency': 'src/utils/idempotency.ts',
    'utils/idempotency-upstash': 'src/utils/idempotency-upstash.ts',
  },
  format: ['cjs', 'esm'],
  dts: true,
  splitting: false,
  sourcemap: true,
  clean: true,
  external: ['creem', 'express', 'next', '@upstash/redis'],
  treeshake: true,
});
