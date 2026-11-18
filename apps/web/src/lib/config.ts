// The REST API is always same-origin at /api: Vite proxies it in development
// and Netlify in production, so the session cookie stays first-party.
export const API_BASE = "/api";

// Socket.IO can't go through Netlify's proxy, so it connects to Heroku directly
// and authenticates with a short-lived token instead of the cookie.
const PRODUCTION_SOCKET_URL = "https://protected-retreat-97985-3868e60ef0db.herokuapp.com";

export const SOCKET_URL: string = import.meta.env.VITE_SOCKET_URL ?? PRODUCTION_SOCKET_URL;
