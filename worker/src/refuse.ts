/** An error answer: `{ error }` in plain words, with its HTTP status. */
export const refuse = (status: number, error: string): Response => Response.json({ error }, { status });
