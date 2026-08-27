import { notFound } from "next/navigation";
import { AppHeader, Screen } from "@/components/ui";
import { buildSlots, nextWorkDays, nowInTz } from "@/lib/dates";
import { getClinicBySlug, getPatientByEmail, takenSlotsByDay } from "@/lib/queries";
import { getSession } from "@/lib/session";
import { BookingForm } from "./booking-form";

export default async function RequestAppointment({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const clinic = await getClinicBySlug(slug);
  if (!clinic) notFound();

  const session = await getSession();
  const patient =
    session?.kind === "patient" && session.clinicSlug === clinic.slug
      ? await getPatientByEmail(clinic.id, session.email)
      : null;

  const days = nextWorkDays(clinic.workDays, 10, clinic.timezone);
  const slots = buildSlots(clinic.openHour, clinic.closeHour, clinic.slotMins);
  const takenByDay = await takenSlotsByDay(clinic.id, clinic.timezone);

  return (
    <>
      <AppHeader
        title="Pedir una cita"
        subtitle={clinic.name}
        back={`/c/${clinic.slug}`}
      />
      <Screen>
        <BookingForm
          slug={clinic.slug}
          days={days}
          slots={slots}
          takenByDay={takenByDay}
          now={nowInTz(clinic.timezone)}
          patient={
            patient
              ? { name: patient.name, email: patient.email, phone: patient.phone }
              : null
          }
        />
      </Screen>
    </>
  );
}
