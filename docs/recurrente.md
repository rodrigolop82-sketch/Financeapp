# Cobros con Recurrente

La app solo conoce `lib/billing` (`billing()` → `BillingProvider`). La única implementación es `lib/billing/recurrente.ts`.

## Configuración

1. En Recurrente (primero en un Sandbox) crea 4 productos con cobro recurrente, en USD:

   | Producto | Precio | Variable |
   |---|---|---|
   | Premium mensual | $4.99 / mes | `RECURRENTE_PRODUCT_PREMIUM_MONTHLY` |
   | Premium anual | $39.99 / año | `RECURRENTE_PRODUCT_PREMIUM_ANNUAL` |
   | Familiar mensual | $6.99 / mes | `RECURRENTE_PRODUCT_FAMILY_MONTHLY` |
   | Familiar anual | $54.99 / año | `RECURRENTE_PRODUCT_FAMILY_ANNUAL` |

   **Sin prueba gratis en el producto.** La prueba de 14 días es de la app (`users.trial_ends_at`).
   Guarda en cada variable el id del **precio** (`price_…`). Si guardas el del producto (`prod_…`), el checkout lo manda como `product_id`.

2. Variables de entorno en Vercel:
   `RECURRENTE_SECRET_KEY`, `RECURRENTE_PUBLIC_KEY`, `RECURRENTE_WEBHOOK_SECRET` (`whsec_…`), las 4 de productos y `CRON_SECRET`.
   Son opcionales `RECURRENTE_API_URL` (por defecto `https://app.recurrente.com/api`) y `RECURRENTE_UPDATE_CARD_URL` (el link de "Cambiar tarjeta" si Recurrente no lo da por API).

3. Webhook: en *Configuración → Desarrolladores y API → Webhooks*, agrega `https://<app>/api/billing/webhook` con los eventos de suscripción, intent y refund.

4. Corre la migración `supabase/migrations/20261014_planes_recurrente.sql`.

5. Cron: `vercel.json` llama a `/api/cron/billing` todos los días a las 12:00 UTC.
   El cron cancela en Recurrente las suscripciones marcadas "al terminar el periodo" (36 h antes de que venzan) y baja a Gratis a quien ya terminó lo pagado.

## Cómo funciona

- `POST /api/billing/checkout` `{ tier, cycle }` abre el checkout con `metadata: { user_id, tier, cycle }` y guarda la fila en `billing_checkouts`. Si ya hay un plan activo, responde 409.
- `POST /api/billing/webhook` hace esto:
  1. Verifica la firma Svix.
  2. Revisa la idempotencia con `billing_events` (por `svix-id`).
  3. Confirma el estado con `GET /checkouts/{id}` y `GET /subscriptions/{id}`.
  4. Aplica el evento (`lib/billing/service.ts`).
- `POST /api/billing/change-plan` es un cambio de plan calculado por la app:
  - Calcula el crédito: `last_amount_cents × tiempo restante / duración del periodo`.
  - Abre el checkout del plan nuevo.
  - Cuando llega el pago del nuevo, cancela el viejo y reembolsa el crédito, una sola vez.
- `POST /api/billing/cancel` marca `cancel_at_period_end`; el cron hace la cancelación real. Con `{ undo: true }` se deshace.
- `GET /api/billing/update-card` da el link para cambiar la tarjeta, o 404. Sin link, la app abre un correo a soporte.

## Por confirmar en docs.recurrente.com

Las docs no se pudieron leer desde el entorno donde se escribió la integración (la red las bloqueó). Lo de abajo salió del SDK no oficial de Laravel y del módulo de Odoo. Revísalo en el Sandbox antes de producción:

- [ ] El formato de `items` en `POST /checkouts`: `{ price_id }` o `{ product_id }`. También que `metadata` vuelva en `GET /checkouts/{id}`.
- [ ] Los nombres de los eventos unificados. `mapEventType` acepta `subscription.create|cancel|past_due|paused`, `intent.succeeded|failed`, los `payment_intent.*` legacy y `refund.create`.
- [ ] Dónde trae cada evento el id de la suscripción y el periodo. `normalizeRecurrentePayload` busca en varias rutas, y el webhook completa con la API.
- [ ] Si `DELETE /subscriptions/{id}` acepta cancelar al terminar el periodo. Hoy lo hace el cron.
- [ ] El reembolso parcial: `POST /refunds { intent_id, amount_in_cents }`. Solo con tarjeta, dentro de 30 días y según el procesador.
- [ ] Si hay cambio nativo de producto o monto en una suscripción activa. Si existe, `change-plan` puede usarlo.
- [ ] El link de "Cambiar tarjeta de suscripción".

## Pruebas de aceptación (Sandbox + Test Clocks)

- [ ] El checkout activa el plan (`users.plan`, `subscriptions`; en Familiar, los miembros con `access='full'`).
- [ ] La renovación mantiene el plan.
- [ ] Un rechazo deja `past_due` y muestra el aviso "No pudimos cobrar". La recuperación lo limpia.
- [ ] La cancelación baja a Gratis al final del periodo, y los miembros pasan a solo ver.
- [ ] Un webhook repetido no duplica nada.
- [ ] Premium→Familiar reembolsa el prorrateo.
