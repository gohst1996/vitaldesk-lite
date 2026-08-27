import { redirect } from "next/navigation";
import { Logo } from "@/components/ui";
import { StaffVerifyForm } from "./staff-verify-form";

export default async function StaffVerifyPage({
  searchParams,
}: {
  searchParams: Promise<{ email?: string; dev?: string }>;
}) {
  const { email, dev } = await searchParams;
  if (!email) redirect("/panel/entrar");

  return (
    <main className="safe-top mx-auto flex w-full max-w-lg flex-1 flex-col justify-center px-4 py-10">
      <div className="mb-8 text-center">
        <Logo className="mx-auto size-12" />
        <h1 className="mt-4 text-2xl font-bold text-slate-900">Revisá tu correo</h1>
      </div>
      <StaffVerifyForm email={email} devCode={dev} />
    </main>
  );
}
