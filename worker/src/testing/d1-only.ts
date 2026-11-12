// A Worker that only owns a local D1 for the tests (see localD1.ts).
export default { fetch: () => new Response(null, { status: 404 }) };
