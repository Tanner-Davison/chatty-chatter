const PRODUCTION_API_URL = "https://protected-retreat-97985-3868e60ef0db.herokuapp.com";

export const API_URL: string = import.meta.env.VITE_API_URL ?? PRODUCTION_API_URL;
export const WS_URL: string = import.meta.env.VITE_WS_URL ?? API_URL;
