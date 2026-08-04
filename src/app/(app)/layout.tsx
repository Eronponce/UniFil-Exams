import { Nav } from "@/components/nav";
import { ToastProvider } from "@/components/toast-provider";
import { QueuePanel } from "@/components/queue-panel";
import { IssueChatPanel } from "@/components/issue-chat-panel";
import { CommandPalette } from "@/components/command-palette";
import styles from "../layout.module.css";

export default function AppLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <ToastProvider>
      <div className={styles.shell}>
        <Nav />
        <div className={styles.mainFrame}>
          <main id="main-content" className={styles.main}>{children}</main>
        </div>
      </div>
      <div className={styles.activityDock} aria-label="Atividade do workspace">
        <div className={styles.activityDockItem}>
          <IssueChatPanel />
        </div>
        <div className={styles.activityDockItemWide}>
          <QueuePanel />
        </div>
      </div>
      <CommandPalette />
    </ToastProvider>
  );
}
