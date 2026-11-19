import type { RequestHandler } from "express";
import { gifSearchQuerySchema } from "@chatty/shared";
import type { GifSearch } from "../lib/gifs";
import { parse } from "../lib/validate";

export function createGifController(search: GifSearch): RequestHandler {
  return async (req, res) => {
    const { q, offset } = parse(gifSearchQuerySchema, req.query);
    const gifs = await search(q, offset);
    // Results shift slowly; let the browser reuse them for a few minutes.
    res.set("Cache-Control", "private, max-age=300");
    res.json(gifs);
  };
}
