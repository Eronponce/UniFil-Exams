"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { CommandTrigger } from "@/components/command-palette";
import { Icon, type IconName } from "@/components/icon";
import { useUiStore, type ThemePreference } from "@/lib/state/ui-store";
import styles from "./nav.module.css";

interface NavItem {
  href: string;
  label: string;
  icon: IconName;
  exact?: boolean;
  hint?: string;
}

interface NavGroup {
  label: string;
  items: NavItem[];
}

const groups: NavGroup[] = [
  {
    label: "Visão geral",
    items: [{ href: "/", label: "Visão geral", icon: "grid", exact: true, hint: "Centro de comando" }],
  },
  {
    label: "Conteúdo",
    items: [
      { href: "/disciplines", label: "Disciplinas", icon: "book-open", hint: "Componentes curriculares" },
      { href: "/questions", label: "Banco de questões", icon: "layers", hint: "Pesquisar e reutilizar" },
      { href: "/audit", label: "Auditoria", icon: "circle-check", hint: "Revisar pendências" },
    ],
  },
  {
    label: "Criar",
    items: [
      { href: "/questions/new", label: "Nova questão", icon: "file-plus", hint: "Criação manual" },
      { href: "/questions/importar", label: "Importar arquivo", icon: "upload", hint: "JSON ou CSV" },
      { href: "/ai", label: "Gerar com IA", icon: "sparkles", exact: true, hint: "Uma questão" },
      { href: "/ai/import", label: "Importar IA", icon: "wand", hint: "Geração em lote" },
    ],
  },
  {
    label: "Avaliações",
    items: [
      { href: "/exams", label: "Montagem", icon: "clipboard", hint: "Selecionar e randomizar" },
      { href: "/exports", label: "Exportações", icon: "file-text", hint: "PDF, CSV e ZIP" },
    ],
  },
  {
    label: "Sistema",
    items: [{ href: "/settings", label: "Configurações", icon: "settings", hint: "Provedores e preferências" }],
  },
];

function isActive(pathname: string, item: NavItem) {
  if (item.href === "/questions") {
    const isCreationRoute = pathname === "/questions/new" || pathname.startsWith("/questions/importar");
    return !isCreationRoute && (pathname === item.href || pathname.startsWith(`${item.href}/`));
  }
  return item.exact ? pathname === item.href : pathname === item.href || pathname.startsWith(`${item.href}/`);
}

function ThemeControl({ collapsed }: { collapsed: boolean }) {
  const { theme, setTheme } = useUiStore();
  return (
    <label className={`${styles.themeControl}${collapsed ? ` ${styles.themeControlCollapsed}` : ""}`} title="Tema da interface">
      <Icon name={theme === "dark" ? "moon" : theme === "light" ? "sun" : "activity"} size={16} />
      <span className={styles.themeLabel}>Tema</span>
      <select aria-label="Tema da interface" value={theme} onChange={(event) => setTheme(event.target.value as ThemePreference)}>
        <option value="system">Sistema</option>
        <option value="light">Claro</option>
        <option value="dark">Escuro</option>
      </select>
    </label>
  );
}

function NavigationContent({ pathname, collapsed, onNavigate }: { pathname: string; collapsed: boolean; onNavigate?: () => void }) {
  return (
    <nav className={styles.navigation} aria-label="Seções do aplicativo">
      {groups.map((group) => (
        <div className={styles.group} key={group.label}>
          <p className={styles.groupLabel}>{group.label}</p>
          <ul className={styles.list}>
            {group.items.map((item) => {
              const active = isActive(pathname, item);
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    onClick={onNavigate}
                    className={`${styles.link}${active ? ` ${styles.active}` : ""}`}
                    aria-current={active ? "page" : undefined}
                    title={collapsed ? `${item.label} · ${item.hint}` : undefined}
                  >
                    <span className={styles.linkIcon}><Icon name={item.icon} size={17} /></span>
                    <span className={styles.linkText}>{item.label}</span>
                    <span className={styles.linkHint}>{item.hint}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );
}

export function Nav() {
  const pathname = usePathname();
  const { theme, sidebarCollapsed, setSidebarCollapsed } = useUiStore();
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);
  useEffect(() => {
    document.body.classList.toggle("nav-drawer-open", mobileOpen);
    return () => document.body.classList.remove("nav-drawer-open");
  }, [mobileOpen]);

  return (
    <>
      <a href="#main-content" className={styles.skipLink}>Ir para o conteúdo principal</a>

      <header className={styles.mobileBar} aria-label="Barra de navegação móvel">
        <button type="button" className={styles.mobileMenuButton} aria-label={mobileOpen ? "Fechar menu" : "Abrir menu"} aria-expanded={mobileOpen} onClick={() => setMobileOpen((current) => !current)}>
          <Icon name={mobileOpen ? "close" : "menu"} size={21} />
        </button>
        <Link href="/" className={styles.mobileBrand} aria-label="UniFil Exams — visão geral" onClick={() => setMobileOpen(false)}>
          <span className={styles.brandMark}>U</span><span>UniFil <strong>Exams</strong></span>
        </Link>
        <CommandTrigger compact />
      </header>

      {mobileOpen && <button type="button" className={styles.overlay} aria-label="Fechar navegação" onClick={() => setMobileOpen(false)} />}

      <aside className={`${styles.sidebar}${sidebarCollapsed ? ` ${styles.collapsed}` : ""}${mobileOpen ? ` ${styles.mobileOpen}` : ""}`} aria-label="Navegação principal">
        <div className={styles.brandRow}>
          <Link href="/" className={styles.brand} aria-label="UniFil Exams — visão geral">
            <span className={styles.brandMark}>U</span>
            <span className={styles.brandCopy}><strong>UniFil</strong><span>Exams</span></span>
          </Link>
          <button type="button" className={styles.collapseButton} aria-label={sidebarCollapsed ? "Expandir menu lateral" : "Recolher menu lateral"} aria-pressed={sidebarCollapsed} title={sidebarCollapsed ? "Expandir menu lateral" : "Recolher menu lateral"} onClick={() => setSidebarCollapsed(!sidebarCollapsed)}>
            <Icon name="panel-left" size={18} />
          </button>
        </div>

        <div className={styles.workspaceTag}><span className={styles.workspaceDot} /> <span>Workspace do professor</span></div>
        <NavigationContent pathname={pathname} collapsed={sidebarCollapsed} onNavigate={() => setMobileOpen(false)} />

        <div className={styles.sidebarFooter}>
          <CommandTrigger />
          <ThemeControl collapsed={sidebarCollapsed} />
          <p className={styles.footerNote}>Local-first · dados no seu computador</p>
        </div>
      </aside>
    </>
  );
}
