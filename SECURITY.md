# Security Policy

## Supported Versions

Security fixes are applied to the latest published version.

## Reporting a Vulnerability

If you discover a security issue, please do not open a public issue first.

Contact: `samuelolubukun@gmail.com`

Include:

- A clear description of the issue
- Reproduction steps
- Potential impact
- Suggested mitigation (if any)

You will receive an acknowledgment and triage response as soon as possible.

## Security Best Practices

- Keep `CREEM_WEBHOOK_SECRET` and `DATAFAST_API_KEY` server-side only.
- Verify webhook signatures from raw request body.
- Use durable idempotency storage in production.
- Do not commit `.env` files or npm tokens.
