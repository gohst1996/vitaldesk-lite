"use client";

import { useMemo, useState } from "react";

type P = { id: string; name: string; email: string; phone: string | null };

export function PatientList({ patients }: { patients: P[] }) {
  const [q, setQ] = useState("");

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return patients;
    return patients.filter(
      (p) =>
        p.name.toLowerCase().includes(needle) ||
        p.email.toLowerCase().includes(needle) ||
        (p.phone ?? "").includes(needle),
    );
  }, [patients, q]);

  return (
    <div className="space-y-4">
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Buscar por nombre, correo o teléfono"
        className="field"
        type="search"
      />

      {filtered.length === 0 ? (
        <p className="py-8 text-center text-sm text-slate-500">
          Nadie coincide con “{q}”.
        </p>
      ) : (
        <ul className="card divide-y divide-slate-100">
          {filtered.map((p) => (
            <li key={p.id} className="flex items-center gap-3 px-4 py-3.5">
              <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-brand-50 text-sm font-bold text-brand-700">
                {initials(p.name)}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold text-slate-900">{p.name}</p>
                <p className="truncate text-xs text-slate-500">
                  {p.email}
                  {p.phone ? ` · ${p.phone}` : ""}
                </p>
              </div>
              <a
                href={`mailto:${p.email}`}
                aria-label={`Escribir a ${p.name}`}
                className="shrink-0 rounded-full p-2 text-slate-400 transition hover:bg-slate-100"
              >
                <svg viewBox="0 0 24 24" fill="none" className="size-5">
                  <rect
                    x="3"
                    y="5"
                    width="18"
                    height="14"
                    rx="3"
                    stroke="currentColor"
                    strokeWidth="1.6"
                  />
                  <path
                    d="m4 7 8 5 8-5"
                    stroke="currentColor"
                    strokeWidth="1.6"
                    strokeLinecap="round"
                  />
                </svg>
              </a>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function initials(name: string) {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");
}
