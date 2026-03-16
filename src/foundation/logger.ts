import type { LoggerLike } from './types.js';

const NOOP_LOGGER: LoggerLike = {
  debug() {},
  info() {},
  warn() {},
  error() {},
};

export function resolveLogger(logger?: LoggerLike): LoggerLike {
  return logger ?? NOOP_LOGGER;
}
