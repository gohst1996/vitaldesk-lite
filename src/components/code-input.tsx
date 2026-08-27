"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Seis casillas que se comportan como un solo campo: pegar el codigo lo reparte,
 * borrar retrocede, y en movil abre el teclado numerico.
 */
export function CodeInput({
  name = "code",
  length = 6,
  autoFocus = true,
  defaultValue = "",
}: {
  name?: string;
  length?: number;
  autoFocus?: boolean;
  defaultValue?: string;
}) {
  const [digits, setDigits] = useState<string[]>(() =>
    Array.from({ length }, (_, i) => defaultValue[i] ?? ""),
  );
  const refs = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    if (autoFocus) refs.current[0]?.focus();
  }, [autoFocus]);

  function setAt(i: number, v: string) {
    const next = [...digits];
    next[i] = v;
    setDigits(next);
  }

  function handleChange(i: number, raw: string) {
    const clean = raw.replace(/\D/g, "");
    if (!clean) return setAt(i, "");

    if (clean.length > 1) {
      const next = [...digits];
      for (let k = 0; k < clean.length && i + k < length; k++) {
        next[i + k] = clean[k];
      }
      setDigits(next);
      refs.current[Math.min(i + clean.length, length - 1)]?.focus();
      return;
    }

    setAt(i, clean);
    if (i < length - 1) refs.current[i + 1]?.focus();
  }

  function handleKeyDown(i: number, e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Backspace" && !digits[i] && i > 0) {
      e.preventDefault();
      setAt(i - 1, "");
      refs.current[i - 1]?.focus();
    }
    if (e.key === "ArrowLeft" && i > 0) refs.current[i - 1]?.focus();
    if (e.key === "ArrowRight" && i < length - 1) refs.current[i + 1]?.focus();
  }

  return (
    <div>
      <input type="hidden" name={name} value={digits.join("")} />
      <div className="flex justify-between gap-2">
        {digits.map((d, i) => (
          <input
            key={i}
            ref={(el) => {
              refs.current[i] = el;
            }}
            value={d}
            onChange={(e) => handleChange(i, e.target.value)}
            onKeyDown={(e) => handleKeyDown(i, e)}
            onFocus={(e) => e.target.select()}
            inputMode="numeric"
            autoComplete={i === 0 ? "one-time-code" : "off"}
            maxLength={length}
            aria-label={`Dígito ${i + 1}`}
            className="h-14 w-full rounded-xl border border-slate-200 bg-white text-center text-2xl font-bold text-slate-900 shadow-sm outline-none transition focus:border-brand-500 focus:ring-3 focus:ring-brand-100"
          />
        ))}
      </div>
    </div>
  );
}
