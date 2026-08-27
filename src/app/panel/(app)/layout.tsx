import { redirect } from "next/navigation";
import { requireStaff } from "@/lib/session";
import { getClinicById, clinicCounts } from "@/lib/queries";
import { BottomNav } from "./bottom-nav";

export default async function PanelLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await requireStaff();
  if (!session) redirect("/panel/entrar");

  const clinic = await getClinicById(session.clinicId);
  if (!clinic) redirect("/panel/entrar");

  const counts = await clinicCounts(clinic.id);

  return (
    <>
      {children}
      <BottomNav pending={counts.pending + counts.proposed} />
    </>
  );
}
