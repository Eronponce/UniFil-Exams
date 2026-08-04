import type { ReactNode, SVGProps } from "react";

export type IconName =
  | "activity"
  | "arrow-left"
  | "arrow-right"
  | "book-open"
  | "check"
  | "chevron-down"
  | "chevron-right"
  | "circle-check"
  | "clipboard"
  | "close"
  | "command"
  | "file-plus"
  | "file-text"
  | "grid"
  | "help"
  | "layers"
  | "menu"
  | "message"
  | "moon"
  | "panel-left"
  | "plus"
  | "search"
  | "settings"
  | "sparkles"
  | "sun"
  | "upload"
  | "wand";

interface IconProps extends SVGProps<SVGSVGElement> {
  name: IconName;
  size?: number;
}

const paths: Record<IconName, ReactNode> = {
  activity: <><path d="M3 12h3l2-8 4 16 2-8h4" /></>,
  "arrow-left": <><path d="m12 5-7 7 7 7" /><path d="M19 12H5" /></>,
  "arrow-right": <><path d="M5 12h14" /><path d="m12 5 7 7-7 7" /></>,
  "book-open": <><path d="M3 5.5A2.5 2.5 0 0 1 5.5 3H20v16H5.5A2.5 2.5 0 0 0 3 21.5v-16Z" /><path d="M3 21.5A2.5 2.5 0 0 1 5.5 19H20" /><path d="M7 7h8M7 11h7" /></>,
  check: <path d="m5 12 4 4L19 6" />,
  "chevron-down": <path d="m5 9 7 7 7-7" />,
  "chevron-right": <path d="m9 5 7 7-7 7" />,
  "circle-check": <><circle cx="12" cy="12" r="9" /><path d="m8 12 2.5 2.5L16 9" /></>,
  clipboard: <><rect x="5" y="4" width="14" height="17" rx="2" /><path d="M9 4.5V3h6v1.5M8 9h8M8 13h6M8 17h4" /></>,
  close: <><path d="m6 6 12 12M18 6 6 18" /></>,
  command: <><path d="M18 6a3 3 0 1 0-3 3v6a3 3 0 1 0 3-3H6a3 3 0 1 0 3 3V6a3 3 0 1 0-3 3h12" /></>,
  "file-plus": <><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z" /><path d="M14 2v6h6M12 12v6M9 15h6" /></>,
  "file-text": <><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z" /><path d="M14 2v6h6M8 13h8M8 17h6" /></>,
  grid: <><rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" /></>,
  help: <><circle cx="12" cy="12" r="9" /><path d="M9.7 9a2.35 2.35 0 1 1 4 1.7c-.9.7-1.7 1-1.7 2.3M12 16h.01" /></>,
  layers: <><path d="m12 3 9 5-9 5-9-5 9-5Z" /><path d="m3 12 9 5 9-5M3 16l9 5 9-5" /></>,
  menu: <><path d="M4 6h16M4 12h16M4 18h16" /></>,
  message: <><path d="M20 11.5a7.5 7.5 0 0 1-8 7.5 8.7 8.7 0 0 1-3.7-.8L4 20l1.2-3.8A7.2 7.2 0 0 1 4 11.5 7.5 7.5 0 0 1 12 4a7.5 7.5 0 0 1 8 7.5Z" /><path d="M8 12h.01M12 12h.01M16 12h.01" /></>,
  moon: <path d="M20.5 15.2A8.5 8.5 0 0 1 8.8 3.5 8.5 8.5 0 1 0 20.5 15.2Z" />,
  "panel-left": <><rect x="3" y="4" width="18" height="16" rx="2" /><path d="M9 4v16M13 9h4M13 12h4M13 15h3" /></>,
  plus: <><path d="M12 5v14M5 12h14" /></>,
  search: <><circle cx="10.8" cy="10.8" r="6.8" /><path d="m16 16 5 5" /></>,
  settings: <><path d="M12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Z" /><path d="m19.4 15 .1.1a2 2 0 1 1-2.8 2.8l-.1-.1M4.6 9l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1M15 4.6l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1M9 19.4l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1M19.4 9l.1-.1a2 2 0 1 0-2.8-2.8l-.1.1M4.6 15l-.1.1a2 2 0 1 0 2.8 2.8l.1-.1M9 4.6l-.1-.1a2 2 0 1 0-2.8 2.8l.1.1M15 19.4l.1.1a2 2 0 1 0 2.8-2.8l-.1-.1" /></>,
  sparkles: <><path d="m12 3-1.2 4.8L6 9l4.8 1.2L12 15l1.2-4.8L18 9l-4.8-1.2L12 3ZM19 14l-.6 2.4L16 17l2.4.6L19 20l.6-2.4L22 17l-2.4-.6L19 14ZM5 14l-.5 2L2.5 16l2 .5L5 19l.5-2 2-.5-2-.5L5 14Z" /></>,
  sun: <><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" /></>,
  upload: <><path d="M12 16V4M8 8l4-4 4 4M4 15v4a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-4" /></>,
  wand: <><path d="m15 4 5 5M4 20l8.5-8.5M13 3l1 2 2 1-2 1-1 2-1-2-2-1 2-1 1-2ZM19 14l.7 1.3L21 16l-1.3.7L19 18l-.7-1.3L17 16l1.3-.7L19 14Z" /></>,
};

export function Icon({ name, size = 18, strokeWidth = 1.8, ...props }: IconProps) {
  return (
    <svg
      aria-hidden={props["aria-label"] ? undefined : true}
      focusable="false"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      {paths[name]}
    </svg>
  );
}
