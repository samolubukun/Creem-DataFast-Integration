declare module 'next/server' {
  export interface NextRequest extends Request {}

  export class NextResponse extends Response {
    static json(body: unknown, init?: ResponseInit): NextResponse;
  }
}
