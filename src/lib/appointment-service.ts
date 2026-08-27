import "server-only";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import {
  appointmentEvents,
  appointments,
  clinics,
  patients,
  type Appointment,
  type Clinic,
  type Patient,
} from "@/db/schema";
import { env } from "./env";
import { formatLong } from "./dates";
import {
  appointmentConfirmedMail,
  appointmentDeclinedMail,
  appointmentRequestedMail,
  appointmentRescheduledMail,
  sendMail,
} from "./mailer";
import { normalizeEmail } from "./auth-codes";

/* -------------------------------------------------------------- bitacora */

export async function logEvent(
  appointmentId: string,
  type: string,
  actor: string,
  message?: string,
  meta?: unknown,
) {
  await db.insert(appointmentEvents).values({
    appointmentId,
    type,
    actor,
    message: message ?? null,
    meta: (meta as object) ?? null,
  });
}

/* --------------------------------------------------------------- paciente */

/** Crea el paciente si no existe; si existe, completa los datos que falten. */
export async function upsertPatient(input: {
  clinicId: string;
  email: string;
  name: string;
  phone?: string | null;
  notes?: string | null;
}): Promise<Patient> {
  const email = normalizeEmail(input.email);
  const [existing] = await db
    .select()
    .from(patients)
    .where(eq(patients.email, email))
    .limit(1)
    .then((rows) => rows.filter((r) => r.clinicId === input.clinicId));

  if (existing) {
    const [updated] = await db
      .update(patients)
      .set({
        name: input.name || existing.name,
        phone: input.phone ?? existing.phone,
        notes: input.notes ?? existing.notes,
        updatedAt: new Date(),
      })
      .where(eq(patients.id, existing.id))
      .returning();
    return updated;
  }

  const [created] = await db
    .insert(patients)
    .values({
      clinicId: input.clinicId,
      email,
      name: input.name,
      phone: input.phone ?? null,
      notes: input.notes ?? null,
    })
    .returning();
  return created;
}

/* ------------------------------------------------------------------ citas */

export async function createAppointment(input: {
  clinic: Clinic;
  patient: Patient;
  requestedAt: Date;
  reason?: string | null;
  durationMins?: number;
  doctorId?: string | null;
  origin: "PATIENT" | "STAFF";
  createdByStaffId?: string | null;
  staffNote?: string | null;
  notifyPatient?: boolean;
}): Promise<Appointment> {
  const [appt] = await db
    .insert(appointments)
    .values({
      clinicId: input.clinic.id,
      patientId: input.patient.id,
      doctorId: input.doctorId ?? null,
      requestedAt: input.requestedAt,
      durationMins: input.durationMins ?? input.clinic.slotMins,
      reason: input.reason ?? null,
      staffNote: input.staffNote ?? null,
      origin: input.origin,
      createdByStaffId: input.createdByStaffId ?? null,
      status: "PENDING",
    })
    .returning();

  await logEvent(
    appt.id,
    "created",
    input.origin === "PATIENT"
      ? `patient:${input.patient.id}`
      : `staff:${input.createdByStaffId ?? "?"}`,
    input.origin === "PATIENT"
      ? "El paciente solicitó la cita"
      : "La asistente agendó la cita con los datos del paciente",
    { requestedAt: input.requestedAt.toISOString() },
  );

  if (input.notifyPatient !== false) {
    await safeMail(() =>
      sendMail({
        to: input.patient.email,
        ...appointmentRequestedMail({
          patientName: firstName(input.patient.name),
          clinicName: input.clinic.name,
          when: formatLong(input.requestedAt, input.clinic.timezone),
          reason: input.reason,
          url: `${env.appUrl}/c/${input.clinic.slug}/citas/${appt.id}`,
        }),
      }),
    );
  }

  return appt;
}

export async function confirmAppointment(opts: {
  appointmentId: string;
  clinicId: string;
  staffId: string;
  scheduledAt: Date;
  doctorId?: string | null;
  message?: string | null;
  staffNote?: string | null;
}) {
  const [appt] = await db
    .update(appointments)
    .set({
      status: "CONFIRMED",
      scheduledAt: opts.scheduledAt,
      proposedAt: null,
      doctorId: opts.doctorId ?? undefined,
      replyMessage: opts.message ?? null,
      staffNote: opts.staffNote ?? undefined,
      decidedByStaffId: opts.staffId,
      decidedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(appointments.id, opts.appointmentId))
    .returning();

  await logEvent(
    appt.id,
    "confirmed",
    `staff:${opts.staffId}`,
    "La clínica confirmó la cita",
    { scheduledAt: opts.scheduledAt.toISOString() },
  );

  const { clinic, patient } = await loadContext(appt);
  await safeMail(() =>
    sendMail({
      to: patient.email,
      ...appointmentConfirmedMail({
        patientName: firstName(patient.name),
        clinicName: clinic.name,
        when: formatLong(opts.scheduledAt, clinic.timezone),
        message: opts.message,
        url: `${env.appUrl}/c/${clinic.slug}/citas/${appt.id}`,
      }),
    }),
  );

  return appt;
}

export async function proposeReschedule(opts: {
  appointmentId: string;
  clinicId: string;
  staffId: string;
  proposedAt: Date;
  doctorId?: string | null;
  message?: string | null;
  staffNote?: string | null;
}) {
  const [appt] = await db
    .update(appointments)
    .set({
      status: "RESCHEDULE_PROPOSED",
      proposedAt: opts.proposedAt,
      scheduledAt: null,
      doctorId: opts.doctorId ?? undefined,
      replyMessage: opts.message ?? null,
      staffNote: opts.staffNote ?? undefined,
      decidedByStaffId: opts.staffId,
      decidedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(appointments.id, opts.appointmentId))
    .returning();

  await logEvent(
    appt.id,
    "reschedule_proposed",
    `staff:${opts.staffId}`,
    "La clínica propuso otra fecha",
    { proposedAt: opts.proposedAt.toISOString() },
  );

  const { clinic, patient } = await loadContext(appt);
  await safeMail(() =>
    sendMail({
      to: patient.email,
      ...appointmentRescheduledMail({
        patientName: firstName(patient.name),
        clinicName: clinic.name,
        when: formatLong(opts.proposedAt, clinic.timezone),
        message: opts.message,
        url: `${env.appUrl}/c/${clinic.slug}/citas/${appt.id}`,
      }),
    }),
  );

  return appt;
}

export async function declineAppointment(opts: {
  appointmentId: string;
  staffId: string;
  message?: string | null;
}) {
  const [appt] = await db
    .update(appointments)
    .set({
      status: "DECLINED",
      replyMessage: opts.message ?? null,
      decidedByStaffId: opts.staffId,
      decidedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(appointments.id, opts.appointmentId))
    .returning();

  await logEvent(
    appt.id,
    "declined",
    `staff:${opts.staffId}`,
    "La clínica rechazó la solicitud",
  );

  const { clinic, patient } = await loadContext(appt);
  await safeMail(() =>
    sendMail({
      to: patient.email,
      ...appointmentDeclinedMail({
        patientName: firstName(patient.name),
        clinicName: clinic.name,
        when: formatLong(appt.requestedAt, clinic.timezone),
        message: opts.message,
        url: `${env.appUrl}/c/${clinic.slug}`,
      }),
    }),
  );

  return appt;
}

/** El paciente acepta la fecha alterna que le propusieron. */
export async function acceptProposal(appointmentId: string, patientId: string) {
  const [current] = await db
    .select()
    .from(appointments)
    .where(eq(appointments.id, appointmentId))
    .limit(1);

  if (!current || current.patientId !== patientId) return null;
  if (current.status !== "RESCHEDULE_PROPOSED" || !current.proposedAt) return null;

  const [appt] = await db
    .update(appointments)
    .set({
      status: "CONFIRMED",
      scheduledAt: current.proposedAt,
      proposedAt: null,
      updatedAt: new Date(),
    })
    .where(eq(appointments.id, appointmentId))
    .returning();

  await logEvent(
    appt.id,
    "proposal_accepted",
    `patient:${patientId}`,
    "El paciente aceptó la nueva fecha",
  );

  return appt;
}

/** El paciente rechaza la propuesta y pide otra fecha. */
export async function rejectProposal(
  appointmentId: string,
  patientId: string,
  newRequestedAt: Date,
  note?: string | null,
) {
  const [current] = await db
    .select()
    .from(appointments)
    .where(eq(appointments.id, appointmentId))
    .limit(1);

  if (!current || current.patientId !== patientId) return null;
  if (current.status !== "RESCHEDULE_PROPOSED") return null;

  const [appt] = await db
    .update(appointments)
    .set({
      status: "PENDING",
      requestedAt: newRequestedAt,
      proposedAt: null,
      scheduledAt: null,
      replyMessage: null,
      reason: note ? `${current.reason ?? ""}\n${note}`.trim() : current.reason,
      updatedAt: new Date(),
    })
    .where(eq(appointments.id, appointmentId))
    .returning();

  await logEvent(
    appt.id,
    "proposal_rejected",
    `patient:${patientId}`,
    "El paciente pidió otra fecha",
    { requestedAt: newRequestedAt.toISOString() },
  );

  return appt;
}

export async function cancelByPatient(
  appointmentId: string,
  patientId: string,
  reason?: string | null,
) {
  const [current] = await db
    .select()
    .from(appointments)
    .where(eq(appointments.id, appointmentId))
    .limit(1);
  if (!current || current.patientId !== patientId) return null;

  const [appt] = await db
    .update(appointments)
    .set({ status: "CANCELLED", updatedAt: new Date() })
    .where(eq(appointments.id, appointmentId))
    .returning();

  await logEvent(
    appt.id,
    "cancelled",
    `patient:${patientId}`,
    reason ? `El paciente canceló: ${reason}` : "El paciente canceló la cita",
  );

  return appt;
}

export async function closeAppointment(opts: {
  appointmentId: string;
  staffId: string;
  status: "COMPLETED" | "NO_SHOW" | "CANCELLED";
  staffNote?: string | null;
}) {
  const [appt] = await db
    .update(appointments)
    .set({
      status: opts.status,
      staffNote: opts.staffNote ?? undefined,
      updatedAt: new Date(),
    })
    .where(eq(appointments.id, opts.appointmentId))
    .returning();

  const label =
    opts.status === "COMPLETED"
      ? "La clínica marcó la cita como atendida"
      : opts.status === "NO_SHOW"
        ? "El paciente no se presentó"
        : "La clínica canceló la cita";

  await logEvent(appt.id, opts.status.toLowerCase(), `staff:${opts.staffId}`, label);
  return appt;
}

/* ------------------------------------------------------------------ util */

async function loadContext(appt: Appointment) {
  const [clinic] = await db
    .select()
    .from(clinics)
    .where(eq(clinics.id, appt.clinicId))
    .limit(1);
  const [patient] = await db
    .select()
    .from(patients)
    .where(eq(patients.id, appt.patientId))
    .limit(1);
  return { clinic, patient };
}

function firstName(name: string) {
  return name.trim().split(/\s+/)[0];
}

/** Un fallo de correo nunca debe tumbar la operacion. */
async function safeMail(fn: () => Promise<void>) {
  try {
    await fn();
  } catch (err) {
    console.error("[correo] no se pudo enviar:", err);
  }
}
