import type { AppointmentStatus } from "@/db/schema";

type Meta = {
  label: string;
  patientLabel: string;
  /** Clases Tailwind del badge */
  badge: string;
  dot: string;
  /** Que ve el paciente como explicacion */
  hint: string;
};

export const STATUS: Record<AppointmentStatus, Meta> = {
  PENDING: {
    label: "En espera",
    patientLabel: "En espera",
    badge: "bg-amber-50 text-amber-800 ring-amber-200",
    dot: "bg-amber-500",
    hint: "La clínica todavía no la revisa. Te avisamos por correo apenas responda.",
  },
  RESCHEDULE_PROPOSED: {
    label: "Reprogramada",
    patientLabel: "Nueva fecha propuesta",
    badge: "bg-blue-50 text-blue-800 ring-blue-200",
    dot: "bg-blue-500",
    hint: "La clínica te propone otra fecha. Aceptala o pedí otra.",
  },
  CONFIRMED: {
    label: "Confirmada",
    patientLabel: "Confirmada",
    badge: "bg-teal-50 text-teal-800 ring-teal-200",
    dot: "bg-teal-500",
    hint: "Fecha en firme. Te esperamos.",
  },
  DECLINED: {
    label: "Rechazada",
    patientLabel: "No disponible",
    badge: "bg-rose-50 text-rose-800 ring-rose-200",
    dot: "bg-rose-500",
    hint: "La clínica no pudo tomar esta solicitud.",
  },
  CANCELLED: {
    label: "Cancelada",
    patientLabel: "Cancelada",
    badge: "bg-slate-100 text-slate-600 ring-slate-200",
    dot: "bg-slate-400",
    hint: "Esta cita se canceló.",
  },
  COMPLETED: {
    label: "Atendida",
    patientLabel: "Atendida",
    badge: "bg-slate-100 text-slate-600 ring-slate-200",
    dot: "bg-slate-400",
    hint: "Esta cita ya se atendió.",
  },
  NO_SHOW: {
    label: "No asistió",
    patientLabel: "No asististe",
    badge: "bg-orange-50 text-orange-800 ring-orange-200",
    dot: "bg-orange-500",
    hint: "Quedó marcada como no asistida.",
  },
};

/** Estados en los que la cita todavia esta viva. */
export const OPEN_STATUSES: AppointmentStatus[] = [
  "PENDING",
  "RESCHEDULE_PROPOSED",
  "CONFIRMED",
];

export const CLOSED_STATUSES: AppointmentStatus[] = [
  "DECLINED",
  "CANCELLED",
  "COMPLETED",
  "NO_SHOW",
];

/** La fecha que le importa al usuario segun el estado. */
export function effectiveDate(a: {
  status: AppointmentStatus;
  requestedAt: Date;
  scheduledAt: Date | null;
  proposedAt: Date | null;
}): Date {
  if (a.status === "RESCHEDULE_PROPOSED" && a.proposedAt) return a.proposedAt;
  return a.scheduledAt ?? a.requestedAt;
}

export function canPatientCancel(status: AppointmentStatus): boolean {
  return OPEN_STATUSES.includes(status);
}

export function canStaffDecide(status: AppointmentStatus): boolean {
  return status === "PENDING" || status === "RESCHEDULE_PROPOSED";
}
