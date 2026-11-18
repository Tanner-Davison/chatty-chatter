import type { CookieOptions, Request, RequestHandler, Response } from "express";
import type { Env } from "../config/env";
import { unauthorized } from "../lib/http-error";
import { SESSION_TTL_SECONDS, verifySessionToken, type TokenClaims } from "../lib/tokens";

export const SESSION_COOKIE = "chatty_session";

declare module "express-serve-static-core" {
  interface Request {
    user?: TokenClaims;
  }
}

// The web app reaches the API through a same-site proxy (Netlify in
// production, Vite in development), so a Lax first-party cookie works.
function cookieOptions(env: Env): CookieOptions {
  return {
    httpOnly: true,
    secure: env.isProduction,
    sameSite: "lax",
    path: "/",
  };
}

export function setSessionCookie(env: Env, res: Response, token: string): void {
  res.cookie(SESSION_COOKIE, token, { ...cookieOptions(env), maxAge: SESSION_TTL_SECONDS * 1000 });
}

export function clearSessionCookie(env: Env, res: Response): void {
  res.clearCookie(SESSION_COOKIE, cookieOptions(env));
}

/** Rejects the request with 401 unless it carries a valid session cookie. */
export function requireAuth(env: Env): RequestHandler {
  return (req, _res, next) => {
    const token: unknown = req.cookies?.[SESSION_COOKIE];
    const claims = typeof token === "string" ? verifySessionToken(env.JWT_SECRET, token) : null;
    if (!claims) return next(unauthorized());
    req.user = claims;
    next();
  };
}

/** The logged-in user. Only call it behind requireAuth. */
export function currentUser(req: Request): TokenClaims {
  if (!req.user) throw unauthorized();
  return req.user;
}
