import Link from "next/link";
import type { ReactNode } from "react";
import { STATUS } from "@/lib/appointment-status";
import type { AppointmentStatus } from "@/db/schema";

export function StatusBadge({
  status,
  forPatient = false,
}: {
  status: AppointmentStatus;
  forPatient?: boolean;
}) {
  const s = STATUS[status];
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset ${s.badge}`}
    >
      <span className={`size-1.5 rounded-full ${s.dot}`} />
      {forPatient ? s.patientLabel : s.label}
    </span>
  );
}

export function AppHeader({
  title,
  subtitle,
  back,
  action,
}: {
  title: string;
  subtitle?: string;
  back?: string;
  action?: ReactNode;
}) {
  return (
    <header className="safe-top sticky top-0 z-20 border-b border-slate-200/70 bg-white/85 backdrop-blur">
      <div className="mx-auto flex max-w-lg items-center gap-3 px-4 py-3">
        {back && (
          <Link
            href={back}
            aria-label="Volver"
            className="-ml-2 flex size-9 shrink-0 items-center justify-center rounded-full text-slate-500 transition hover:bg-slate-100"
          >
            <svg viewBox="0 0 20 20" fill="none" className="size-5">
              <path
                d="M12.5 15.5 7 10l5.5-5.5"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </Link>
        )}
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-base font-bold text-slate-900">{title}</h1>
          {subtitle && (
            <p className="truncate text-xs text-slate-500">{subtitle}</p>
          )}
        </div>
        {action}
      </div>
    </header>
  );
}

export function Screen({ children }: { children: ReactNode }) {
  return (
    <main className="mx-auto w-full max-w-lg flex-1 px-4 pt-4 pb-24">
      {children}
    </main>
  );
}

export function EmptyState({
  icon,
  title,
  body,
  action,
}: {
  icon?: ReactNode;
  title: string;
  body?: string;
  action?: ReactNode;
}) {
  return (
    <div className="card flex flex-col items-center px-6 py-12 text-center">
      <div className="mb-3 flex size-12 items-center justify-center rounded-full bg-slate-100 text-slate-400">
        {icon ?? (
          <svg viewBox="0 0 24 24" fill="none" className="size-6">
            <rect
              x="3"
              y="5"
              width="18"
              height="16"
              rx="3"
              stroke="currentColor"
              strokeWidth="1.6"
            />
            <path
              d="M8 3v4M16 3v4M3 10h18"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinecap="round"
            />
          </svg>
        )}
      </div>
      <p className="font-semibold text-slate-800">{title}</p>
      {body && <p className="mt-1 text-sm text-slate-500">{body}</p>}
      {action && <div className="mt-5 w-full">{action}</div>}
    </div>
  );
}

export function Alert({
  tone = "info",
  children,
}: {
  tone?: "info" | "success" | "warn" | "error";
  children: ReactNode;
}) {
  const tones = {
    info: "bg-slate-50 text-slate-700 ring-slate-200",
    success: "bg-teal-50 text-teal-800 ring-teal-200",
    warn: "bg-amber-50 text-amber-800 ring-amber-200",
    error: "bg-rose-50 text-rose-800 ring-rose-200",
  } as const;
  return (
    <div
      role="status"
      className={`rounded-xl px-4 py-3 text-sm ring-1 ring-inset ${tones[tone]}`}
    >
      {children}
    </div>
  );
}

export function Field({
  label,
  hint,
  children,
  optional,
}: {
  label: string;
  hint?: string;
  optional?: boolean;
  children: ReactNode;
}) {
  return (
    <div>
      <span className="label">
        {label}
        {optional && (
          <span className="ml-1.5 font-normal text-slate-400">(opcional)</span>
        )}
      </span>
      {children}
      {hint && <p className="mt-1.5 text-xs text-slate-500">{hint}</p>}
    </div>
  );
}

export function Logo({ className = "size-8" }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" fill="none" className={className} aria-hidden>
      <rect width="32" height="32" rx="9" className="fill-brand-600" />
      <path
        d="M8 17h3.4l2-4.6 2.9 8.2 2.3-5.4 1.5 1.8H24"
        stroke="white"
        strokeWidth="2.1"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
