"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { QuestionType } from "@/types";

export interface SingleAiDraft {
  disciplineId: string;
  provider: string;
  questionType: QuestionType;
  ollamaModel: string;
  topic: string;
  queuedTaskId: string | null;
}

export interface BatchAiDraft {
  disciplineId: string;
  provider: string;
  questionType: QuestionType;
  ollamaModel: string;
  rawText: string;
  queuedTaskId: string | null;
}

export interface ExamDraft {
  title: string;
  institution: string;
  quantitySets: string;
  numObjetivas: string;
  numVF: string;
  numDissertativas: string;
}

export interface QuestionDraft {
  disciplineId: string;
  difficulty: "easy" | "medium" | "hard";
  questionType: QuestionType;
  statement: string;
  options: string[];
  correctIndex: string;
  thematicArea: string;
  explanation: string;
  answerLines: string;
}

interface WorkspaceState {
  singleAi: SingleAiDraft;
  batchAi: BatchAiDraft;
  exam: ExamDraft;
  questionDrafts: Record<string, QuestionDraft>;
  updateSingleAi: (patch: Partial<SingleAiDraft>) => void;
  resetSingleAi: (disciplineId?: string) => void;
  updateBatchAi: (patch: Partial<BatchAiDraft>) => void;
  resetBatchAi: (disciplineId?: string) => void;
  updateExam: (patch: Partial<ExamDraft>) => void;
  resetExam: () => void;
  updateQuestionDraft: (key: string, patch: Partial<QuestionDraft>) => void;
  resetQuestionDraft: (key: string) => void;
}

export const DEFAULT_INSTITUTION = "UniFil - Centro Universitário Filadélfia";

export function makeSingleAiDraft(disciplineId = ""): SingleAiDraft {
  return {
    disciplineId,
    provider: "ollama",
    questionType: "objetiva",
    ollamaModel: "",
    topic: "",
    queuedTaskId: null,
  };
}

export function makeBatchAiDraft(disciplineId = ""): BatchAiDraft {
  return {
    disciplineId,
    provider: "ollama",
    questionType: "objetiva",
    ollamaModel: "",
    rawText: "",
    queuedTaskId: null,
  };
}

export function makeExamDraft(): ExamDraft {
  return {
    title: "",
    institution: DEFAULT_INSTITUTION,
    quantitySets: "2",
    numObjetivas: "",
    numVF: "",
    numDissertativas: "",
  };
}

export function makeQuestionDraft(disciplineId = ""): QuestionDraft {
  return {
    disciplineId,
    difficulty: "medium",
    questionType: "objetiva",
    statement: "",
    options: ["", "", "", "", ""],
    correctIndex: "0",
    thematicArea: "",
    explanation: "",
    answerLines: "5",
  };
}

export const useWorkspaceStore = create<WorkspaceState>()(
  persist(
    (set) => ({
      singleAi: makeSingleAiDraft(),
      batchAi: makeBatchAiDraft(),
      exam: makeExamDraft(),
      questionDrafts: {},
      updateSingleAi: (patch) => set((state) => ({ singleAi: { ...state.singleAi, ...patch } })),
      resetSingleAi: (disciplineId) => set({ singleAi: makeSingleAiDraft(disciplineId) }),
      updateBatchAi: (patch) => set((state) => ({ batchAi: { ...state.batchAi, ...patch } })),
      resetBatchAi: (disciplineId) => set({ batchAi: makeBatchAiDraft(disciplineId) }),
      updateExam: (patch) => set((state) => ({ exam: { ...state.exam, ...patch } })),
      resetExam: () => set({ exam: makeExamDraft() }),
      updateQuestionDraft: (key, patch) => set((state) => ({
        questionDrafts: {
          ...state.questionDrafts,
          [key]: { ...(state.questionDrafts[key] ?? makeQuestionDraft()), ...patch },
        },
      })),
      resetQuestionDraft: (key) => set((state) => {
        const next = { ...state.questionDrafts };
        delete next[key];
        return { questionDrafts: next };
      }),
    }),
    {
      name: "unifil-workspace-state",
      version: 1,
      partialize: (state) => ({
        singleAi: state.singleAi,
        batchAi: state.batchAi,
        exam: state.exam,
        questionDrafts: state.questionDrafts,
      }),
    },
  ),
);
