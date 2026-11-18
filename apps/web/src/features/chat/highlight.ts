// Loaded on demand by CodeBlock, so highlight.js stays out of the main bundle.
import hljs from "highlight.js/lib/core";
import bash from "highlight.js/lib/languages/bash";
import cpp from "highlight.js/lib/languages/cpp";
import csharp from "highlight.js/lib/languages/csharp";
import css from "highlight.js/lib/languages/css";
import go from "highlight.js/lib/languages/go";
import java from "highlight.js/lib/languages/java";
import javascript from "highlight.js/lib/languages/javascript";
import json from "highlight.js/lib/languages/json";
import markdown from "highlight.js/lib/languages/markdown";
import php from "highlight.js/lib/languages/php";
import python from "highlight.js/lib/languages/python";
import ruby from "highlight.js/lib/languages/ruby";
import rust from "highlight.js/lib/languages/rust";
import sql from "highlight.js/lib/languages/sql";
import typescript from "highlight.js/lib/languages/typescript";
import xml from "highlight.js/lib/languages/xml";
import yaml from "highlight.js/lib/languages/yaml";

const LANGUAGES = {
  bash,
  cpp,
  csharp,
  css,
  go,
  java,
  javascript,
  json,
  markdown,
  php,
  python,
  ruby,
  rust,
  sql,
  typescript,
  xml,
  yaml,
};
for (const [name, language] of Object.entries(LANGUAGES)) hljs.registerLanguage(name, language);
// Common short names; highlight.js already knows js, ts, py, html, sh and more.
hljs.registerAliases(["jsx", "tsx"], { languageName: "typescript" });

/** Highlighted HTML (highlight.js escapes the code) and the language it used. */
export function highlight(code: string, lang?: string): { html: string; language?: string } {
  if (lang && hljs.getLanguage(lang)) {
    return {
      html: hljs.highlight(code, { language: lang, ignoreIllegals: true }).value,
      language: lang,
    };
  }
  const auto = hljs.highlightAuto(code);
  // Weak guesses on short snippets are worse than plain text.
  if (auto.relevance < 5) return { html: escapeHtml(code) };
  return { html: auto.value, ...(auto.language && { language: auto.language }) };
}

function escapeHtml(text: string): string {
  return text.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
}
