import type { RequestHandler } from "express";
import { linkPreviewQuerySchema } from "@chatty/shared";
import type { LinkPreviewer } from "../lib/link-preview";
import { parse } from "../lib/validate";

export function createLinkPreviewController(preview: LinkPreviewer): RequestHandler {
  return async (req, res) => {
    const { url } = parse(linkPreviewQuerySchema, req.query);
    const result = await preview(url);
    // Previews change rarely; let the browser reuse them for an hour.
    res.set("Cache-Control", "private, max-age=3600");
    if (result) res.json(result);
    else res.status(204).end();
  };
}
