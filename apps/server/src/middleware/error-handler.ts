import type { ErrorRequestHandler, RequestHandler } from "express";
import multer from "multer";
import type { ApiError } from "@chatty/shared";
import { HttpError } from "../lib/http-error";

export const notFoundHandler: RequestHandler = (_req, res) => {
  res.status(404).json({ error: "Not found" } satisfies ApiError);
};

// Express 5 forwards rejected promises from async handlers here.
export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  if (err instanceof HttpError) {
    const body: ApiError = { error: err.message, ...(err.issues && { issues: err.issues }) };
    res.status(err.status).json(body);
    return;
  }
  if (err instanceof multer.MulterError) {
    res.status(400).json({ error: err.message } satisfies ApiError);
    return;
  }
  // Malformed JSON bodies from express.json().
  if (err instanceof SyntaxError && "body" in err) {
    res.status(400).json({ error: "Invalid JSON" } satisfies ApiError);
    return;
  }
  console.error(err);
  res.status(500).json({ error: "Something went wrong" } satisfies ApiError);
};
