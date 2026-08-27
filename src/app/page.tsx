import Link from "next/link";
import { Logo, Screen } from "@/components/ui";
import { listClinics } from "@/lib/queries";

// La lista de clínicas sale de la base, no se puede prerenderizar.
export const dynamic = "force-dynamic";

export default async function Home() {
  const clinics = await listClinics();

  return (
    <>
      <header className="safe-top border-b border-slate-200/70 bg-white">
        <div className="mx-auto flex max-w-lg items-center gap-3 px-4 py-4">
          <Logo />
          <div>
            <p className="font-bold text-slate-900">VitalDesk Lite</p>
            <p className="text-xs text-slate-500">Citas por celular</p>
          </div>
        </div>
      </header>

      <Screen>
        <section className="card animate-in-up overflow-hidden">
          <div className="bg-linear-to-br from-brand-600 to-brand-700 px-5 py-8 text-white">
            <h1 className="text-2xl leading-tight font-bold">
              Tu clínica, en el celular del paciente
            </h1>
            <p className="mt-2 text-sm text-brand-50/90">
              El paciente pide su cita con nombre y correo. El doctor la confirma
              o propone otra fecha. Sin apps que instalar.
            </p>
          </div>
        </section>

        <section className="mt-5">
          <h2 className="mb-2.5 px-1 text-xs font-semibold tracking-wide text-slate-500 uppercase">
            Clínicas
          </h2>
          {clinics.length === 0 ? (
            <div className="card px-5 py-8 text-center text-sm text-slate-500">
              Todavía no hay clínicas cargadas. Corré{" "}
              <code className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-xs">
                npm run seed
              </code>
              .
            </div>
          ) : (
            <ul className="card divide-y divide-slate-100">
              {clinics.map((c) => (
                <li key={c.id}>
                  <Link
                    href={`/c/${c.slug}`}
                    className="flex items-center justify-between gap-3 px-4 py-4 transition active:bg-slate-50"
                  >
                    <div className="min-w-0">
                      <p className="truncate font-semibold text-slate-900">
                        {c.name}
                      </p>
                      <p className="truncate text-xs text-slate-500">
                        {c.kind === "DENTAL"
                          ? "Clínica dental"
                          : c.kind === "MEDICAL"
                            ? "Clínica médica"
                            : "Clínica"}
                        {c.address ? ` · ${c.address}` : ""}
                      </p>
                    </div>
                    <span className="shrink-0 text-slate-300">→</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="mt-5 rounded-2xl bg-slate-200/50 px-5 py-4">
          <p className="text-sm leading-relaxed text-slate-600">
            En producción cada clínica comparte su link directo{" "}
            <code className="rounded bg-white px-1.5 py-0.5 font-mono text-xs">
              /c/su-clinica
            </code>{" "}
            por WhatsApp. Esta lista es solo para la demo.
          </p>
        </section>

        <p className="mt-6 text-center text-xs text-slate-400">
          <Link href="/panel/entrar" className="font-semibold text-slate-500 underline">
            Entrar al panel de la clínica
          </Link>
        </p>
      </Screen>
    </>
  );
}
