function required(name: string, fallback?: string): string {
  const v = process.env[name] ?? fallback;
  if (!v) throw new Error(`Falta la variable de entorno ${name}`);
  return v;
}

export const env = {
  get databaseUrl() {
    return required("DATABASE_URL");
  },
  get authSecret() {
    const s = required(
      "AUTH_SECRET",
      process.env.NODE_ENV === "production" ? undefined : "dev-secret-local",
    );
    if (process.env.NODE_ENV === "production" && s.length < 32) {
      throw new Error("AUTH_SECRET debe tener al menos 32 caracteres");
    }
    return s;
  },
  get appUrl() {
    return process.env.APP_URL ?? "http://localhost:3000";
  },
  get mailFrom() {
    return process.env.MAIL_FROM ?? "VitalDesk Lite <no-reply@vitaldesk.app>";
  },
  get smtp() {
    const host = process.env.SMTP_HOST;
    if (!host) return null;
    return {
      host,
      port: Number(process.env.SMTP_PORT ?? 587),
      user: process.env.SMTP_USER ?? "",
      pass: process.env.SMTP_PASS ?? "",
    };
  },
  /**
   * Muestra el codigo en pantalla en vez de depender del correo.
   * Solo se activa si SHOW_DEV_CODE=true Y ademas no hay SMTP configurado —
   * o sea, en local y en un deploy de demo. Apenas configures SMTP se apaga
   * solo, aunque la variable siga en "true".
   */
  get showDevCode() {
    return process.env.SHOW_DEV_CODE === "true" && !process.env.SMTP_HOST;
  },
};
