import { describe, expect, it } from "vitest";
import { AnswerKeyUploadError, prepareAnswerKeyUpload } from "@/lib/uploads/answer-key";

function makeFile(name: string, type: string, bytes: Uint8Array): File {
  const arrayBuffer = Uint8Array.from(bytes).buffer;
  const file = new File([arrayBuffer], name, { type });
  Object.defineProperty(file, "arrayBuffer", {
    configurable: true,
    value: async () => arrayBuffer.slice(0),
  });
  return file;
}

describe("answer-key upload validation", () => {
  it("accepts real PNG and JPEG signatures", async () => {
    const png = makeFile("gabarito.png", "image/png", new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10, 0]));
    const jpeg = makeFile("gabarito.jpeg", "image/jpeg", new Uint8Array([255, 216, 255, 224, 0]));

    await expect(prepareAnswerKeyUpload(png)).resolves.toMatchObject({ extension: "png" });
    await expect(prepareAnswerKeyUpload(jpeg)).resolves.toMatchObject({ extension: "jpeg" });
  });

  it("rejects disguised or unsupported files", async () => {
    const disguised = makeFile("gabarito.png", "image/png", new TextEncoder().encode("não é imagem"));
    const unsupported = makeFile("gabarito.webp", "image/webp", new TextEncoder().encode("imagem"));

    await expect(prepareAnswerKeyUpload(disguised)).rejects.toBeInstanceOf(AnswerKeyUploadError);
    await expect(prepareAnswerKeyUpload(unsupported)).rejects.toThrow("Use PNG ou JPG");
  });
});
