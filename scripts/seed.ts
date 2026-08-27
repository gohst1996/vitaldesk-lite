/**
 * Datos de demo. Idempotente: se puede correr varias veces.
 *   npm run seed
 */
import "dotenv/config";
import { eq } from "drizzle-orm";
import { db, pool } from "../src/db";
import {
  appointmentEvents,
  appointments,
  clinics,
  patients,
  staff,
} from "../src/db/schema";
import { zonedToUtc } from "../src/lib/dates";

function dayOffset(days: number, tz: string): string {
  const d = new Date(Date.now() + days * 86_400_000);
  const f = new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  return f.format(d);
}

/** Corre el offset hasta caer en un dia habil de la clinica. */
function nextWorkdayOffset(start: number, workDays: number[], tz: string) {
  for (let i = start; i < start + 10; i++) {
    const ds = dayOffset(i, tz);
    const [y, m, d] = ds.split("-").map(Number);
    const wd = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
    const iso = wd === 0 ? 7 : wd;
    if (workDays.includes(iso)) return i;
  }
  return start;
}

async function main() {
  console.log("Sembrando datos de demo…");

  const tz = "America/Costa_Rica";
  const workDays = [1, 2, 3, 4, 5];

  /* ------------------------------------------------------------- clinicas */

  const clinicSeeds = [
    {
      slug: "sonrisa-nicoya",
      name: "Clínica Dental Sonrisa",
      kind: "DENTAL" as const,
      phone: "2685 4400",
      address: "Nicoya, Guanacaste",
      openHour: 8,
      closeHour: 17,
      slotMins: 30,
    },
    {
      slug: "vida-santa-cruz",
      name: "Consultorio Médico Vida",
      kind: "MEDICAL" as const,
      phone: "2680 1122",
      address: "Santa Cruz, Guanacaste",
      openHour: 7,
      closeHour: 16,
      slotMins: 20,
    },
  ];

  const clinicRows = [];
  for (const c of clinicSeeds) {
    const [existing] = await db
      .select()
      .from(clinics)
      .where(eq(clinics.slug, c.slug))
      .limit(1);

    if (existing) {
      clinicRows.push(existing);
      console.log(`  clínica ya existía: ${c.name}`);
      continue;
    }
    const [row] = await db
      .insert(clinics)
      .values({ ...c, timezone: tz, workDays })
      .returning();
    clinicRows.push(row);
    console.log(`  clínica creada: ${c.name}`);
  }

  const dental = clinicRows[0];
  const medical = clinicRows[1];

  /* ---------------------------------------------------------------- staff */

  const staffSeeds = [
    { clinicId: dental.id, email: "dentista@demo.cr", name: "Dra. Laura Jiménez", role: "DOCTOR" as const },
    { clinicId: dental.id, email: "asistente@demo.cr", name: "Karol Vargas", role: "ASSISTANT" as const },
    { clinicId: medical.id, email: "doctor@demo.cr", name: "Dr. Andrés Mora", role: "DOCTOR" as const },
  ];

  const staffRows = [];
  for (const s of staffSeeds) {
    const [existing] = await db
      .select()
      .from(staff)
      .where(eq(staff.email, s.email))
      .limit(1);
    if (existing) {
      staffRows.push(existing);
      continue;
    }
    const [row] = await db.insert(staff).values(s).returning();
    staffRows.push(row);
    console.log(`  ${s.role === "DOCTOR" ? "doctor" : "asistente"}: ${s.email}`);
  }

  const drLaura = staffRows[0];

  /* ------------------------------------------------------------ pacientes */

  const patientSeeds = [
    { clinicId: dental.id, email: "maria@demo.cr", name: "María Rodríguez", phone: "8812 3344" },
    { clinicId: dental.id, email: "carlos@demo.cr", name: "Carlos Peña", phone: "8760 9911" },
    { clinicId: dental.id, email: "sofia@demo.cr", name: "Sofía Alvarado", phone: null },
    { clinicId: medical.id, email: "jose@demo.cr", name: "José Ureña", phone: "8433 2200" },
  ];

  const patientRows = [];
  for (const p of patientSeeds) {
    const [existing] = await db
      .select()
      .from(patients)
      .where(eq(patients.email, p.email))
      .limit(1);
    if (existing) {
      patientRows.push(existing);
      continue;
    }
    const [row] = await db.insert(patients).values(p).returning();
    patientRows.push(row);
    console.log(`  paciente: ${p.name}`);
  }

  const [maria, carlos, sofia] = patientRows;

  /* ----------------------------------------------------------------- citas */

  const [{ count }] = await db
    .select({ count: appointments.id })
    .from(appointments)
    .limit(1)
    .then((r) => (r.length ? [{ count: 1 }] : [{ count: 0 }]));

  if (count > 0) {
    console.log("  ya había citas, no se agregan más");
    await pool.end();
    return;
  }

  const d1 = nextWorkdayOffset(1, workDays, tz);
  const d2 = nextWorkdayOffset(d1 + 1, workDays, tz);
  const d3 = nextWorkdayOffset(d2 + 1, workDays, tz);

  // 1. En espera — la pidió María
  const [a1] = await db
    .insert(appointments)
    .values({
      clinicId: dental.id,
      patientId: maria.id,
      requestedAt: zonedToUtc(dayOffset(d1, tz), "09:00", tz),
      durationMins: 30,
      reason:
        "Me duele una muela de abajo del lado derecho desde el lunes. Se pone peor con lo frío.",
      status: "PENDING",
      origin: "PATIENT",
    })
    .returning();
  await db.insert(appointmentEvents).values({
    appointmentId: a1.id,
    type: "created",
    actor: `patient:${maria.id}`,
    message: "El paciente solicitó la cita",
  });

  // 2. Reprogramada — la doctora propuso otra fecha
  const [a2] = await db
    .insert(appointments)
    .values({
      clinicId: dental.id,
      patientId: carlos.id,
      doctorId: drLaura.id,
      requestedAt: zonedToUtc(dayOffset(d1, tz), "10:00", tz),
      proposedAt: zonedToUtc(dayOffset(d2, tz), "14:30", tz),
      durationMins: 30,
      reason: "Limpieza y revisión general.",
      replyMessage: "A esa hora tengo cirugía. ¿Te sirve el jueves en la tarde?",
      status: "RESCHEDULE_PROPOSED",
      origin: "PATIENT",
      decidedByStaffId: drLaura.id,
      decidedAt: new Date(),
    })
    .returning();
  await db.insert(appointmentEvents).values([
    {
      appointmentId: a2.id,
      type: "created",
      actor: `patient:${carlos.id}`,
      message: "El paciente solicitó la cita",
    },
    {
      appointmentId: a2.id,
      type: "reschedule_proposed",
      actor: `staff:${drLaura.id}`,
      message: "La clínica propuso otra fecha",
    },
  ]);

  // 3. Confirmada — la agendó la asistente
  const [a3] = await db
    .insert(appointments)
    .values({
      clinicId: dental.id,
      patientId: sofia.id,
      doctorId: drLaura.id,
      requestedAt: zonedToUtc(dayOffset(d3, tz), "11:00", tz),
      scheduledAt: zonedToUtc(dayOffset(d3, tz), "11:00", tz),
      durationMins: 30,
      reason: "Control de ortodoncia.",
      staffNote: "Llamó la mamá. Paga en efectivo.",
      replyMessage: "Llegá 10 minutos antes con tu cédula.",
      status: "CONFIRMED",
      origin: "STAFF",
      createdByStaffId: staffRows[1].id,
      decidedByStaffId: drLaura.id,
      decidedAt: new Date(),
    })
    .returning();
  await db.insert(appointmentEvents).values([
    {
      appointmentId: a3.id,
      type: "created",
      actor: `staff:${staffRows[1].id}`,
      message: "La asistente agendó la cita con los datos del paciente",
    },
    {
      appointmentId: a3.id,
      type: "confirmed",
      actor: `staff:${drLaura.id}`,
      message: "La clínica confirmó la cita",
    },
  ]);

  console.log("  3 citas de ejemplo creadas");
  console.log("\nListo. Entrá con:");
  console.log("  Panel  → dentista@demo.cr  o  asistente@demo.cr");
  console.log("  Paciente → maria@demo.cr");
  console.log("  El código sale en la consola y en pantalla (modo demo).");

  await pool.end();
}

main().catch(async (err) => {
  console.error(err);
  await pool.end();
  process.exit(1);
});
