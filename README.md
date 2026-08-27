# VitalDesk Lite

Agenda de citas para clínicas dentales y médicas, hecha para el celular.

El paciente pide su cita con nombre y correo. La solicitud queda **en espera**
hasta que el doctor la revise: la confirma, propone otra fecha o la rechaza.
Todo por web — el paciente abre un link y, si quiere, lo agrega a la pantalla de
inicio como cualquier app. Sin App Store, sin Play Store, sin contraseñas.

Es un producto aparte de VitalDesk Full, con el esquema de base de datos
compatible para poder migrar un cliente de un plan al otro con un script.

---

## Cómo funciona

### El paciente

1. Abre `tuapp.com/c/tu-clinica` (el link que la clínica manda por WhatsApp).
2. Llena un registro corto: **nombre y correo**. Teléfono y descripción son
   opcionales.
3. Elige el día y la hora que le sirven.
4. Le llega un **código de 6 dígitos** al correo. Lo escribe.
   → Recién ahí se crea la cita. Un correo falso nunca llega a la bandeja del
   doctor.
5. La cita queda **En espera**. Le avisamos por correo cuando la clínica
   responda.

### La clínica

- **Bandeja** — todo lo que espera respuesta, lo más viejo primero.
- Sobre cada solicitud: **Confirmar**, **Proponer otra fecha** o **Rechazar**.
  Cada una manda su propio correo al paciente.
- Si el doctor propone otra fecha, el paciente la **acepta** o **propone una
  tercera**, y vuelve a la bandeja.
- **Agenda** — lo confirmado, agrupado por día.
- **Agendar** — la asistente carga una cita con los datos del cliente cuando
  llama o llega al mostrador. Puede dejarla confirmada de una.
- **Pacientes** — la lista, con buscador.

### Estados de una cita

```
                    ┌──────────────► CONFIRMADA ──► ATENDIDA / NO ASISTIÓ
                    │                    ▲
  EN ESPERA ────────┤                    │ el paciente acepta
      ▲             │                    │
      │             └──► REPROGRAMADA ───┘
      │                       │
      └───────────────────────┘
       el paciente propone otra

  EN ESPERA ──► RECHAZADA        (la clínica no pudo)
  cualquiera ──► CANCELADA       (el paciente o la clínica)
```

Cada cambio se guarda en una **bitácora append-only** (`appointment_events`):
nunca se edita ni se borra una fila, solo se agregan. El paciente ve su
historial; la clínica ve la bitácora completa.

---

## El login

Un solo mecanismo para pacientes y para la clínica: **código al correo**.

- 6 dígitos, vencen a los **10 minutos**, sirven **una sola vez**.
- Se guardan como `sha256(código + AUTH_SECRET)` — nunca en texto plano.
- Máximo **5 intentos** por código y **5 códigos por correo cada 15 minutos**.
- La comparación es de tiempo constante (`timingSafeEqual`).
- La sesión es un JWT firmado (HS256) en una cookie `httpOnly`, `sameSite=lax`,
  `secure` en producción, que dura 30 días.

No hay contraseñas que resetear, ni que el paciente olvide, ni que se filtren.

---

## Stack

| Pieza      | Qué se usó                                     |
| ---------- | ---------------------------------------------- |
| Framework  | Next.js 16 (App Router, Server Actions)        |
| Lenguaje   | TypeScript                                     |
| Base       | PostgreSQL + Drizzle ORM                       |
| Estilos    | Tailwind CSS 4                                 |
| Sesiones   | `jose` (JWT en cookie httpOnly)                |
| Correo     | `nodemailer` sobre cualquier SMTP              |
| Validación | `zod` en cada Server Action                    |

Un solo repo, un solo deploy. Sin binarios nativos: corre en Vercel, Render,
Fly, Railway o un VPS con Node 20+.

---

## Correr en local

```bash
# 1. Dependencias
npm install

# 2. Configuración
cp .env.example .env
#    Poné tu DATABASE_URL y un AUTH_SECRET (openssl rand -base64 32).
#    Dejá SHOW_DEV_CODE="true" para probar sin correo.

# 3. Base de datos
npm run db:migrate

# 4. Datos de demo
npm run seed

# 5. Arrancar
npm run dev
```

Abrí <http://localhost:3000>.

### Cuentas de demo

| Rol       | Correo               |
| --------- | -------------------- |
| Dentista  | `dentista@demo.cr`   |
| Asistente | `asistente@demo.cr`  |
| Paciente  | `maria@demo.cr`      |

Con `SHOW_DEV_CODE="true"` y sin SMTP, el código sale **en pantalla** y en la
consola del servidor. También se guarda en `.mailbox.log`.

### Scripts

| Comando               | Qué hace                                     |
| --------------------- | -------------------------------------------- |
| `npm run dev`         | Servidor de desarrollo                       |
| `npm run build`       | Build de producción                          |
| `npm start`           | Servir el build                              |
| `npm run lint`        | Typecheck con `tsc --noEmit`                 |
| `npm run db:generate` | Genera la migración a partir del esquema      |
| `npm run db:migrate`  | Aplica las migraciones pendientes            |
| `npm run db:studio`   | Explorador visual de la base                 |
| `npm run seed`        | Datos de demo (idempotente)                  |

---

## Deploy

Ver [DEPLOY.md](./DEPLOY.md) — Neon + Vercel, en free tier, paso a paso.

Resumen:

1. Base Postgres en Neon → copiar la connection string.
2. Push del repo a GitHub → importar en Vercel.
3. Cargar `DATABASE_URL`, `AUTH_SECRET`, `APP_URL` y el SMTP.
4. `npm run db:migrate` una vez contra la base de producción.
5. Crear la clínica y su doctor con `npm run seed` o a mano.

---

## Estructura

```
src/
├── actions/              Server Actions (el único camino que escribe)
│   ├── patient.ts        pedir cita, verificar código, aceptar/rechazar
│   └── staff.ts          login, confirmar, reprogramar, agendar
├── app/
│   ├── c/[slug]/         lo que ve el paciente
│   │   ├── pedir/        el registro corto
│   │   ├── verificar/    el código de 6 dígitos
│   │   └── citas/[id]/   detalle, aceptar propuesta, cancelar
│   └── panel/            lo que ve la clínica
│       ├── entrar/       login por correo
│       └── (app)/        bandeja, agenda, agendar, pacientes
├── components/           UI compartida (SlotPicker, CodeInput, badges…)
├── db/
│   ├── schema.ts         las 6 tablas
│   └── index.ts          pool de conexión
└── lib/
    ├── appointment-service.ts   las transiciones de estado + correos
    ├── appointment-status.ts    etiquetas y reglas de cada estado
    ├── auth-codes.ts            generar y verificar códigos
    ├── dates.ts                 zonas horarias y franjas
    ├── mailer.ts                SMTP + plantillas HTML
    ├── queries.ts               lecturas
    └── session.ts               JWT en cookie
```

Nada escribe en la base fuera de `src/actions/` y
`src/lib/appointment-service.ts`. Cada Server Action valida con `zod` antes de
tocar nada, y toda consulta filtra por `clinicId` o `patientId` de la sesión.

---

## Multi-clínica

Cada clínica es un tenant con su `slug`. La sesión guarda `clinicId`, y toda
consulta lo usa como filtro: un doctor nunca ve las citas de otra clínica y un
paciente nunca ve las de otro paciente. Está cubierto por pruebas.

Para agregar una clínica, insertá una fila en `clinics` y otra en `staff`
(rol `DOCTOR`) con el correo de quien va a entrar. Esa persona entra en
`/panel/entrar` con ese correo y ya.

---

## Lo que falta para cobrar

- [ ] Backups automáticos (`pg_dump` programado) antes de meter pacientes
      reales.
- [ ] Recordatorio automático 24 h antes de la cita.
- [ ] Pantalla para que la clínica edite su horario sin tocar la base.
- [ ] Exportar la agenda a `.ics`.
- [ ] Métricas: cuántas citas se confirman, cuántas se reprograman, no-shows.
