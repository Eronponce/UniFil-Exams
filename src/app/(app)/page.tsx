export const dynamic = "force-dynamic";

import Link from "next/link";
import { Icon } from "@/components/icon";
import { EmptyState, ProgressDisplay, SectionCard, StatCard, WorkflowStepper } from "@/components/ui";
import { getDashboardStats } from "@/lib/db/stats";
import { listQuestionsFiltered } from "@/lib/db/questions-filter";
import { listExams } from "@/lib/db/exams";
import { truncateRichTextPlain } from "@/lib/html/rich-text";

function greeting() {
  const hour = new Date().getHours();
  if (hour < 12) return "Bom dia";
  if (hour < 18) return "Boa tarde";
  return "Boa noite";
}

function formatDate(value: string) {
  const normalized = value.includes("T") ? value : `${value.replace(" ", "T")}Z`;
  const parsed = new Date(normalized);
  if (Number.isNaN(parsed.valueOf())) return value;
  return new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short" }).format(parsed);
}

export default function Dashboard() {
  const stats = getDashboardStats();
  const pendingQuestions = listQuestionsFiltered({ audited: false, rejected: false }).slice(0, 5);
  const recentExams = listExams().slice(0, 3);
  const auditReady = stats.questionsTotal > 0 && stats.questionsDraft === 0;

  return (
    <>
      <section className="dashboard-hero" aria-labelledby="dashboard-welcome-title">
        <div className="dashboard-welcome">
          <p className="page-eyebrow">Workspace acadêmico · {new Intl.DateTimeFormat("pt-BR", { dateStyle: "long" }).format(new Date())}</p>
          <h1 id="dashboard-welcome-title">{greeting()}, professor.</h1>
          <p>Organize seu conteúdo, revise o que precisa de atenção e avance até a próxima avaliação com clareza.</p>
          <div className="actions-row" style={{ marginTop: "1.25rem" }}>
            <Link href="/questions/new" className="btn btn-primary"><Icon name="plus" size={16} /> Nova questão</Link>
            <Link href="/exams" className="btn btn-ghost" style={{ color: "#fff", borderColor: "rgba(255,255,255,.32)", background: "rgba(255,255,255,.1)" }}>Montar avaliação <Icon name="arrow-right" size={16} /></Link>
          </div>
        </div>
        <div className="dashboard-quick-actions" aria-label="Ações rápidas">
          <h2>Ações rápidas</h2>
          <Link href="/audit" className="quick-action-link"><Icon name="circle-check" size={17} /><span>Revisar pendências<small>{stats.questionsDraft} aguardando auditoria</small></span></Link>
          <Link href="/ai" className="quick-action-link"><Icon name="sparkles" size={17} /><span>Gerar com IA<small>Uma questão assistida</small></span></Link>
          <Link href="/questions/importar" className="quick-action-link"><Icon name="upload" size={17} /><span>Importar arquivo<small>JSON ou CSV</small></span></Link>
        </div>
      </section>

      <section className="stats-grid" aria-label="Indicadores do workspace">
        <StatCard label="Disciplinas ativas" value={stats.disciplines} meta="componentes cadastrados" icon="book-open" href="/disciplines" />
        <StatCard label="Questões no banco" value={stats.questionsTotal} meta={`${stats.questionsAudited} auditadas`} icon="layers" href="/questions" />
        <StatCard label="Aguardando revisão" value={stats.questionsDraft} meta={stats.questionsDraft ? "próxima ação recomendada" : "banco em dia"} icon="activity" tone="amber" href="/audit" />
        <StatCard label="Prontas para prova" value={stats.questionsAudited} meta={`${stats.auditRate}% do banco`} icon="circle-check" tone="teal" href="/exams" />
        <StatCard label="Avaliações criadas" value={stats.exams} meta="histórico de montagens" icon="clipboard" tone="violet" href="/exports" />
      </section>

      <div className="dashboard-grid">
        <SectionCard eyebrow="Revisar" title="Prontidão do banco" description="Acompanhe o que já pode entrar em uma avaliação e onde concentrar sua próxima revisão.">
          <div className="readiness-card">
            <div>
              <span className="readiness-value">{stats.auditRate}<small>% auditado</small></span>
              <ProgressDisplay label="Cobertura auditada" value={stats.questionsAudited} max={Math.max(stats.questionsTotal, 1)} valueLabel={`${stats.questionsAudited} de ${stats.questionsTotal}`} tone="teal" />
            </div>
            {stats.disciplineReadiness.length === 0 ? (
              <EmptyState title="Comece por uma disciplina" description="Cadastre o primeiro componente curricular para liberar o fluxo de questões." action={<Link href="/disciplines/new" className="btn btn-primary">Nova disciplina</Link>} icon="book-open" />
            ) : (
              <div className="responsive-stack">
                <div className="section-heading" style={{ margin: ".15rem 0 0" }}><div><h2>Por disciplina</h2><p>Itens com maior atenção aparecem primeiro.</p></div></div>
                {stats.disciplineReadiness.map((discipline) => (
                  <Link href={`/questions?discipline=${discipline.id}`} key={discipline.id} className="discipline-progress-row">
                    <span className="discipline-progress-copy"><strong>{discipline.name}</strong><small>{discipline.code} · {discipline.audited} de {discipline.total} auditadas</small></span>
                    <span className="discipline-progress-bar"><span style={{ width: `${discipline.total ? (discipline.audited / discipline.total) * 100 : 0}%` }} /></span>
                    <Icon name="chevron-right" size={15} />
                  </Link>
                ))}
              </div>
            )}
            {stats.questionsTotal > 0 && (
              <div className={`callout ${auditReady ? "callout-success" : "callout-warning"}`}>
                <Icon name={auditReady ? "circle-check" : "activity"} size={17} />
                <span>{auditReady ? "Seu banco está pronto para a montagem de uma nova avaliação." : `Ainda há ${stats.questionsDraft} questão(ões) para revisar antes de fechar a prova.`}</span>
              </div>
            )}
          </div>
        </SectionCard>

        <SectionCard eyebrow="Fluxo de trabalho" title="Continue de onde parou" description="Atalhos para organizar, revisar, criar e entregar.">
          <WorkflowStepper steps={[
            { label: "Organizar", description: "Disciplinas e banco de questões", href: "/questions", active: stats.questionsTotal === 0, complete: stats.questionsTotal > 0 },
            { label: "Revisar", description: `${stats.questionsDraft} pendente(s) de auditoria`, href: "/audit", active: stats.questionsDraft > 0, complete: stats.questionsDraft === 0 && stats.questionsTotal > 0 },
            { label: "Criar", description: "Manual, IA ou importação", href: "/questions/new", active: false },
            { label: "Entregar", description: "Montar e exportar a avaliação", href: stats.exams ? "/exports" : "/exams", active: stats.exams > 0 },
          ]} />
          <div className="callout callout-info" style={{ marginTop: "1rem" }}><Icon name="command" size={16} /><span>Use <strong>Ctrl/Cmd + K</strong> para navegar sem tirar as mãos do teclado.</span></div>
        </SectionCard>
      </div>

      <div className="dashboard-grid" style={{ marginTop: "1rem" }}>
        <SectionCard eyebrow="Atenção" title="Itens que pedem uma decisão" description="Questões novas aparecem aqui até serem auditadas.">
          {pendingQuestions.length === 0 ? (
            <EmptyState title="Tudo em dia por aqui" description="Quando uma questão precisar de revisão, ela aparecerá nesta lista." action={<Link href="/questions/new" className="btn btn-ghost">Criar questão</Link>} icon="circle-check" />
          ) : (
            <div className="table-wrap">
              <table className="table"><thead><tr><th>Enunciado</th><th>Origem</th><th>Próxima ação</th></tr></thead><tbody>
                {pendingQuestions.map((question) => <tr key={question.id}><td><Link href={`/questions/${question.id}`}>{truncateRichTextPlain(question.statement, 105)}</Link></td><td><span className={`badge ${question.source === "ai" ? "badge-ai" : ""}`}>{question.source === "ai" ? "IA" : "Manual"}</span></td><td><Link href={`/questions/${question.id}`} className="btn btn-sm btn-ghost">Auditar <Icon name="arrow-right" size={14} /></Link></td></tr>)}
              </tbody></table>
            </div>
          )}
          {stats.questionsDraft > 5 && <div style={{ marginTop: ".75rem" }}><Link href="/audit" className="btn btn-ghost btn-sm">Ver todas ({stats.questionsDraft})</Link></div>}
        </SectionCard>

        <SectionCard eyebrow="Entregar" title="Avaliações recentes" description="Retome uma montagem ou abra os arquivos finais.">
          {recentExams.length === 0 ? (
            <EmptyState title="Nenhuma avaliação ainda" description="Monte a primeira prova quando o banco estiver pronto." action={<Link href="/exams" className="btn btn-primary">Montar avaliação</Link>} icon="clipboard" />
          ) : (
            <div className="responsive-stack">
              {recentExams.map((exam) => <Link href={`/exports?exam=${exam.id}`} className="recent-exam-row" key={exam.id}><span className="recent-exam-icon"><Icon name="file-text" size={16} /></span><span><strong>{exam.title}</strong><small>{exam.sets.length} set(s) · {formatDate(exam.createdAt)}</small></span><Icon name="chevron-right" size={15} /></Link>)}
              <Link href="/exports" className="btn btn-ghost btn-sm" style={{ marginTop: ".25rem" }}>Abrir exportações <Icon name="arrow-right" size={14} /></Link>
            </div>
          )}
        </SectionCard>
      </div>
    </>
  );
}
