import { describe, expect, it } from "vitest";
import { richTextHasTable, richTextToPlainText, sanitizeRichText, truncateRichTextPlain } from "@/lib/html/rich-text";

describe("rich-text", () => {
  it("preserves allowed markup and safe style properties", () => {
    const html = sanitizeRichText(`<p><strong>Oi</strong> <span style="color: red; position: absolute;">teste</span></p>`);
    expect(html).toContain("<strong>Oi</strong>");
    expect(html).toContain('style="color:red"');
    expect(html).not.toContain("position:");
  });

  it("removes blocked tags and inline images", () => {
    const html = sanitizeRichText(`<script>alert(1)</script><img src="x" /><p>ok</p>`);
    expect(html).toBe("<p>ok</p>");
  });

  it("extracts plain text and truncates snippets", () => {
    expect(richTextToPlainText("<p>Olá <strong>mundo</strong></p>")).toBe("Olá mundo");
    expect(truncateRichTextPlain("<p>Olá <strong>mundo</strong></p>", 5)).toBe("Olá…");
  });

  it("detects table markup", () => {
    expect(richTextHasTable("<table><tr><td>x</td></tr></table>")).toBe(true);
    expect(richTextHasTable("<p>sem tabela</p>")).toBe(false);
  });
});
