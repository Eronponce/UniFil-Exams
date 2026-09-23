"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
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

interface NavEntry {
  key: string;
  label: string;
  icon: IconName;
  href?: string;
  exact?: boolean;
  items?: NavItem[];
}

const entries: NavEntry[] = [
  { key: "home", label: "Início", icon: "grid", href: "/", exact: true },
  {
    key: "questions",
    label: "Questões",
    icon: "layers",
    items: [
      { href: "/questions", label: "Banco de questões", icon: "layers", hint: "Pesquisar e reutilizar" },
      { href: "/questions/new", label: "Nova questão", icon: "file-plus", hint: "Criação manual" },
      { href: "/questions/importar", label: "Importar arquivo", icon: "upload", hint: "JSON ou CSV" },
      { href: "/ai", label: "Gerar com IA", icon: "sparkles", exact: true, hint: "Uma questão assistida" },
      { href: "/ai/import", label: "Importar IA", icon: "wand", hint: "Geração em lote" },
      { href: "/disciplines", label: "Disciplinas", icon: "book-open", hint: "Componentes curriculares" },
    ],
  },
  { key: "audit", label: "Auditoria", icon: "circle-check", href: "/audit" },
  {
    key: "exams",
    label: "Provas",
    icon: "clipboard",
    items: [
      { href: "/exams", label: "Montar prova", icon: "clipboard", hint: "Selecionar questões e gerar sets" },
      { href: "/exports", label: "Provas criadas", icon: "file-text", hint: "Editar, PDF, CSV e ZIP" },
    ],
  },
];

const THEME_ORDER: ThemePreference[] = ["system", "light", "dark"];
const THEME_LABEL: Record<ThemePreference, string> = { system: "Sistema", light: "Claro", dark: "Escuro" };
const THEME_ICON: Record<ThemePreference, IconName> = { system: "activity", light: "sun", dark: "moon" };

function isActive(pathname: string, item: { href: string; exact?: boolean }) {
  if (item.href === "/questions") {
    const isCreationRoute = pathname === "/questions/new" || pathname.startsWith("/questions/importar");
    return !isCreationRoute && (pathname === item.href || pathname.startsWith(`${item.href}/`));
  }
  return item.exact ? pathname === item.href : pathname === item.href || pathname.startsWith(`${item.href}/`);
}

function isEntryActive(pathname: string, entry: NavEntry) {
  if (entry.items) return entry.items.some((item) => isActive(pathname, item));
  return entry.href ? isActive(pathname, { href: entry.href, exact: entry.exact }) : false;
}

function ThemeToggle() {
  const { theme, setTheme } = useUiStore();
  const next = THEME_ORDER[(THEME_ORDER.indexOf(theme) + 1) % THEME_ORDER.length];
  return (
    <button
      type="button"
      className={styles.iconButton}
      onClick={() => setTheme(next)}
      aria-label={`Tema: ${THEME_LABEL[theme]}. Alternar para ${THEME_LABEL[next]}`}
      title={`Tema: ${THEME_LABEL[theme]}`}
    >
      <Icon name={THEME_ICON[theme]} size={17} />
    </button>
  );
}

function MobileNavigation({ pathname, onNavigate }: { pathname: string; onNavigate: () => void }) {
  return (
    <nav className={styles.drawerNav} aria-label="Seções do aplicativo">
      {entries.map((entry) => entry.items ? (
        <div className={styles.drawerGroup} key={entry.key}>
          <p className={styles.drawerGroupLabel}>{entry.label}</p>
          <ul className={styles.drawerList}>
            {entry.items.map((item) => {
              const active = isActive(pathname, item);
              return (
                <li key={item.href}>
                  <Link href={item.href} onClick={onNavigate} className={`${styles.drawerLink}${active ? ` ${styles.drawerLinkActive}` : ""}`} aria-current={active ? "page" : undefined}>
                    <Icon name={item.icon} size={17} />
                    <span>{item.label}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ) : (
        <Link
          key={entry.key}
          href={entry.href ?? "/"}
          onClick={onNavigate}
          className={`${styles.drawerLink}${isEntryActive(pathname, entry) ? ` ${styles.drawerLinkActive}` : ""}`}
          aria-current={isEntryActive(pathname, entry) ? "page" : undefined}
        >
          <Icon name={entry.icon} size={17} />
          <span>{entry.label}</span>
        </Link>
      ))}
      <Link
        href="/settings"
        onClick={onNavigate}
        className={`${styles.drawerLink}${isActive(pathname, { href: "/settings" }) ? ` ${styles.drawerLinkActive}` : ""}`}
        aria-current={isActive(pathname, { href: "/settings" }) ? "page" : undefined}
      >
        <Icon name="settings" size={17} />
        <span>Configurações</span>
      </Link>
    </nav>
  );
}

export function Nav() {
  const pathname = usePathname();
  const theme = useUiStore((state) => state.theme);
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const [mobileOpen, setMobileOpen] = useState(false);
  const menuRef = useRef<HTMLUListElement | null>(null);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);
  useEffect(() => {
    document.body.classList.toggle("nav-drawer-open", mobileOpen);
    return () => document.body.classList.remove("nav-drawer-open");
  }, [mobileOpen]);
  useEffect(() => {
    if (!openMenu && !mobileOpen) return;
    const closeOnOutside = (event: PointerEvent) => {
      if (openMenu && menuRef.current && !menuRef.current.contains(event.target as Node)) setOpenMenu(null);
    };
    const closeOnEscape = (event: globalThis.KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setOpenMenu(null);
      setMobileOpen(false);
    };
    document.addEventListener("pointerdown", closeOnOutside);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOnOutside);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [mobileOpen, openMenu]);

  const closeAll = () => {
    setOpenMenu(null);
    setMobileOpen(false);
  };

  return (
    <>
      <a href="#main-content" className={styles.skipLink}>Ir para o conteúdo principal</a>

      <header className={styles.topbar} aria-label="Navegação principal">
        <div className={styles.inner}>
          <button type="button" className={`${styles.iconButton} ${styles.menuButton}`} aria-label={mobileOpen ? "Fechar menu" : "Abrir menu"} aria-expanded={mobileOpen} onClick={() => setMobileOpen((current) => !current)}>
            <Icon name={mobileOpen ? "close" : "menu"} size={20} />
          </button>

          <Link href="/" className={styles.brand} aria-label="UniFil Exams — início" onClick={closeAll}>
            <span className={styles.brandMark}>U</span>
            <span className={styles.brandCopy}><strong>UniFil</strong> Exams</span>
          </Link>

          <nav className={styles.primary} aria-label="Seções do aplicativo">
            <ul className={styles.menu} ref={menuRef}>
              {entries.map((entry) => {
                const active = isEntryActive(pathname, entry);
                if (!entry.items) {
                  return (
                    <li key={entry.key}>
                      <Link href={entry.href ?? "/"} onClick={closeAll} className={`${styles.link}${active ? ` ${styles.active}` : ""}`} aria-current={active ? "page" : undefined}>
                        {entry.label}
                      </Link>
                    </li>
                  );
                }
                const open = openMenu === entry.key;
                const panelId = `nav-menu-${entry.key}`;
                return (
                  <li key={entry.key} className={styles.dropdown}>
                    <button
                      type="button"
                      className={`${styles.link}${active ? ` ${styles.active}` : ""}`}
                      aria-expanded={open}
                      aria-controls={panelId}
                      onClick={() => setOpenMenu(open ? null : entry.key)}
                    >
                      {entry.label}
                      <Icon name="chevron-down" size={14} className={open ? `${styles.chevron} ${styles.chevronOpen}` : styles.chevron} />
                    </button>
                    {open && (
                      <div id={panelId} className={styles.panel}>
                        <ul>
                          {entry.items.map((item) => {
                            const itemActive = isActive(pathname, item);
                            return (
                              <li key={item.href}>
                                <Link href={item.href} onClick={closeAll} className={`${styles.panelLink}${itemActive ? ` ${styles.panelLinkActive}` : ""}`} aria-current={itemActive ? "page" : undefined}>
                                  <span className={styles.panelIcon}><Icon name={item.icon} size={17} /></span>
                                  <span className={styles.panelCopy}><strong>{item.label}</strong><small>{item.hint}</small></span>
                                </Link>
                              </li>
                            );
                          })}
                        </ul>
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          </nav>

          <div className={styles.actions}>
            <CommandTrigger />
            <ThemeToggle />
            <Link href="/settings" className={`${styles.iconButton}${isActive(pathname, { href: "/settings" }) ? ` ${styles.iconButtonActive}` : ""}`} aria-label="Configurações" title="Configurações" onClick={closeAll}>
              <Icon name="settings" size={17} />
            </Link>
          </div>
        </div>
      </header>

      {mobileOpen && (
        <>
          <button type="button" className={styles.overlay} aria-label="Fechar navegação" onClick={() => setMobileOpen(false)} />
          <aside className={styles.drawer} aria-label="Menu">
            <MobileNavigation pathname={pathname} onNavigate={closeAll} />
          </aside>
        </>
      )}
    </>
  );
}
