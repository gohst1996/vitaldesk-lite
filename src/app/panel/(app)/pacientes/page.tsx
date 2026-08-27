import { redirect } from "next/navigation";
import { AppHeader, EmptyState, Screen } from "@/components/ui";
import { getClinicById, listPatients } from "@/lib/queries";
import { requireStaff } from "@/lib/session";
import { PatientList } from "./patient-list";

export default async function Patients() {
  const session = await requireStaff();
  if (!session) redirect("/panel/entrar");

  const clinic = await getClinicById(session.clinicId);
  if (!clinic) redirect("/panel/entrar");

  const rows = await listPatients(clinic.id);

  return (
    <>
      <AppHeader
        title="Pacientes"
        subtitle={`${rows.length} en ${clinic.name}`}
      />
      <Screen>
        {rows.length === 0 ? (
          <EmptyState
            title="Todavía no hay pacientes"
            body="Se crean solos cuando alguien pide una cita."
          />
        ) : (
          <PatientList
            patients={rows.map((p) => ({
              id: p.id,
              name: p.name,
              email: p.email,
              phone: p.phone,
            }))}
          />
        )}
      </Screen>
    </>
  );
}
