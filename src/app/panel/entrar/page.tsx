import Link from "next/link";
import { redirect } from "next/navigation";
import { Logo } from "@/components/ui";
import { requireStaff } from "@/lib/session";
import { StaffLoginForm } from "./staff-login-form";

export default async function StaffLoginPage() {
  const session = await requireStaff();
  if (session) redirect("/panel");

  return (
    <main className="safe-top mx-auto flex w-full max-w-lg flex-1 flex-col justify-center px-4 py-10">
      <div className="mb-8 text-center">
        <Logo className="mx-auto size-12" />
        <h1 className="mt-4 text-2xl font-bold text-slate-900">VitalDesk Lite</h1>
        <p className="mt-1 text-sm text-slate-500">Panel de la clínica</p>
      </div>

      <StaffLoginForm />

      <p className="mt-8 text-center text-xs text-slate-400">
        ¿Sos paciente?{" "}
        <Link href="/" className="font-semibold text-slate-500 underline">
          Buscá tu clínica
        </Link>
      </p>
    </main>
  );
}
