import { isGiphyMediaUrl, type GifResult } from "@chatty/shared";
import type { Env } from "../config/env";
import { HttpError } from "./http-error";

export const GIF_PAGE_SIZE = 24;
const TIMEOUT_MS = 5000;

/** Finds GIFs to send: trending when the query is empty. */
export type GifSearch = (query: string, offset: number) => Promise<GifResult[]>;

/** Used when no GIPHY key is configured: searching says GIFs aren't available. */
export const unavailableGifSearch: GifSearch = () =>
  Promise.reject(new HttpError(503, "GIFs aren't available right now"));

interface GiphyRendition {
  url?: string;
  webp?: string;
  width?: string;
  height?: string;
}

interface GiphyGif {
  id?: string;
  title?: string;
  images?: Record<string, GiphyRendition | undefined>;
}

/** Turns one GIPHY result into ours, or null when it's missing what we need. */
export function toGifResult(gif: GiphyGif): GifResult | null {
  // 200px tall for messages; 200px wide for the picker's columns.
  const full = gif.images?.fixed_height;
  const thumb = gif.images?.fixed_width ?? full;
  const url = full?.webp ?? full?.url;
  const preview = thumb?.webp ?? thumb?.url;
  const width = Number(full?.width);
  const height = Number(full?.height);
  if (!gif.id || !url || !preview || !(width > 0) || !(height > 0)) return null;
  if (!isGiphyMediaUrl(url) || !isGiphyMediaUrl(preview)) return null;
  return {
    id: gif.id,
    url,
    preview,
    width: Math.round(width),
    height: Math.round(height),
    ...(gif.title?.trim() && { title: gif.title.trim().slice(0, 200) }),
  };
}

export function createGiphySearch(env: Env): GifSearch {
  const apiKey = env.GIPHY_API_KEY;
  if (!apiKey) return unavailableGifSearch;
  return async (query, offset) => {
    const params = new URLSearchParams({
      api_key: apiKey,
      limit: String(GIF_PAGE_SIZE),
      offset: String(offset),
      rating: env.GIPHY_RATING,
      bundle: "messaging_non_clips",
    });
    if (query) params.set("q", query);
    const endpoint = query ? "search" : "trending";
    const res = await fetch(`https://api.giphy.com/v1/gifs/${endpoint}?${params}`, {
      signal: AbortSignal.timeout(TIMEOUT_MS),
    }).catch(() => null);
    if (!res?.ok) {
      console.error(`GIPHY ${endpoint} failed`, res?.status);
      throw new HttpError(502, "Couldn't load GIFs. Try again in a moment.");
    }
    const body = (await res.json()) as { data?: GiphyGif[] };
    return (body.data ?? []).flatMap((gif) => toGifResult(gif) ?? []);
  };
}
