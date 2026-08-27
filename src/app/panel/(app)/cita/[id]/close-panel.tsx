"use client";

import { useState } from "react";
import { closeAppointmentAction } from "@/actions/staff";
import { SubmitButton } from "@/components/submit-button";

export function ClosePanel({ id, isPast }: { id: string; isPast: boolean }) {
  const [open, setOpen] = useState(isPast);

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="btn-ghost text-slate-500"
      >
        Cerrar o cancelar esta cita
      </button>
    );
  }

  return (
    <div className="card animate-in-up space-y-2.5 p-5">
      <h2 className="font-bold text-slate-900">Cerrar la cita</h2>
      <p className="mb-1 text-sm text-slate-500">
        {isPast
          ? "Esta cita ya pasó. ¿Cómo salió?"
          : "Marcá cómo terminó esta cita."}
      </p>

      <form action={closeAppointmentAction}>
        <input type="hidden" name="id" value={id} />
        <input type="hidden" name="status" value="COMPLETED" />
        <SubmitButton pendingText="Guardando…">Se atendió</SubmitButton>
      </form>

      <form action={closeAppointmentAction}>
        <input type="hidden" name="id" value={id} />
        <input type="hidden" name="status" value="NO_SHOW" />
        <SubmitButton className="btn-ghost" pendingText="Guardando…">
          No se presentó
        </SubmitButton>
      </form>

      <form action={closeAppointmentAction}>
        <input type="hidden" name="id" value={id} />
        <input type="hidden" name="status" value="CANCELLED" />
        <SubmitButton className="btn-danger" pendingText="Guardando…">
          Cancelar la cita
        </SubmitButton>
      </form>
    </div>
  );
}
