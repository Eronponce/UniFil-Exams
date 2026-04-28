import { Nav } from "@/components/nav";
import { ToastProvider } from "@/components/toast-provider";
import { QueuePanel } from "@/components/queue-panel";
import styles from "../layout.module.css";

export default function AppLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <ToastProvider>
      <div className={styles.shell}>
        <Nav />
        <main className={styles.main}>{children}</main>
      </div>
      <QueuePanel />
    </ToastProvider>
  );
}
