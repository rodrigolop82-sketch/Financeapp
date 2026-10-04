# Atajo de iOS “Registrar en Zafi” (Apple Pay)

Cada pago con Apple Pay dispara una automatización de Atajos (iOS 17+) que manda el monto, el comercio y la tarjeta a Zafi. Zafi crea el gasto (`source = 'apple_pay'`), usa la categoría recordada para ese comercio si existe y manda el aviso “Registramos {Q} en {comercio} con Apple Pay. Toca para elegir categoría.”.

## API

`POST https://zafiapp.com/api/parse-notification`

- Header `Authorization: Bearer zafi_…`: la clave personal. Se genera en **Mis bancos › Apple Pay** y se muestra una sola vez.
- Header `Content-Type: application/json`
- Cuerpo:

```json
{ "amount": "Q 85.00", "merchant": "Starbucks Oakland", "card": "BI Visa ··4821", "date": "2026-10-04T09:41:00-06:00" }
```

| Campo | Obligatorio | Notas |
|---|---|---|
| `amount` | sí | Número o texto tal como lo da Wallet (`Q 85.00`, `$12.50`, `85,50`). Con `$`/`USD` se convierte a quetzales. Debe estar entre 0 y 1,000,000. |
| `merchant` | no | Si falta, se guarda como “Apple Pay”. |
| `card` | no | Nombre de la tarjeta de Wallet; se muestra en la hoja de confirmación. |
| `date` | no | ISO 8601 (`AAAA-MM-DD` o con hora y zona). Sin fecha, se toma hoy. Se rechaza si es de más de un año atrás o de más de un día adelante. |

Respuestas: `201` con `{ ok, id, message, category, categorized }`; `400` si el monto o la fecha no son válidos; `401` si la clave no existe o fue revocada; `429` si pasan 30 pagos en una hora con la misma clave.

## Construir el atajo

1. En el iPhone, abre **Atajos › Atajos › +** y nómbralo **Registrar en Zafi**.
2. La automatización “Transacción” le pasa el pago de Wallet como **Entrada del atajo**. Sus propiedades son **Monto**, **Comercio**, **Nombre** y **Tarjeta o pase**: tócala en cada acción para elegir la que corresponde.
3. Agrega las acciones:
   1. Tres variables de la **Entrada del atajo**: **Monto**, **Comercio** y **Tarjeta o pase**.
   2. **Fecha actual** → **Formatear fecha** con formato **ISO 8601** (incluye la hora).
   3. **Texto** con la clave: `zafi_…` (en la versión publicada, usa una **Pregunta de importación** para que cada persona pegue la suya al instalarlo).
   4. **Diccionario** con las claves `amount` (Monto), `merchant` (Comercio), `card` (Tarjeta) y `date` (Fecha formateada).
   5. **Obtener contenido de URL**:
      - URL: `https://zafiapp.com/api/parse-notification`
      - Método: **POST**
      - Encabezados: `Authorization` = `Bearer ` + la variable Texto de la clave; `Content-Type` = `application/json`
      - Cuerpo de la solicitud: **JSON**, con el Diccionario anterior.
   6. Opcional: **Obtener valor del diccionario** `message` del resultado y **Mostrar notificación** con él (útil si la persona no activó los avisos de Zafi).
4. Prueba el atajo con ▶: debe aparecer un gasto en Movimientos.

## Automatización

1. **Atajos › Automatización › Nueva automatización › Transacción**.
2. Marca las tarjetas de Wallet que quieres registrar (y, si quieres, las categorías de comercio).
3. Elige **Ejecutar de inmediato** (así no pregunta en cada pago) y desactiva **Notificar al ejecutar**.
4. Como acción, elige el atajo **Registrar en Zafi**.

## Publicar

1. En el atajo, **Compartir › Copiar enlace de iCloud**. La clave debe ir como **Pregunta de importación** (Detalles del atajo › Configurar este atajo): nunca publiques un atajo con una clave real dentro.
2. Pon el enlace en la variable de entorno `NEXT_PUBLIC_APPLE_PAY_SHORTCUT_URL` (Vercel) y vuelve a desplegar: el botón “Instalar el atajo de Zafi” de **Mis bancos › Apple Pay** lo abre. Sin la variable, el botón aparece deshabilitado.
3. Si cambia la URL de la API o el formato, publica una versión nueva del atajo y actualiza el enlace.

## Revocar

En **Mis bancos › Apple Pay › Revocar** la clave deja de funcionar al instante (`401`). Hay 6 segundos para “Deshacer”. Para seguir registrando pagos, genera otra clave y pégala en el atajo.
