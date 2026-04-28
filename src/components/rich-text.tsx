import { sanitizeRichText } from "@/lib/html/rich-text";

interface Props {
  html: string;
  className?: string;
}

export function RichText({ html, className }: Props) {
  const safeHtml = sanitizeRichText(html);
  return (
    <div
      className={`rich-content${className ? ` ${className}` : ""}`}
      dangerouslySetInnerHTML={{ __html: safeHtml }}
    />
  );
}
