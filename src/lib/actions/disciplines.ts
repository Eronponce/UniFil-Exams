"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createDiscipline, updateDiscipline, deleteDiscipline } from "@/lib/db/disciplines";

export async function createDisciplineAction(formData: FormData) {
  const name = (formData.get("name") as string | null)?.trim() ?? "";
  const code = (formData.get("code") as string | null)?.trim() ?? "";
  if (!name || !code) redirect("/disciplines/new?error=campos-obrigatorios");
  createDiscipline({ name, code });
  revalidatePath("/disciplines");
  revalidatePath("/");
  redirect("/disciplines");
}

export async function updateDisciplineAction(formData: FormData) {
  const id = Number(formData.get("id"));
  const name = (formData.get("name") as string | null)?.trim() ?? "";
  const code = (formData.get("code") as string | null)?.trim() ?? "";
  if (!id || !name || !code) redirect(`/disciplines/${id}/edit?error=campos-obrigatorios`);
  updateDiscipline(id, { name, code });
  revalidatePath("/disciplines");
  revalidatePath("/");
  redirect("/disciplines");
}

export async function deleteDisciplineAction(formData: FormData) {
  const id = Number(formData.get("id"));
  if (id) deleteDiscipline(id);
  revalidatePath("/disciplines");
  revalidatePath("/");
  redirect("/disciplines");
}
