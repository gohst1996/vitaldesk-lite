"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const items = [
  { href: "/panel", label: "Bandeja", icon: "inbox" as const, exact: true },
  { href: "/panel/agenda", label: "Agenda", icon: "calendar" as const },
  { href: "/panel/nueva", label: "Agendar", icon: "plus" as const },
  { href: "/panel/pacientes", label: "Pacientes", icon: "users" as const },
];

export function BottomNav({ pending }: { pending: number }) {
  const pathname = usePathname();

  return (
    <nav className="safe-bottom fixed inset-x-0 bottom-0 z-30 border-t border-slate-200 bg-white/95 backdrop-blur">
      <ul className="mx-auto flex max-w-lg">
        {items.map((it) => {
          const active = it.exact
            ? pathname === it.href
            : pathname.startsWith(it.href);
          return (
            <li key={it.href} className="flex-1">
              <Link
                href={it.href}
                className={`relative flex flex-col items-center gap-1 py-2.5 text-[11px] font-semibold transition ${
                  active ? "text-brand-700" : "text-slate-400"
                }`}
              >
                <span className="relative">
                  <Icon name={it.icon} active={active} />
                  {it.icon === "inbox" && pending > 0 && (
                    <span className="absolute -top-1 -right-2 flex min-w-4.5 items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] leading-4 font-bold text-white">
                      {pending > 9 ? "9+" : pending}
                    </span>
                  )}
                </span>
                {it.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

function Icon({
  name,
  active,
}: {
  name: "inbox" | "calendar" | "plus" | "users";
  active: boolean;
}) {
  const common = {
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: active ? 2 : 1.6,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    className: "size-5.5",
  };
  if (name === "inbox")
    return (
      <svg {...common}>
        <path d="M3 13h4l2 3h6l2-3h4" />
        <path d="M4.5 5h15l1.5 8v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4L4.5 5Z" />
      </svg>
    );
  if (name === "calendar")
    return (
      <svg {...common}>
        <rect x="3" y="5" width="18" height="16" rx="3" />
        <path d="M8 3v4M16 3v4M3 10h18" />
      </svg>
    );
  if (name === "plus")
    return (
      <svg {...common}>
        <circle cx="12" cy="12" r="9" />
        <path d="M12 8v8M8 12h8" />
      </svg>
    );
  return (
    <svg {...common}>
      <circle cx="9" cy="8" r="3.2" />
      <path d="M3 20a6 6 0 0 1 12 0" />
      <path d="M16 5.2a3 3 0 0 1 0 5.6M17.5 20a5.6 5.6 0 0 0-2-4.2" />
    </svg>
  );
}
