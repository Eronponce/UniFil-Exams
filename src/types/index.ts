export type ID = number;

export type QuestionType = "objetiva" | "verdadeiro_falso" | "dissertativa" | "numerica";
export type QuestionLayout = "column" | "full";
export type ExamQuestionLayouts = Record<QuestionType, QuestionLayout>;

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
  rejected: boolean;
  thematicArea: string | null;
  explanation: string;
  questionType: QuestionType;
  answerLines: number;
  correctAnswer: string;
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
  instructions: string;
  active: boolean;
  answerKeyWidthPt: number;
  allowQuestionSplit: boolean;
  questionLayouts: ExamQuestionLayouts;
  /** Only explicit per-question overrides are stored. Missing keys inherit by type. */
  questionLayoutOverrides: Record<number, QuestionLayout>;
  /** Only explicit non-default (25..99) per-question image scales are stored. */
  questionImageScaleOverrides?: Record<number, number>;
  sets: ExamSet[];
  createdAt: string;
}
