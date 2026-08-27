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
  /**
   * URL pública, para los links dentro de los correos. Si APP_URL no está
   * cargada, Vercel siempre expone VERCEL_URL, así que la derivamos de ahí.
   */
  get appUrl() {
    const explicita = process.env.APP_URL?.trim();
    if (explicita) return explicita.replace(/\/$/, "");
    const vercel = process.env.VERCEL_URL?.trim();
    if (vercel) return `https://${vercel.replace(/^https?:\/\//, "")}`;
    return "http://localhost:3000";
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
   * Muestra el código en pantalla en vez de mandarlo por correo.
   *
   * Se enciende solo cuando NO hay SMTP configurado, porque en ese caso los
   * códigos no llegan a ningún lado y la app sería inusable. Apenas configurás
   * SMTP_HOST se apaga solo — no hay que acordarse de nada.
   *
   * Se puede forzar apagado con SHOW_DEV_CODE="false".
   *
   * ⚠️ Mientras esté encendido, cualquiera que abra el link ve el código y
   * puede entrar con el correo de otro. No usar con pacientes reales.
   */
  get showDevCode() {
    if (process.env.SHOW_DEV_CODE?.trim() === "false") return false;
    return !process.env.SMTP_HOST?.trim();
  },
};
