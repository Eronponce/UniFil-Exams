"use server";

import { revalidatePath } from "next/cache";
import { createDiscipline, updateDiscipline, deleteDiscipline, getDisciplineByCode } from "@/lib/db/disciplines";
import { redirectWithToast } from "@/lib/toast";

export async function createDisciplineAction(formData: FormData) {
  const name = (formData.get("name") as string | null)?.trim() ?? "";
  const code = (formData.get("code") as string | null)?.trim() ?? "";
  if (!name || !code) {
    redirectWithToast("/disciplines/new?error=campos-obrigatorios", {
      type: "error",
      title: "Campos obrigatórios",
      description: "Informe nome e código da disciplina.",
    });
  }
  if (getDisciplineByCode(code)) {
    redirectWithToast("/disciplines/new?error=codigo-duplicado", {
      type: "error",
      title: "Código já cadastrado",
      description: `Já existe uma disciplina com o código ${code.toUpperCase()}.`,
    });
  }
  createDiscipline({ name, code });
  revalidatePath("/disciplines");
  revalidatePath("/");
  redirectWithToast("/disciplines", {
    type: "success",
    title: "Disciplina criada",
    description: `${name} foi adicionada ao banco.`,
  });
}

export async function updateDisciplineAction(formData: FormData) {
  const id = Number(formData.get("id"));
  const name = (formData.get("name") as string | null)?.trim() ?? "";
  const code = (formData.get("code") as string | null)?.trim() ?? "";
  if (!id || !name || !code) {
    redirectWithToast(`/disciplines/${id}/edit?error=campos-obrigatorios`, {
      type: "error",
      title: "Campos obrigatórios",
      description: "Revise os dados antes de salvar a disciplina.",
    });
  }
  const existing = getDisciplineByCode(code);
  if (existing && existing.id !== id) {
    redirectWithToast(`/disciplines/${id}/edit?error=codigo-duplicado`, {
      type: "error",
      title: "Código já cadastrado",
      description: `Já existe uma disciplina com o código ${code.toUpperCase()}.`,
    });
  }
  updateDiscipline(id, { name, code });
  revalidatePath("/disciplines");
  revalidatePath("/");
  redirectWithToast("/disciplines", {
    type: "success",
    title: "Disciplina atualizada",
    description: `${name} foi atualizada com sucesso.`,
  });
}

export async function deleteDisciplineAction(formData: FormData) {
  const id = Number(formData.get("id"));
  if (id) deleteDiscipline(id);
  revalidatePath("/disciplines");
  revalidatePath("/");
  redirectWithToast("/disciplines", {
    type: "success",
    title: "Disciplina removida",
    description: "A disciplina foi excluída do cadastro.",
  });
}
