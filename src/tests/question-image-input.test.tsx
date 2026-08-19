import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { createElement, type ImgHTMLAttributes } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { QuestionImageInput, getClipboardImage } from "@/app/(app)/questions/_components/question-image-input";

vi.mock("next/image", () => ({
  default: ({ unoptimized, ...props }: ImgHTMLAttributes<HTMLImageElement> & { unoptimized?: boolean }) => {
    void unoptimized;
    return createElement("img", props);
  },
}));

class DataTransferMock {
  files: File[] = [];
  items = {
    add: (file: File) => {
      this.files = [file];
      return file;
    },
  };
}

const nativeFilesDescriptor = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "files");

describe("QuestionImageInput", () => {
  beforeEach(() => {
    vi.stubGlobal("DataTransfer", DataTransferMock);
    Object.defineProperty(HTMLInputElement.prototype, "files", {
      configurable: true,
      get() {
        return Reflect.get(this, "__testFiles") ?? null;
      },
      set(files) {
        Reflect.set(this, "__testFiles", files);
      },
    });
    Object.defineProperty(URL, "createObjectURL", {
      configurable: true,
      value: vi.fn(() => "blob:question-image"),
    });
    Object.defineProperty(URL, "revokeObjectURL", {
      configurable: true,
      value: vi.fn(),
    });
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    Reflect.deleteProperty(URL, "createObjectURL");
    Reflect.deleteProperty(URL, "revokeObjectURL");
    if (nativeFilesDescriptor) {
      Object.defineProperty(HTMLInputElement.prototype, "files", nativeFilesDescriptor);
    }
  });

  it("finds an image in clipboard items and ignores pasted text", () => {
    const image = new File(["png"], "captura.png", { type: "image/png" });
    const imageClipboard = {
      items: [{ kind: "file", type: "image/png", getAsFile: () => image }],
      files: [],
    } as unknown as DataTransfer;
    const textClipboard = {
      items: [{ kind: "string", type: "text/plain", getAsFile: () => null }],
      files: [],
    } as unknown as DataTransfer;

    expect(getClipboardImage(imageClipboard)).toBe(image);
    expect(getClipboardImage(textClipboard)).toBeNull();
  });

  it("attaches a pasted image to the file input and shows its preview", () => {
    render(<QuestionImageInput />);
    const image = new File(["png"], "captura.png", { type: "image/png" });
    const clipboardData = {
      items: [{ kind: "file", type: "image/png", getAsFile: () => image }],
      files: [],
    } as unknown as DataTransfer;

    fireEvent.paste(window, { clipboardData });

    const input = screen.getByLabelText("Imagem (opcional)") as HTMLInputElement;
    expect(input.files?.[0]).toBe(image);
    expect(screen.getByRole("status")).toHaveTextContent("captura.png anexada pelo Ctrl+V");
    expect(screen.getByRole("img", { name: "Prévia de captura.png" })).toBeInTheDocument();
  });

  it("removes the attached image from the file input and preview", () => {
    render(<QuestionImageInput />);
    const image = new File(["png"], "captura.png", { type: "image/png" });
    const clipboardData = {
      items: [{ kind: "file", type: "image/png", getAsFile: () => image }],
      files: [],
    } as unknown as DataTransfer;

    fireEvent.paste(window, { clipboardData });
    fireEvent.click(screen.getByRole("button", { name: "Remover imagem" }));

    const input = screen.getByLabelText("Imagem (opcional)") as HTMLInputElement;
    expect(input.files).toHaveLength(0);
    expect(screen.getByRole("status")).toHaveTextContent("Imagem removida");
    expect(screen.queryByRole("img", { name: "Prévia de captura.png" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Remover imagem" })).not.toBeInTheDocument();
  });

  it("keeps manual file selection working", () => {
    render(<QuestionImageInput hasCurrentImage />);
    const image = new File(["jpg"], "diagrama.jpg", { type: "image/jpeg" });
    const input = screen.getByLabelText("Substituir imagem");

    fireEvent.change(input, { target: { files: [image] } });

    expect(screen.getByRole("status")).toHaveTextContent("diagrama.jpg anexada");
    expect(screen.getByRole("img", { name: "Prévia de diagrama.jpg" })).toBeInTheDocument();
  });
});
