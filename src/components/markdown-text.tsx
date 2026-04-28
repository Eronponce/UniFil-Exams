import { RichText } from "@/components/rich-text";

interface Props {
  text: string;
  className?: string;
}

export function MarkdownText({ text, className }: Props) {
  return <RichText html={text} className={className} />;
}
