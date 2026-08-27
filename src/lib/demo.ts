/**
 * ┌──────────────────────────────────────────────────────────────────────┐
 * │  MODO DEMO                                                           │
 * │                                                                      │
 * │  En true, el código de acceso de 6 dígitos se MUESTRA EN PANTALLA    │
 * │  además de intentar enviarse por correo.                             │
 * │                                                                      │
 * │  ⚠️  Mientras esté encendido, cualquiera que abra el link puede      │
 * │      entrar con el correo de otro — incluido el del doctor.          │
 * │      NO usar con pacientes reales.                                   │
 * │                                                                      │
 * │  Está acá y no en una variable de entorno a propósito: así el        │
 * │  cambio queda en el historial de git y se ve en la revisión.         │
 * │                                                                      │
 * │  APAGARLO (poner en false) en cuanto el dominio esté verificado en   │
 * │  Resend y los correos lleguen a cualquier dirección.                 │
 * └──────────────────────────────────────────────────────────────────────┘
 */
export const MODO_DEMO_FORZADO = true;

/** Motivo, para mostrarlo en el cartel de aviso. */
export const MOTIVO_DEMO =
  "Todavía no hay dominio verificado en Resend, así que el correo solo llega a la cuenta dueña.";
