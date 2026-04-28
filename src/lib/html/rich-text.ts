import sanitizeHtml from "sanitize-html";

export const RICH_TEXT_ALLOWED_TAGS = [
  "p",
  "br",
  "strong",
  "em",
  "u",
  "s",
  "mark",
  "span",
  "div",
  "ul",
  "ol",
  "li",
  "table",
  "thead",
  "tbody",
  "tr",
  "th",
  "td",
  "sub",
  "sup",
  "small",
] as const;

export const RICH_TEXT_ALLOWED_STYLE_PROPERTIES = [
  "color",
  "background-color",
  "text-align",
  "font-weight",
  "font-style",
  "text-decoration",
] as const;

const ALLOWED_STYLE_PROPERTIES = new Set<string>(RICH_TEXT_ALLOWED_STYLE_PROPERTIES);

export const RICH_TEXT_ALLOWED_TAGS_LABEL = RICH_TEXT_ALLOWED_TAGS.map((tag) => `<${tag}>`).join(", ");
export const RICH_TEXT_ALLOWED_STYLE_LABEL = RICH_TEXT_ALLOWED_STYLE_PROPERTIES.join(", ");
export const RICH_TEXT_ALLOWED_ATTRIBUTE_LABEL =
  '`style` em <p>/<div>/<span>/<table>/<th>/<td> e `colspan`/`rowspan` em <th>/<td>';
export const RICH_TEXT_BLOCKED_FEATURES_LABEL =
  "bloqueia <img>, <script>, <iframe>, class, id, atributos on* e URLs embutidas em style";

function sanitizeStyleAttribute(value: string): string {
  return value
    .split(";")
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => {
      const idx = part.indexOf(":");
      if (idx === -1) return "";
      const property = part.slice(0, idx).trim().toLowerCase();
      const rawValue = part.slice(idx + 1).trim();
      if (!ALLOWED_STYLE_PROPERTIES.has(property) || !rawValue) return "";
      if (/[<>{}`]/.test(rawValue)) return "";
      if (/url\s*\(/i.test(rawValue)) return "";
      return `${property}: ${rawValue}`;
    })
    .filter(Boolean)
    .join("; ");
}

export function sanitizeRichText(html: string): string {
  return sanitizeHtml(html, {
    allowedTags: [...RICH_TEXT_ALLOWED_TAGS],
    allowedAttributes: {
      p: ["style"],
      div: ["style"],
      span: ["style"],
      table: ["style"],
      th: ["style", "colspan", "rowspan"],
      td: ["style", "colspan", "rowspan"],
    },
    transformTags: {
      "*": (_tagName, attribs) => {
        const nextAttribs = { ...attribs };
        if (nextAttribs.style) {
          const style = sanitizeStyleAttribute(nextAttribs.style);
          if (style) nextAttribs.style = style;
          else delete nextAttribs.style;
        }
        delete nextAttribs.class;
        delete nextAttribs.id;
        for (const key of Object.keys(nextAttribs)) {
          if (key.toLowerCase().startsWith("on")) delete nextAttribs[key];
        }
        return { tagName: _tagName, attribs: nextAttribs };
      },
    },
    allowedSchemes: [],
    allowedSchemesAppliedToAttributes: [],
    disallowedTagsMode: "discard",
  });
}

export function richTextToPlainText(html: string): string {
  return sanitizeHtml(html, {
    allowedTags: [],
    allowedAttributes: {},
    textFilter(text) {
      return text.replace(/\s+/g, " ");
    },
  }).replace(/\s+/g, " ").trim();
}

export function truncateRichTextPlain(html: string, maxChars: number): string {
  const text = richTextToPlainText(html);
  if (text.length <= maxChars) return text;
  return `${text.slice(0, Math.max(0, maxChars - 1)).trimEnd()}…`;
}

export function richTextHasTable(html: string): boolean {
  return /<table[\s>]/i.test(html);
}
