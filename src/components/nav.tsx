"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import styles from "./nav.module.css";

const links = [
  { href: "/", label: "Dashboard", exact: true },
  { href: "/disciplines", label: "Disciplinas" },
  { href: "/questions", label: "Banco de Questões" },
  { href: "/questions/new", label: "Nova Questão" },
  { href: "/questions/importar", label: "Importar Questões" },
  { href: "/audit", label: "Auditoria" },
  { href: "/ai", label: "Geração IA", exact: true },
  { href: "/ai/import", label: "Importar IA" },
  { href: "/exams", label: "Montagem de Prova" },
  { href: "/exports", label: "Exportações" },
  { href: "/settings", label: "Configurações" },
];

export function Nav() {
  const pathname = usePathname();
  return (
    <nav className={styles.nav}>
      <div className={styles.brand}>UniFil Exams</div>
      <ul className={styles.list}>
        {links.map((l) => {
          const active = l.exact ? pathname === l.href : pathname === l.href || pathname.startsWith(l.href + "/");
          return (
            <li key={l.href}>
              <Link href={l.href} className={active ? `${styles.link} ${styles.active}` : styles.link}>
                {l.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
