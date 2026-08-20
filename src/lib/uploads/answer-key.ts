import fs from "fs";
import path from "path";

export const ANSWER_KEY_EXTENSIONS = ["png", "jpg", "jpeg"] as const;
// Keep multipart submissions below the configured 10 MB Server Action limit.
export const ANSWER_KEY_MAX_FILE_SIZE = 9 * 1024 * 1024;

export interface PreparedAnswerKeyUpload {
  extension: (typeof ANSWER_KEY_EXTENSIONS)[number];
  bytes: Buffer;
}

export class AnswerKeyUploadError extends Error {}

export function getAnswerKeyDirectory(): string {
  return path.join(process.cwd(), "public", "gabaritos");
}

function hasPngSignature(bytes: Buffer): boolean {
  return bytes.length >= 8 && bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
}

function hasJpegSignature(bytes: Buffer): boolean {
  return bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
}

export async function prepareAnswerKeyUpload(value: FormDataEntryValue | null): Promise<PreparedAnswerKeyUpload | null> {
  if (!(value instanceof File) || value.size === 0) return null;
  if (value.size > ANSWER_KEY_MAX_FILE_SIZE) {
    throw new AnswerKeyUploadError("O gabarito deve ter no máximo 9 MB.");
  }

  const extension = (value.name.split(".").pop() ?? "").toLowerCase();
  if (!ANSWER_KEY_EXTENSIONS.includes(extension as PreparedAnswerKeyUpload["extension"])) {
    throw new AnswerKeyUploadError("Formato inválido. Use PNG ou JPG.");
  }

  const bytes = Buffer.from(await value.arrayBuffer());
  const validSignature = extension === "png" ? hasPngSignature(bytes) : hasJpegSignature(bytes);
  if (!validSignature) {
    throw new AnswerKeyUploadError("O arquivo não contém uma imagem PNG ou JPG válida.");
  }

  return { extension: extension as PreparedAnswerKeyUpload["extension"], bytes };
}

export function removeAnswerKeyFiles(examId: number): void {
  const directory = getAnswerKeyDirectory();
  for (const extension of ANSWER_KEY_EXTENSIONS) {
    const filePath = path.join(directory, `${examId}.${extension}`);
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
  }
}

export function storeAnswerKeyUpload(examId: number, upload: PreparedAnswerKeyUpload): void {
  const directory = getAnswerKeyDirectory();
  fs.mkdirSync(directory, { recursive: true });
  const temporaryPath = path.join(directory, `.${examId}-${Date.now()}.${upload.extension}.tmp`);

  try {
    fs.writeFileSync(temporaryPath, upload.bytes);
    removeAnswerKeyFiles(examId);
    fs.renameSync(temporaryPath, path.join(directory, `${examId}.${upload.extension}`));
  } finally {
    if (fs.existsSync(temporaryPath)) fs.unlinkSync(temporaryPath);
  }
}
