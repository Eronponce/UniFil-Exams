import { getDb } from "./client";
import { migrate } from "./schema";
import { createDiscipline } from "./disciplines";
import { createQuestion } from "./questions";
import { createExam, createExamSet } from "./exams";

export function seed(): void {
  migrate();

  const db = getDb();
  const exists = db.prepare("SELECT COUNT(*) as n FROM disciplines").get() as { n: number };
  if (exists.n > 0) return;

  const disc = createDiscipline({ name: "Algoritmos e Programação", code: "ALP" });

  const q1 = createQuestion({
    disciplineId: disc.id,
    statement: "Qual estrutura de dados opera em modo FIFO (First In, First Out)?",
    options: ["Pilha", "Fila", "Árvore", "Grafo", "Heap"],
    correctIndex: 1,
    difficulty: "easy",
  });

  const q2 = createQuestion({
    disciplineId: disc.id,
    statement: "Qual é a complexidade de tempo do algoritmo Bubble Sort no pior caso?",
    options: ["O(n)", "O(n log n)", "O(n²)", "O(log n)", "O(1)"],
    correctIndex: 2,
    difficulty: "medium",
  });

  const q3 = createQuestion({
    disciplineId: disc.id,
    statement: "Em Python, qual palavra-chave define uma função?",
    options: ["function", "def", "fn", "func", "define"],
    correctIndex: 1,
    difficulty: "easy",
  });

  const q4 = createQuestion({
    disciplineId: disc.id,
    statement: "Qual estrutura de dados usa ponteiro para pai, filho esquerdo e filho direito?",
    options: ["Array", "Lista ligada", "Fila", "Árvore binária", "Tabela hash"],
    correctIndex: 3,
    difficulty: "medium",
  });

  const q5 = createQuestion({
    disciplineId: disc.id,
    statement: "O algoritmo Quick Sort é classificado como:",
    options: ["Ordenação por inserção", "Ordenação por seleção", "Dividir e conquistar", "Força bruta", "Programação dinâmica"],
    correctIndex: 2,
    difficulty: "hard",
  });

  const questionIds = [q1.id, q2.id, q3.id, q4.id, q5.id];
  const exam = createExam({ disciplineId: disc.id, title: "Prova 1 — ALP", questionIds });

  // Set A: questions in natural order, options shuffled deterministically
  createExamSet(exam.id, {
    label: "A",
    questionOrder: questionIds,
    shuffledOptions: [
      [1, 0, 2, 3, 4],
      [2, 0, 1, 3, 4],
      [1, 2, 0, 3, 4],
      [3, 0, 1, 2, 4],
      [2, 1, 0, 3, 4],
    ],
    correctShuffledIndices: [0, 0, 0, 0, 0],
  });
}
