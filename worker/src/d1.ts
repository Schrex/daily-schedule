/**
 * The part of Cloudflare's D1 binding the Worker uses. Declared here because
 * the project's TypeScript setup is the browser's (DOM), without the Workers
 * types; the real binding (and the tests' local D1) fits it.
 */
export interface D1Database {
  prepare(sql: string): D1PreparedStatement;
  batch(statements: D1PreparedStatement[]): Promise<unknown[]>;
}

export interface D1PreparedStatement {
  bind(...values: unknown[]): D1PreparedStatement;
  first<T = Record<string, unknown>>(): Promise<T | null>;
  all<T = Record<string, unknown>>(): Promise<{ results: T[] }>;
  run(): Promise<unknown>;
}
