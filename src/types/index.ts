export type ID = number;

export interface Discipline {
  id: ID;
  name: string;
  code: string;
  createdAt: string;
}

export interface Question {
  id: ID;
  disciplineId: ID;
  statement: string;
  imageUrl: string | null;
  options: QuestionOption[];
  correctIndex: number;
  difficulty: "easy" | "medium" | "hard";
  source: "manual" | "ai";
  audited: boolean;
  thematicArea: string | null;
  explanation: string;
  createdAt: string;
}

export interface QuestionOption {
  index: number;
  text: string;
}

export interface ExamSet {
  id: ID;
  examId: ID;
  label: string;
  evalBeeImageUrl: string | null;
  questions: ExamSetQuestion[];
  createdAt: string;
}

export interface ExamSetQuestion {
  questionId: ID;
  position: number;
  shuffledOptions: number[];
  correctShuffledIndex: number;
}

export interface Exam {
  id: ID;
  title: string;
  disciplineId: ID;
  institution: string;
  sets: ExamSet[];
  createdAt: string;
}
