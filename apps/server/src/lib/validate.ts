import type { z } from "zod";
import { badRequest } from "./http-error";

/** Parses request data with a shared zod schema, or throws a 400 listing each field's problems. */
export function parse<S extends z.ZodType>(schema: S, data: unknown): z.output<S> {
  const result = schema.safeParse(data);
  if (result.success) return result.data;

  const issues: Record<string, string[]> = {};
  for (const issue of result.error.issues) {
    const key = issue.path.join(".") || "_";
    (issues[key] ??= []).push(issue.message);
  }
  const first = result.error.issues[0]?.message ?? "Invalid request";
  throw badRequest(first, issues);
}
