# Changelog

## 2.1.3

- Added clearer API naming and deprecations:
  - `webhookDryRun` (preferred) with `dryRun` legacy alias.
  - `health.ok` (canonical) with deprecated `health.healthy` compatibility.
- Added one-time development warning when legacy `dryRun` is used.
- Rewrote README with a 2-minute quickstart for Next.js.
- Fixed TypeScript `--noEmit` stability by aligning test import paths with NodeNext resolution.
- Added local `next/server` type shim so optional Next.js adapter typechecks without Next installed.

## 2.1.2

- Added parity methods and safety hardening for integration flows.

## 2.1.1

- Fixed crypto reference error.

## 2.1.0

- Expanded engine, storage, and infrastructure coverage.
