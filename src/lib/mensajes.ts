/** Textos para el usuario cuando no se pudo emitir un código de acceso. */
export function mensajeDeFallo(
  r:
    | { error: "rate_limited"; retryAfterMinutes: number }
    | { error: "mail_failed" },
): string {
  if (r.error === "mail_failed") {
    return "No pudimos enviarte el correo. Revisá la dirección o probá de nuevo en un momento.";
  }
  return `Pediste demasiados códigos. Probá de nuevo en ${r.retryAfterMinutes} minutos.`;
}
