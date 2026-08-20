"use client";

import { useState } from "react";

interface ImageScaleFieldProps {
  questionId: number;
  initialValue: number;
  min: number;
  max: number;
}

export function ImageScaleField({ questionId, initialValue, min, max }: ImageScaleFieldProps) {
  const [value, setValue] = useState(initialValue);
  const inputId = `image-scale-${questionId}`;
  const outputId = `image-scale-output-${questionId}`;

  return (
    <>
      <label className="form-label" htmlFor={inputId}>Escala da imagem</label>
      <output id={outputId} className="exam-editor-image-scale-output" htmlFor={inputId}>
        {value}%
      </output>
      <input
        id={inputId}
        name={`imageScale-${questionId}`}
        type="range"
        min={min}
        max={max}
        step="1"
        value={value}
        onChange={(event) => setValue(Number(event.currentTarget.value))}
        aria-label={`Escala da imagem da questão ${questionId}`}
        aria-describedby={outputId}
      />
    </>
  );
}
