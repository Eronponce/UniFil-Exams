import { Nav } from "@/components/nav";
import { ToastProvider } from "@/components/toast-provider";
import { QueuePanel } from "@/components/queue-panel";
import { IssueChatPanel } from "@/components/issue-chat-panel";
import styles from "../layout.module.css";

export default function AppLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <ToastProvider>
      <div className={styles.shell}>
        <Nav />
        <main className={styles.main}>{children}</main>
      </div>
      <div
        style={{
          position: "fixed",
          right: "1rem",
          bottom: "1rem",
          zIndex: 9999,
          width: "min(460px, calc(100vw - 2rem))",
          display: "flex",
          flexDirection: "column",
          alignItems: "flex-end",
          gap: "0.45rem",
          pointerEvents: "none",
        }}
      >
        <div style={{ pointerEvents: "auto" }}>
          <IssueChatPanel />
        </div>
        <div style={{ width: "100%", pointerEvents: "auto" }}>
          <QueuePanel />
        </div>
      </div>
    </ToastProvider>
  );
}
