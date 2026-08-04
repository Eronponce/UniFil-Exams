"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Icon, type IconName } from "@/components/icon";

const OPEN_EVENT = "unifil:open-command-palette";

interface CommandItem {
  label: string;
  description: string;
  href: string;
  group: string;
  icon: IconName;
  keywords?: string;
}

const COMMANDS: CommandItem[] = [
  { label: "Visão geral", description: "Voltar ao centro de comando", href: "/", group: "Visão geral", icon: "grid", keywords: "dashboard início" },
  { label: "Disciplinas", description: "Organizar componentes curriculares", href: "/disciplines", group: "Conteúdo", icon: "book-open", keywords: "matérias" },
  { label: "Banco de questões", description: "Pesquisar e editar questões", href: "/questions", group: "Conteúdo", icon: "layers", keywords: "perguntas busca" },
  { label: "Auditoria", description: "Revisar questões pendentes", href: "/audit", group: "Conteúdo", icon: "circle-check", keywords: "revisão validar" },
  { label: "Nova questão", description: "Criar manualmente", href: "/questions/new", group: "Criar", icon: "file-plus", keywords: "manual" },
  { label: "Importar arquivo", description: "Trazer questões de JSON ou CSV", href: "/questions/importar", group: "Criar", icon: "upload", keywords: "csv json" },
  { label: "Gerar com IA", description: "Criar uma questão assistida", href: "/ai", group: "Criar", icon: "sparkles", keywords: "inteligência artificial" },
  { label: "Importar IA", description: "Gerar um lote a partir de tópicos", href: "/ai/import", group: "Criar", icon: "wand", keywords: "lote batch" },
  { label: "Montagem de prova", description: "Selecionar e randomizar conjuntos", href: "/exams", group: "Avaliações", icon: "clipboard", keywords: "exame avaliação" },
  { label: "Exportações", description: "Abrir PDF, CSV e ZIP", href: "/exports", group: "Avaliações", icon: "file-text", keywords: "download gabarito" },
  { label: "Configurações", description: "Provedores, arquivos e preferências", href: "/settings", group: "Sistema", icon: "settings", keywords: "preferências" },
];

export function openCommandPalette() {
  if (typeof window !== "undefined") window.dispatchEvent(new Event(OPEN_EVENT));
}

export function CommandTrigger({ compact = false }: { compact?: boolean }) {
  return (
    <button type="button" className={`command-trigger${compact ? " command-trigger-compact" : ""}`} onClick={openCommandPalette} aria-label="Abrir busca rápida">
      <Icon name="search" size={compact ? 18 : 16} />
      <span className="command-trigger-label">Buscar no workspace</span>
      <kbd><span className="command-trigger-modifier">⌘/Ctrl</span> K</kbd>
    </button>
  );
}

export function CommandPalette() {
  const router = useRouter();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const results = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase("pt-BR");
    if (!normalized) return COMMANDS;
    return COMMANDS.filter((item) => `${item.label} ${item.description} ${item.group} ${item.keywords ?? ""}`.toLocaleLowerCase("pt-BR").includes(normalized));
  }, [query]);

  useEffect(() => {
    function handleOpen() {
      setOpen(true);
      setQuery("");
      setActiveIndex(0);
    }
    function handleKeyDown(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        if (open) {
          setOpen(false);
        } else {
          handleOpen();
        }
        return;
      }
      if (event.key === "Escape" && open) {
        event.preventDefault();
        setOpen(false);
      }
    }
    window.addEventListener(OPEN_EVENT, handleOpen);
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener(OPEN_EVENT, handleOpen);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  useEffect(() => {
    if (open) requestAnimationFrame(() => inputRef.current?.focus());
  }, [open]);

  function close() {
    setOpen(false);
    setQuery("");
  }

  function navigate(item: CommandItem | undefined) {
    if (!item) return;
    close();
    if (item.href !== pathname) router.push(item.href);
  }

  function handleInputKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveIndex((current) => Math.min(current + 1, Math.max(results.length - 1, 0)));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex((current) => Math.max(current - 1, 0));
    } else if (event.key === "Enter") {
      event.preventDefault();
      navigate(results[Math.min(activeIndex, Math.max(results.length - 1, 0))]);
    }
  }

  if (!open) return null;

  let previousGroup = "";
  return (
    <div className="command-palette-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) close(); }}>
      <section className="command-palette" role="dialog" aria-modal="true" aria-labelledby="command-palette-title">
        <div className="command-palette-search">
          <Icon name="search" size={19} />
          <input
            ref={inputRef}
            value={query}
            onChange={(event) => { setQuery(event.target.value); setActiveIndex(0); }}
            onKeyDown={handleInputKeyDown}
            placeholder="O que você precisa fazer?"
            aria-label="Pesquisar destinos e ações"
            autoComplete="off"
          />
          <kbd>Esc</kbd>
        </div>
        <div className="command-palette-heading"><span id="command-palette-title">Atalhos do workspace</span><small>↑ ↓ navegar · Enter abrir</small></div>
        <div className="command-palette-results" role="listbox" aria-label="Resultados da busca">
          {results.length === 0 ? (
            <div className="command-palette-empty"><Icon name="search" size={20} /><p>Nenhum destino encontrado.</p><small>Tente outro termo, como “auditoria” ou “PDF”.</small></div>
          ) : results.map((item, index) => {
            const showGroup = item.group !== previousGroup;
            previousGroup = item.group;
            return (
              <div key={item.href}>
                {showGroup && <p className="command-group-label">{item.group}</p>}
                <button
                  type="button"
                  role="option"
                  aria-selected={activeIndex === index}
                  className={`command-item${activeIndex === index ? " is-active" : ""}`}
                  onMouseEnter={() => setActiveIndex(index)}
                  onClick={() => navigate(item)}
                >
                  <span className="command-item-icon"><Icon name={item.icon} size={17} /></span>
                  <span className="command-item-copy"><strong>{item.label}</strong><small>{item.description}</small></span>
                  <Icon name="chevron-right" size={16} className="command-item-arrow" />
                </button>
              </div>
            );
          })}
        </div>
        <div className="command-palette-footer"><span><Icon name="sparkles" size={14} /> Ações seguras de navegação e criação</span><button type="button" onClick={close} className="btn btn-ghost btn-sm">Fechar</button></div>
      </section>
    </div>
  );
}
