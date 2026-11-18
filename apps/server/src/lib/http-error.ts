/** An error with an HTTP status. The error handler sends its message to the client. */
export class HttpError extends Error {
  constructor(
    readonly status: number,
    message: string,
    readonly issues?: Record<string, string[]>,
  ) {
    super(message);
    this.name = "HttpError";
  }
}

export const badRequest = (message: string, issues?: Record<string, string[]>) =>
  new HttpError(400, message, issues);
export const unauthorized = (message = "Please log in") => new HttpError(401, message);
export const forbidden = (message = "You don't have access to that") => new HttpError(403, message);
export const notFound = (message = "Not found") => new HttpError(404, message);
export const conflict = (message: string) => new HttpError(409, message);
