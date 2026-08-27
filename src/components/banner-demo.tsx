import { MODO_DEMO_FORZADO } from "@/lib/demo";

/**
 * Franja de aviso mientras el modo demo está encendido.
 *
 * Va arriba de todo y en todas las pantallas a propósito: un modo donde el
 * código de acceso se ve en pantalla no puede quedar encendido sin que se note.
 */
export function BannerDemo() {
  if (!MODO_DEMO_FORZADO) return null;

  return (
    <div className="safe-top bg-amber-400 text-amber-950">
      <div className="mx-auto flex max-w-lg items-start gap-2.5 px-4 py-2">
        <svg
          viewBox="0 0 24 24"
          fill="none"
          aria-hidden
          className="mt-0.5 size-4 shrink-0"
        >
          <path
            d="M12 9v4m0 3.5h.01M10.3 3.9 2.4 17.5A2 2 0 0 0 4.1 20.5h15.8a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
        <p className="text-[12.5px] leading-snug font-medium">
          <strong className="font-bold">Modo demo.</strong> El código de acceso
          se muestra en pantalla — cualquiera puede entrar con el correo de otro.
          No cargues pacientes reales.
        </p>
      </div>
    </div>
  );
}
