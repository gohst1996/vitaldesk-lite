import { redirect } from "next/navigation";
import { AppHeader, Screen } from "@/components/ui";
import { buildSlots, nextWorkDays, nowInTz } from "@/lib/dates";
import { getClinicById, listDoctors, takenSlotsByDay } from "@/lib/queries";
import { requireStaff } from "@/lib/session";
import { StaffBookingForm } from "./staff-booking-form";

export default async function NewAppointment() {
  const session = await requireStaff();
  if (!session) redirect("/panel/entrar");

  const clinic = await getClinicById(session.clinicId);
  if (!clinic) redirect("/panel/entrar");

  const [doctors, takenByDay] = await Promise.all([
    listDoctors(clinic.id),
    takenSlotsByDay(clinic.id, clinic.timezone),
  ]);

  const days = nextWorkDays(clinic.workDays, 14, clinic.timezone);
  const slots = buildSlots(clinic.openHour, clinic.closeHour, clinic.slotMins);

  return (
    <>
      <AppHeader
        title="Agendar por el paciente"
        subtitle="Para cuando llaman o llegan al mostrador"
        back="/panel"
      />
      <Screen>
        <StaffBookingForm
          days={days}
          slots={slots}
          takenByDay={takenByDay}
          now={nowInTz(clinic.timezone)}
          doctors={doctors.map((d) => ({ id: d.id, name: d.name }))}
          canConfirmNow={session.role === "DOCTOR" || session.role === "ASSISTANT"}
        />
      </Screen>
    </>
  );
}
