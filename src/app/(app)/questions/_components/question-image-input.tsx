"use client";

import Image from "next/image";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

interface Props {
  hasCurrentImage?: boolean;
}

function imageExtension(mimeType: string): string {
  if (mimeType === "image/jpeg") return "jpg";
  return mimeType.slice("image/".length).replace("+xml", "") || "png";
}

function normalizeClipboardImage(file: File): File {
  if (file.name && /\.[a-z0-9]+$/i.test(file.name)) return file;

  return new File(
    [file],
    `imagem-colada-${Date.now()}.${imageExtension(file.type)}`,
    { type: file.type, lastModified: Date.now() },
  );
}

export function getClipboardImage(clipboardData: DataTransfer): File | null {
  for (const item of Array.from(clipboardData.items)) {
    if (item.kind === "file" && item.type.startsWith("image/")) {
      return item.getAsFile();
    }
  }

  return Array.from(clipboardData.files).find((file) => file.type.startsWith("image/")) ?? null;
}

export function QuestionImageInput({ hasCurrentImage = false }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [attachmentMessage, setAttachmentMessage] = useState("");
  const previewUrl = useMemo(
    () => selectedImage ? URL.createObjectURL(selectedImage) : null,
    [selectedImage],
  );

  useEffect(() => () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
  }, [previewUrl]);

  const attachPastedImage = useCallback((file: File) => {
    const input = inputRef.current;
    if (!input) return;

    const normalizedFile = normalizeClipboardImage(file);
    const transfer = new DataTransfer();
    transfer.items.add(normalizedFile);
    input.files = transfer.files;
    setSelectedImage(normalizedFile);
    setAttachmentMessage(`Imagem ${normalizedFile.name} anexada pelo Ctrl+V.`);
  }, []);

  useEffect(() => {
    function handlePaste(event: ClipboardEvent) {
      if (!event.clipboardData) return;
      const image = getClipboardImage(event.clipboardData);
      if (!image) return;

      event.preventDefault();
      attachPastedImage(image);
    }

    window.addEventListener("paste", handlePaste);
    return () => window.removeEventListener("paste", handlePaste);
  }, [attachPastedImage]);

  return (
    <div className="form-group">
      <label className="form-label" htmlFor="image">
        {hasCurrentImage ? "Substituir imagem" : "Imagem (opcional)"}
      </label>
      <p className="question-image-paste-hint">
        Escolha um arquivo ou copie uma imagem e pressione Ctrl+V em qualquer ponto desta tela.
      </p>
      <input
        ref={inputRef}
        id="image"
        name="image"
        type="file"
        accept="image/*"
        className="form-input"
        style={{ padding: "0.4rem" }}
        onChange={(event) => {
          const file = event.currentTarget.files?.[0] ?? null;
          setSelectedImage(file);
          setAttachmentMessage(file ? `Imagem ${file.name} anexada.` : "");
        }}
      />
      <p className="question-image-attachment-status" role="status" aria-live="polite">
        {attachmentMessage}
      </p>
      {previewUrl && selectedImage && (
        <div className="question-image-paste-preview">
          <Image
            src={previewUrl}
            alt={`Prévia de ${selectedImage.name}`}
            width={720}
            height={480}
            unoptimized
          />
        </div>
      )}
    </div>
  );
}
