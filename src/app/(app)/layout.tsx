import { Nav } from "@/components/nav";
import { ToastProvider } from "@/components/toast-provider";
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
      <CommandPalette />
    </ToastProvider>
  );
}
