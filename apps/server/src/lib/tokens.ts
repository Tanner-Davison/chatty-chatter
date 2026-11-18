import jwt from "jsonwebtoken";

// Two token kinds signed with the same secret. The audience keeps a socket
// token from being used as a session cookie and the other way round.
const SESSION_AUDIENCE = "chatty:session";
const SOCKET_AUDIENCE = "chatty:socket";

export const SESSION_TTL_SECONDS = 60 * 60 * 24 * 7;
const SOCKET_TTL_SECONDS = 60;

export interface TokenClaims {
  /** The user's Mongo id. */
  sub: string;
  username: string;
}

function sign(secret: string, claims: TokenClaims, audience: string, ttl: number): string {
  return jwt.sign({ username: claims.username }, secret, {
    subject: claims.sub,
    audience,
    expiresIn: ttl,
    algorithm: "HS256",
  });
}

function verify(secret: string, token: string, audience: string): TokenClaims | null {
  try {
    const payload = jwt.verify(token, secret, { audience, algorithms: ["HS256"] });
    if (typeof payload === "string" || !payload.sub || typeof payload.username !== "string") {
      return null;
    }
    return { sub: payload.sub, username: payload.username };
  } catch {
    return null;
  }
}

export const signSessionToken = (secret: string, claims: TokenClaims) =>
  sign(secret, claims, SESSION_AUDIENCE, SESSION_TTL_SECONDS);
export const verifySessionToken = (secret: string, token: string) =>
  verify(secret, token, SESSION_AUDIENCE);

export const signSocketToken = (secret: string, claims: TokenClaims) =>
  sign(secret, claims, SOCKET_AUDIENCE, SOCKET_TTL_SECONDS);
export const verifySocketToken = (secret: string, token: string) =>
  verify(secret, token, SOCKET_AUDIENCE);
