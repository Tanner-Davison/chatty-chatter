import type { ApiError } from "@chatty/shared";
import { API_BASE } from "./config";

/** A failed API call. `issues` holds per-field messages from validation errors. */
export class ApiRequestError extends Error {
  constructor(
    readonly status: number,
    message: string,
    readonly issues?: Record<string, string[]>,
  ) {
    super(message);
    this.name = "ApiRequestError";
  }
}

type Body = Record<string, unknown> | FormData;

async function request<T>(method: string, path: string, body?: Body): Promise<T> {
  const isForm = body instanceof FormData;
  const res = await fetch(`${API_BASE}${path}`, {
    method,
    credentials: "same-origin",
    headers: body && !isForm ? { "Content-Type": "application/json" } : undefined,
    body: body ? (isForm ? body : JSON.stringify(body)) : undefined,
  });

  if (res.status === 204) return undefined as T;
  const data: unknown = await res.json().catch(() => null);
  if (!res.ok) {
    const err = (data ?? {}) as Partial<ApiError>;
    throw new ApiRequestError(
      res.status,
      err.error ?? `Request failed (${res.status})`,
      err.issues,
    );
  }
  return data as T;
}

export const api = {
  get: <T>(path: string) => request<T>("GET", path),
  post: <T>(path: string, body?: Body) => request<T>("POST", path, body),
  put: <T>(path: string, body?: Body) => request<T>("PUT", path, body),
  patch: <T>(path: string, body?: Body) => request<T>("PATCH", path, body),
  delete: <T>(path: string) => request<T>("DELETE", path),
};

export const isStatus = (err: unknown, status: number) =>
  err instanceof ApiRequestError && err.status === status;
