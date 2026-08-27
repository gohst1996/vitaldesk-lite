"use client";

import { useMemo, useState } from "react";

export type DayOption = { value: string; label: string };

/**
 * Selector de dia + hora pensado para el pulgar: chips grandes, scroll
 * horizontal para los dias y una rejilla de horas.
 */
export function SlotPicker({
  days,
  slots,
  nameDate = "date",
  nameTime = "time",
  defaultDate,
  defaultTime,
  takenByDay,
  now,
}: {
  days: DayOption[];
  slots: string[];
  nameDate?: string;
  nameTime?: string;
  defaultDate?: string;
  defaultTime?: string;
  /** { "2026-09-03": ["09:00","09:30"] } — franjas ya ocupadas */
  takenByDay?: Record<string, string[]>;
  /** Fecha y hora actuales en la zona de la clínica, para tachar lo que ya pasó */
  now?: { date: string; time: string };
}) {
  const [date, setDate] = useState(defaultDate ?? days[0]?.value ?? "");
  const [time, setTime] = useState(defaultTime ?? "");

  const taken = useMemo(
    () => new Set(takenByDay?.[date] ?? []),
    [takenByDay, date],
  );

  /** Si el día elegido es hoy, todo lo anterior a la hora actual ya no sirve. */
  const isPast = (slot: string) =>
    !!now && date === now.date && slot <= now.time;

  const allBlocked = slots.every((s) => taken.has(s) || isPast(s));

  return (
    <div className="space-y-4">
      <input type="hidden" name={nameDate} value={date} />
      <input type="hidden" name={nameTime} value={time} />

      <div>
        <span className="label">¿Qué día te sirve?</span>
        <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {days.map((d) => (
            <button
              key={d.value}
              type="button"
              onClick={() => setDate(d.value)}
              aria-pressed={date === d.value}
              className={`shrink-0 rounded-xl border px-4 py-2.5 text-sm font-semibold transition ${
                date === d.value
                  ? "border-brand-600 bg-brand-600 text-white shadow-sm"
                  : "border-slate-200 bg-white text-slate-700"
              }`}
            >
              {d.label}
            </button>
          ))}
        </div>
      </div>

      <div>
        <span className="label">¿A qué hora?</span>
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
          {slots.map((s) => {
            const blocked = taken.has(s) || isPast(s);
            return (
              <button
                key={s}
                type="button"
                disabled={blocked}
                onClick={() => setTime(s)}
                aria-pressed={time === s}
                className={`rounded-xl border py-2.5 text-sm font-semibold transition ${
                  blocked
                    ? "cursor-not-allowed border-slate-100 bg-slate-50 text-slate-300 line-through"
                    : time === s
                      ? "border-brand-600 bg-brand-600 text-white shadow-sm"
                      : "border-slate-200 bg-white text-slate-700"
                }`}
              >
                {formatSlot(s)}
              </button>
            );
          })}
        </div>
        {allBlocked && (
          <p className="mt-2 text-xs text-amber-700">
            No queda nada libre ese día. Probá con otro.
          </p>
        )}
        {!time && !allBlocked && (
          <p className="mt-2 text-xs text-slate-500">
            Elegí una hora para continuar.
          </p>
        )}
      </div>
    </div>
  );
}

function formatSlot(hhmm: string) {
  const [h, m] = hhmm.split(":").map(Number);
  const suffix = h < 12 ? "a" : "p";
  const hour = h % 12 === 0 ? 12 : h % 12;
  return m === 0 ? `${hour}:00 ${suffix}` : `${hour}:${String(m).padStart(2, "0")} ${suffix}`;
}
