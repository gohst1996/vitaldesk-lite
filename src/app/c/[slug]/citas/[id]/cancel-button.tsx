"use client";

import { useState } from "react";
import { cancelAppointment } from "@/actions/patient";
import { SubmitButton } from "@/components/submit-button";

export function CancelButton({ slug, id }: { slug: string; id: string }) {
  const [confirming, setConfirming] = useState(false);

  if (!confirming) {
    return (
      <button
        type="button"
        onClick={() => setConfirming(true)}
        className="btn-ghost text-slate-500"
      >
        Cancelar esta cita
      </button>
    );
  }

  return (
    <div className="card space-y-3 border-rose-200 bg-rose-50/50 p-5">
      <p className="text-sm font-medium text-slate-800">
        ¿Seguro que querés cancelarla? La clínica va a ver que se liberó el
        espacio.
      </p>
      <form action={cancelAppointment}>
        <input type="hidden" name="slug" value={slug} />
        <input type="hidden" name="id" value={id} />
        <SubmitButton className="btn-danger" pendingText="Cancelando…">
          Sí, cancelar
        </SubmitButton>
      </form>
      <button
        type="button"
        onClick={() => setConfirming(false)}
        className="btn-ghost"
      >
        No, dejarla
      </button>
    </div>
  );
}
