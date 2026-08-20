import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ImageScaleField } from "@/app/(app)/exams/[id]/edit/_components/image-scale-field";

describe("ImageScaleField", () => {
  it("keeps the explicit field association and updates its output live", () => {
    render(<ImageScaleField questionId={7} initialValue={75} min={25} max={100} />);

    const slider = screen.getByRole("slider", { name: "Escala da imagem da questão 7" });
    expect(slider).toHaveAttribute("id", "image-scale-7");
    expect(slider).toHaveAttribute("name", "imageScale-7");
    expect(slider).toHaveAttribute("min", "25");
    expect(slider).toHaveAttribute("max", "100");
    expect(slider).toHaveValue("75");
    expect(screen.getByText("75%")).toHaveAttribute("for", "image-scale-7");

    fireEvent.change(slider, { target: { value: "60" } });

    expect(slider).toHaveValue("60");
    expect(screen.getByText("60%")).toBeInTheDocument();
    expect(screen.queryByText("75%")).not.toBeInTheDocument();
  });
});
