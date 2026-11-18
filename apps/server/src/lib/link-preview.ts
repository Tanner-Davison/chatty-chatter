import { lookup as dnsLookup, type LookupAddress } from "node:dns";
import { isIP } from "node:net";
import ipaddr from "ipaddr.js";
import { Agent, fetch } from "undici";
import type { LinkPreview } from "@chatty/shared";

const TIMEOUT_MS = 5000;
const MAX_BYTES = 512 * 1024;
const MAX_REDIRECTS = 3;
const ALLOWED_PORTS = new Set(["", "80", "443"]);
const USER_AGENT = "ChattyChatterBot/1.0 (+https://chattychatter.com)";

/** Only ordinary public internet addresses: no loopback, private, link-local (cloud metadata) and so on. */
export function isPublicAddress(address: string): boolean {
  try {
    return ipaddr.process(address).range() === "unicast";
  } catch {
    return false;
  }
}

/** URLs the previewer may fetch at all, before DNS. */
export function isFetchableUrl(raw: string): URL | null {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return null;
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") return null;
  if (url.username || url.password || !ALLOWED_PORTS.has(url.port)) return null;
  const host = url.hostname.replace(/^\[|\]$/g, "");
  if (host === "localhost" || host.endsWith(".localhost") || host.endsWith(".internal"))
    return null;
  // IP literals skip DNS lookup when connecting, so check them here.
  if (isIP(host) && !isPublicAddress(host)) return null;
  return url;
}

// Every connection resolves through this, so a hostname that points at a
// private address (or switches to one after a first check) is refused.
type LookupCallback = (
  err: NodeJS.ErrnoException | null,
  address: string | LookupAddress[],
  family?: number,
) => void;

function safeLookup(hostname: string, options: { all?: boolean }, callback: LookupCallback): void {
  dnsLookup(hostname, { all: true }, (err, addresses) => {
    if (err) return callback(err, "");
    if (addresses.length === 0 || !addresses.every((a) => isPublicAddress(a.address))) {
      return callback(
        Object.assign(new Error(`Refusing to connect to ${hostname}`), { code: "EBLOCKED" }),
        "",
      );
    }
    if (options.all) return callback(null, addresses);
    callback(null, addresses[0]!.address, addresses[0]!.family);
  });
}

const agent = new Agent({
  connect: { lookup: safeLookup as never, timeout: TIMEOUT_MS },
  headersTimeout: TIMEOUT_MS,
  bodyTimeout: TIMEOUT_MS,
});

interface FetchedPage {
  url: string;
  contentType: string;
  body: string;
}

/** Fetches a page safely: allowed URLs only, redirects re-checked, size and time capped. */
export async function fetchPage(raw: string): Promise<FetchedPage | null> {
  let url = isFetchableUrl(raw);
  const signal = AbortSignal.timeout(TIMEOUT_MS);
  for (let hop = 0; url && hop <= MAX_REDIRECTS; hop++) {
    const res = await fetch(url, {
      dispatcher: agent,
      redirect: "manual",
      signal,
      headers: {
        "User-Agent": USER_AGENT,
        Accept: "text/html,application/xhtml+xml,image/*;q=0.8",
      },
    });
    if (res.status >= 300 && res.status < 400) {
      const location = res.headers.get("location");
      await res.body?.cancel();
      url = location ? isFetchableUrl(new URL(location, url).toString()) : null;
      continue;
    }
    const contentType = res.headers.get("content-type") ?? "";
    if (!res.ok || !res.body) {
      await res.body?.cancel();
      return null;
    }
    if (!contentType.includes("html") && !contentType.includes("json")) {
      await res.body.cancel();
      return { url: url.toString(), contentType, body: "" };
    }
    return { url: url.toString(), contentType, body: await readCapped(res.body) };
  }
  return null;
}

async function readCapped(body: ReadableStream<Uint8Array>): Promise<string> {
  const reader = body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  while (size < MAX_BYTES) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    size += value.byteLength;
  }
  await reader.cancel();
  return new TextDecoder().decode(Buffer.concat(chunks).subarray(0, MAX_BYTES));
}

const ENTITIES: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
};

function decodeEntities(text: string): string {
  return text.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (whole, code: string) => {
    if (code[0] === "#") {
      const n =
        code[1]?.toLowerCase() === "x" ? parseInt(code.slice(2), 16) : parseInt(code.slice(1), 10);
      return Number.isFinite(n) && n > 0 && n < 0x110000 ? String.fromCodePoint(n) : whole;
    }
    return ENTITIES[code.toLowerCase()] ?? whole;
  });
}

const clean = (text: string | undefined, max: number) => {
  const value = text && decodeEntities(text).replace(/\s+/g, " ").trim();
  return value ? (value.length > max ? `${value.slice(0, max - 1)}…` : value) : undefined;
};

function attributes(tag: string): Record<string, string> {
  const attrs: Record<string, string> = {};
  for (const m of tag.matchAll(/([a-z:-]+)\s*=\s*("([^"]*)"|'([^']*)'|([^\s>]+))/gi)) {
    attrs[m[1]!.toLowerCase()] = m[3] ?? m[4] ?? m[5] ?? "";
  }
  return attrs;
}

/** Previews only load images over https, so they can't downgrade the page. */
function httpsUrl(raw: string | undefined, base: string): string | undefined {
  if (!raw) return undefined;
  try {
    const url = new URL(decodeEntities(raw), base);
    return url.protocol === "https:" ? url.toString() : undefined;
  } catch {
    return undefined;
  }
}

/** Pulls Open Graph / Twitter / plain HTML metadata out of a page's <head>. */
export function parsePreview(pageUrl: string, html: string): LinkPreview {
  const headEnd = html.search(/<\/head>/i);
  const head = headEnd === -1 ? html : html.slice(0, headEnd);
  const meta: Record<string, string> = {};
  for (const [tag] of head.matchAll(/<meta\b[^>]*>/gi)) {
    const a = attributes(tag);
    const key = (a.property ?? a.name)?.toLowerCase();
    if (key && a.content && !(key in meta)) meta[key] = a.content;
  }
  let favicon: string | undefined;
  for (const [tag] of head.matchAll(/<link\b[^>]*>/gi)) {
    const a = attributes(tag);
    if (/\bicon\b/i.test(a.rel ?? "") && a.href) {
      favicon = a.href;
      break;
    }
  }
  const title = head.match(/<title[^>]*>([^<]*)<\/title>/i)?.[1];

  return {
    url: pageUrl,
    title: clean(meta["og:title"] ?? meta["twitter:title"] ?? title, 200),
    description: clean(
      meta["og:description"] ?? meta["twitter:description"] ?? meta.description,
      300,
    ),
    image: httpsUrl(meta["og:image"] ?? meta["og:image:url"] ?? meta["twitter:image"], pageUrl),
    siteName: clean(meta["og:site_name"], 80) ?? new URL(pageUrl).hostname.replace(/^www\./, ""),
    favicon: httpsUrl(favicon ?? "/favicon.ico", pageUrl),
  };
}

// Some big sites (YouTube puts 500 KB+ of scripts before its meta tags) are
// better read through their official oEmbed APIs, which return small JSON.
const OEMBED_PROVIDERS: { match: RegExp; endpoint: string; siteName: string }[] = [
  {
    match: /^https?:\/\/((www|m|music)\.)?(youtube\.com\/(watch|shorts|live)|youtu\.be\/)/i,
    endpoint: "https://www.youtube.com/oembed",
    siteName: "YouTube",
  },
  {
    match: /^https?:\/\/(www\.)?vimeo\.com\/\d+/i,
    endpoint: "https://vimeo.com/api/oembed.json",
    siteName: "Vimeo",
  },
  {
    match: /^https?:\/\/open\.spotify\.com\//i,
    endpoint: "https://open.spotify.com/oembed",
    siteName: "Spotify",
  },
];

interface OEmbed {
  title?: string;
  author_name?: string;
  thumbnail_url?: string;
}

/** The oEmbed endpoint for a URL, if it's from a site we read that way. */
export function oembedUrl(url: string): { endpoint: string; siteName: string } | null {
  const provider = OEMBED_PROVIDERS.find((p) => p.match.test(url));
  if (!provider) return null;
  const endpoint = new URL(provider.endpoint);
  endpoint.searchParams.set("url", url);
  endpoint.searchParams.set("format", "json");
  return { endpoint: endpoint.toString(), siteName: provider.siteName };
}

function parseOEmbed(url: string, siteName: string, body: string): LinkPreview | null {
  let data: OEmbed;
  try {
    data = JSON.parse(body) as OEmbed;
  } catch {
    return null;
  }
  const title = clean(data.title, 200);
  if (!title) return null;
  return {
    url,
    title,
    description: clean(data.author_name, 120),
    image: httpsUrl(data.thumbnail_url, url),
    siteName,
  };
}

export type LinkPreviewer = (url: string) => Promise<LinkPreview | null>;

const CACHE_MS = 6 * 60 * 60 * 1000;
const FAILURE_CACHE_MS = 30 * 60 * 1000;
const CACHE_SIZE = 500;

/** Previews links, caching results (and failures) so each URL is fetched rarely. */
export function createLinkPreviewer(fetcher: typeof fetchPage = fetchPage): LinkPreviewer {
  const cache = new Map<string, { value: LinkPreview | null; expires: number }>();
  return async (url) => {
    const hit = cache.get(url);
    if (hit && hit.expires > Date.now()) return hit.value;

    let value: LinkPreview | null = null;
    try {
      const oembed = oembedUrl(url);
      const page = await fetcher(oembed?.endpoint ?? url);
      if (oembed) {
        value = page ? parseOEmbed(url, oembed.siteName, page.body) : null;
      } else if (page?.contentType.startsWith("image/")) {
        value = page.url.startsWith("https:")
          ? { url: page.url, image: page.url, siteName: new URL(page.url).hostname }
          : null;
      } else if (page) {
        const preview = parsePreview(page.url, page.body);
        value = preview.title || preview.image ? { ...preview, url } : null;
      }
    } catch {
      value = null;
    }

    if (cache.size >= CACHE_SIZE) cache.delete(cache.keys().next().value!);
    cache.set(url, { value, expires: Date.now() + (value ? CACHE_MS : FAILURE_CACHE_MS) });
    return value;
  };
}
