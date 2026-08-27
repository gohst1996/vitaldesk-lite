import "server-only";
import { and, asc, desc, eq, gte, inArray, lt, or } from "drizzle-orm";
import { db } from "@/db";
import {
  appointmentEvents,
  appointments,
  clinics,
  patients,
  staff,
} from "@/db/schema";
import { CLOSED_STATUSES, OPEN_STATUSES } from "./appointment-status";
import { normalizeEmail } from "./auth-codes";
import { partsInTz } from "./dates";

export async function getClinicBySlug(slug: string) {
  const [c] = await db
    .select()
    .from(clinics)
    .where(and(eq(clinics.slug, slug), eq(clinics.active, true)))
    .limit(1);
  return c ?? null;
}

export async function getClinicById(id: string) {
  const [c] = await db.select().from(clinics).where(eq(clinics.id, id)).limit(1);
  return c ?? null;
}

export async function listClinics() {
  return db
    .select()
    .from(clinics)
    .where(eq(clinics.active, true))
    .orderBy(asc(clinics.name));
}

export async function getStaffByEmail(clinicId: string, email: string) {
  const [s] = await db
    .select()
    .from(staff)
    .where(
      and(
        eq(staff.clinicId, clinicId),
        eq(staff.email, normalizeEmail(email)),
        eq(staff.active, true),
      ),
    )
    .limit(1);
  return s ?? null;
}

/** Busca al miembro del equipo por correo en cualquier clinica (para el login). */
export async function findStaffAnywhere(email: string) {
  const rows = await db
    .select({ s: staff, c: clinics })
    .from(staff)
    .innerJoin(clinics, eq(staff.clinicId, clinics.id))
    .where(and(eq(staff.email, normalizeEmail(email)), eq(staff.active, true)))
    .limit(1);
  return rows[0] ?? null;
}

export async function getPatientByEmail(clinicId: string, email: string) {
  const [p] = await db
    .select()
    .from(patients)
    .where(
      and(eq(patients.clinicId, clinicId), eq(patients.email, normalizeEmail(email))),
    )
    .limit(1);
  return p ?? null;
}

export async function listDoctors(clinicId: string) {
  return db
    .select()
    .from(staff)
    .where(
      and(
        eq(staff.clinicId, clinicId),
        eq(staff.role, "DOCTOR"),
        eq(staff.active, true),
      ),
    )
    .orderBy(asc(staff.name));
}

export type AppointmentRow = Awaited<
  ReturnType<typeof listPatientAppointments>
>[number];

export async function listPatientAppointments(patientId: string) {
  return db
    .select({
      appt: appointments,
      doctor: staff,
      clinic: clinics,
    })
    .from(appointments)
    .innerJoin(clinics, eq(appointments.clinicId, clinics.id))
    .leftJoin(staff, eq(appointments.doctorId, staff.id))
    .where(eq(appointments.patientId, patientId))
    .orderBy(desc(appointments.createdAt));
}

export async function getAppointmentForPatient(id: string, patientId: string) {
  const [row] = await db
    .select({ appt: appointments, doctor: staff, clinic: clinics })
    .from(appointments)
    .innerJoin(clinics, eq(appointments.clinicId, clinics.id))
    .leftJoin(staff, eq(appointments.doctorId, staff.id))
    .where(and(eq(appointments.id, id), eq(appointments.patientId, patientId)))
    .limit(1);
  return row ?? null;
}

export async function getAppointmentForStaff(id: string, clinicId: string) {
  const [row] = await db
    .select({ appt: appointments, patient: patients, doctor: staff, clinic: clinics })
    .from(appointments)
    .innerJoin(patients, eq(appointments.patientId, patients.id))
    .innerJoin(clinics, eq(appointments.clinicId, clinics.id))
    .leftJoin(staff, eq(appointments.doctorId, staff.id))
    .where(and(eq(appointments.id, id), eq(appointments.clinicId, clinicId)))
    .limit(1);
  return row ?? null;
}

/** Bandeja: lo que espera decision de la clinica, lo mas viejo primero. */
export async function listInbox(clinicId: string) {
  return db
    .select({ appt: appointments, patient: patients, doctor: staff })
    .from(appointments)
    .innerJoin(patients, eq(appointments.patientId, patients.id))
    .leftJoin(staff, eq(appointments.doctorId, staff.id))
    .where(
      and(
        eq(appointments.clinicId, clinicId),
        inArray(appointments.status, ["PENDING", "RESCHEDULE_PROPOSED"]),
      ),
    )
    .orderBy(asc(appointments.requestedAt));
}

/** Agenda confirmada de aqui en adelante. */
export async function listUpcoming(clinicId: string, from = new Date()) {
  return db
    .select({ appt: appointments, patient: patients, doctor: staff })
    .from(appointments)
    .innerJoin(patients, eq(appointments.patientId, patients.id))
    .leftJoin(staff, eq(appointments.doctorId, staff.id))
    .where(
      and(
        eq(appointments.clinicId, clinicId),
        eq(appointments.status, "CONFIRMED"),
        gte(appointments.scheduledAt, from),
      ),
    )
    .orderBy(asc(appointments.scheduledAt));
}

/** Citas confirmadas que ya pasaron y siguen sin cerrar. */
export async function listToClose(clinicId: string) {
  return db
    .select({ appt: appointments, patient: patients, doctor: staff })
    .from(appointments)
    .innerJoin(patients, eq(appointments.patientId, patients.id))
    .leftJoin(staff, eq(appointments.doctorId, staff.id))
    .where(
      and(
        eq(appointments.clinicId, clinicId),
        eq(appointments.status, "CONFIRMED"),
        lt(appointments.scheduledAt, new Date()),
      ),
    )
    .orderBy(desc(appointments.scheduledAt))
    .limit(20);
}

export async function listHistory(clinicId: string, limit = 50) {
  return db
    .select({ appt: appointments, patient: patients, doctor: staff })
    .from(appointments)
    .innerJoin(patients, eq(appointments.patientId, patients.id))
    .leftJoin(staff, eq(appointments.doctorId, staff.id))
    .where(
      and(
        eq(appointments.clinicId, clinicId),
        inArray(appointments.status, CLOSED_STATUSES),
      ),
    )
    .orderBy(desc(appointments.updatedAt))
    .limit(limit);
}

export async function listPatients(clinicId: string) {
  return db
    .select()
    .from(patients)
    .where(eq(patients.clinicId, clinicId))
    .orderBy(asc(patients.name));
}

export async function listEvents(appointmentId: string) {
  return db
    .select()
    .from(appointmentEvents)
    .where(eq(appointmentEvents.appointmentId, appointmentId))
    .orderBy(asc(appointmentEvents.createdAt));
}

/** Choques con otra cita confirmada del mismo doctor en esa franja. */
export async function findConflicts(
  clinicId: string,
  doctorId: string | null,
  start: Date,
  durationMins: number,
  excludeId?: string,
) {
  if (!doctorId) return [];
  const end = new Date(start.getTime() + durationMins * 60_000);
  const rows = await db
    .select({ appt: appointments, patient: patients })
    .from(appointments)
    .innerJoin(patients, eq(appointments.patientId, patients.id))
    .where(
      and(
        eq(appointments.clinicId, clinicId),
        eq(appointments.doctorId, doctorId),
        eq(appointments.status, "CONFIRMED"),
        gte(appointments.scheduledAt, new Date(start.getTime() - 4 * 3_600_000)),
        lt(appointments.scheduledAt, new Date(end.getTime() + 4 * 3_600_000)),
      ),
    );

  return rows.filter((r) => {
    if (excludeId && r.appt.id === excludeId) return false;
    const s = r.appt.scheduledAt!;
    const e = new Date(s.getTime() + r.appt.durationMins * 60_000);
    return s < end && e > start;
  });
}

/**
 * Franjas ya llenas, por dia, en la zona de la clinica.
 * Una franja se considera llena cuando hay tantas citas confirmadas como
 * doctores activos.
 */
export async function takenSlotsByDay(
  clinicId: string,
  timezone: string,
  fromDate: Date = new Date(),
  days = 30,
): Promise<Record<string, string[]>> {
  const until = new Date(fromDate.getTime() + days * 86_400_000);

  const rows = await db
    .select({ scheduledAt: appointments.scheduledAt })
    .from(appointments)
    .where(
      and(
        eq(appointments.clinicId, clinicId),
        eq(appointments.status, "CONFIRMED"),
        gte(appointments.scheduledAt, fromDate),
        lt(appointments.scheduledAt, until),
      ),
    );

  const doctors = await listDoctors(clinicId);
  const capacity = Math.max(1, doctors.length);

  const counts = new Map<string, number>();
  for (const r of rows) {
    if (!r.scheduledAt) continue;
    const { date, time } = partsInTz(r.scheduledAt, timezone);
    const key = `${date}|${time}`;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }

  const out: Record<string, string[]> = {};
  for (const [key, n] of counts) {
    if (n < capacity) continue;
    const [date, time] = key.split("|");
    (out[date] ??= []).push(time);
  }
  return out;
}

export async function clinicCounts(clinicId: string) {
  const rows = await db
    .select({ status: appointments.status })
    .from(appointments)
    .where(
      and(
        eq(appointments.clinicId, clinicId),
        inArray(appointments.status, OPEN_STATUSES),
      ),
    );
  return {
    pending: rows.filter((r) => r.status === "PENDING").length,
    proposed: rows.filter((r) => r.status === "RESCHEDULE_PROPOSED").length,
    confirmed: rows.filter((r) => r.status === "CONFIRMED").length,
  };
}
