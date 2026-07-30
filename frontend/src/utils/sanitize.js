import sanitizeHtmlLib from "sanitize-html";

/**
 * Sanitize untrusted HTML (e.g. manga descriptions sourced from external
 * metadata/scrapers) before it's rendered via dangerouslySetInnerHTML.
 *
 * This replaces a previous hand-rolled regex-based sanitizer. Regex
 * approaches to HTML sanitization are well known to be bypassable (malformed
 * tags, unusual whitespace, encoded attributes, unexpected tag/attribute
 * combinations) — `sanitize-html` is a maintained, widely-used parser-based
 * sanitizer that doesn't have that class of bug.
 *
 * Only a small allowlist of formatting tags is permitted; everything else
 * (scripts, iframes, event handlers, style attributes, javascript: URLs,
 * etc.) is stripped.
 */
export function sanitizeHtml(html) {
  if (!html) return "";
  return sanitizeHtmlLib(html, {
    allowedTags: ["b", "i", "em", "strong", "br", "p", "ul", "ol", "li", "a", "span"],
    allowedAttributes: {
      a: ["href", "title", "rel", "target"],
    },
    allowedSchemes: ["http", "https", "mailto"],
    // Force safe rel/target on any surviving links rather than trusting the source.
    transformTags: {
      a: sanitizeHtmlLib.simpleTransform("a", { rel: "noopener noreferrer nofollow", target: "_blank" }),
    },
    disallowedTagsMode: "discard",
  });
}
