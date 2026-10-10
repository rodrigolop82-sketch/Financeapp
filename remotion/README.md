# Zafi Videos 🎬

Videos animados de **Zafi** hechos con [Remotion](https://www.remotion.dev) (v4.0.534),
en formato vertical **1080 × 1920 (9:16), 30 fps**: listos para **Instagram Reels** y **TikTok**.

Este proyecto es independiente de la app: tiene su propio `package.json` y no se
incluye en el build de Next.js ni en el despliegue de Vercel.

## Empezar

```bash
cd remotion
npm install
npm run dev        # abre Remotion Studio en http://localhost:3000
```

En el Studio verás los videos ordenados por carpeta. Puedes editar los textos
en el código y ver el cambio al instante.

## Exportar videos

```bash
npm run render -- F01-QueEsZafi                       # un video
npm run render -- F01-QueEsZafi G01-EmpiezaEn3Pasos   # varios
npm run render:all                                    # todos (menos la plantilla)
```

Los MP4 quedan en `out/` (esa carpeta no se sube a git). Ya salen en H.264,
calidad alta (CRF 18), listos para subir directo a Instagram/TikTok.

También puedes exportar desde el Studio con el botón **Render**.

## Estructura

```
remotion/
├── src/
│   ├── Root.tsx              ← registro de TODOS los videos (por carpeta)
│   ├── config/formats.ts     ← tamaño 9:16, fps y zonas seguras
│   ├── brand/                ← colores, fuentes y logo de Zafi
│   ├── components/           ← piezas reutilizables (titulares, tarjetas, teléfono, CTA…)
│   └── videos/
│       ├── marca/            ← M## · intros y piezas de identidad
│       ├── funcionalidades/  ← F## · qué hace la app
│       ├── herramientas/     ← H## · una herramienta a fondo (voz, importar, chat…)
│       ├── beneficios/       ← B## · por qué usar Zafi
│       ├── guias/            ← G## · guías prácticas paso a paso
│       └── _plantilla/       ← punto de partida para videos nuevos
├── public/                   ← imágenes, fuentes, música, capturas de la app
│   ├── brand/zafi-icon.png
│   └── fonts/
├── scripts/render.mjs        ← exportación por lotes
└── out/                      ← videos exportados (ignorado por git)
```

### Convención de nombres

`<Letra><Número>-<NombreEnCamelCase>` — por ejemplo `H01-RegistroPorVoz`,
`B02-AhorraSinGanarMas`, `G03-ComoImportarTuEstadoDeCuenta`.

| Letra | Categoría        | Carpeta                 |
| ----- | ---------------- | ----------------------- |
| M     | Marca / intros   | `videos/marca`           |
| C     | Serie "Cómo funciona" | `videos/como-funciona` |
| F     | Funcionalidades  | `videos/funcionalidades` |
| H     | Herramientas     | `videos/herramientas`    |
| B     | Beneficios       | `videos/beneficios`      |
| G     | Guías prácticas  | `videos/guias`           |

## Videos incluidos

| ID                    | Duración | De qué trata                                            |
| --------------------- | -------- | ------------------------------------------------------- |
| `M01-IntroZafi`       | 17 s     | Intro de marca: "¿otra app de gastos? No." → tu asesor financiero personal (diagnóstico, plan, chat) → logo |
| `M02-IntroEditorial`  | 32 s     | Versión editorial con el look de la app (fondo #F3F5F9, serif con itálicas, filas de Movimientos, hero navy): el caos del fin de mes → Zafi te dice qué hacer → diagnóstico, plan, recordatorios, memoria, familia → logo |
| `C00-Zafi60`          | 51 s     | Serie: resumen de toda la app (una escena de cada video y cierre con las 6) |
| `C01-Empieza`         | 36 s     | Serie: registro y onboarding (diagnóstico, salud financiera, plan) |
| `C02-PlanDelMes`      | 34 s     | Serie: ingresos, básico/gustos/metas, editar categoría, inicio de mes |
| `C03-RegistraGastos`  | 32 s     | Serie: escribirlo, dictarlo, estado de cuenta (PDF/foto) y SMS del banco |
| `C04-Aprende`         | 29 s     | Serie: lecciones, temas, "Lo más importante" y Pregúntale a Zafi |
| `C05-Metas`           | 28 s     | Serie: crear meta, cuándo llegas, aportar, metas compartidas |
| `C06-Deudas`          | 29 s     | Serie: total de deudas, trampa del mínimo, bola de nieve vs avalancha |
| `F01-QueEsZafi`       | 21 s     | Gancho + recorrido por funciones principales + CTA      |
| `G01-EmpiezaEn3Pasos` | 21 s     | Guía: ingresos/gastos → registrar gasto → ver progreso  |
| `Plantilla`           | 10 s     | Esqueleto gancho → contenido → cierre                   |

## Crear un video nuevo

1. Copia `src/videos/_plantilla/Plantilla.tsx` a la carpeta de su categoría y
   renómbralo, p. ej. `src/videos/herramientas/H01-RegistroPorVoz.tsx`.
2. Cambia los nombres del componente y de la constante de duración.
3. Regístralo en `src/Root.tsx` dentro del `<Folder>` correspondiente
   (si la carpeta aún no existe, descomenta su bloque):

   ```tsx
   <Folder name="Herramientas">
     <Composition
       id="H01-RegistroPorVoz"
       component={RegistroPorVoz}
       durationInFrames={H01_DURATION}
       {...VERTICAL}
       defaultProps={{ mostrarZonasSeguras: false }}
     />
   </Folder>
   ```

### Piezas disponibles (`src/components`)

- `Background`: fondo azul de marca con luces en movimiento (`variant="light"` para fondo claro).
- `SafeArea`: centra el contenido fuera de las zonas que tapan Instagram/TikTok.
- `Headline`: titular palabra por palabra; pon `*palabras*` entre asteriscos para resaltarlas en azul.
- `Reveal`: hace aparecer cualquier cosa (`from="bottom" | "left" | "right" | "top" | "scale"`, `delay`).
- `FeatureCard` / `IconBubble`: tarjeta con ícono ([lucide](https://lucide.dev/icons)) + título + descripción.
- `PhoneMockup`: marco de teléfono; dentro puedes dibujar una pantalla o poner una captura real con `<Img src={staticFile("capturas/x.png")} />`.
- `LineReveal`, `Typewriter`, `tween`, `easeOut`, `easeInOut` (`kinetic.tsx`): tipografía cinética; líneas que suben detrás de una máscara, texto que se escribe solo y curvas suaves.
- `CountUp`: número que sube (por defecto en `Q`).
- `StepBadge`: etiqueta "PASO 1".
- `CallToAction`: cierre con logo, botón "Empieza gratis" y `zafiapp.com`.

## Serie "Cómo funciona Zafi" (con narración)

Guiones y decisiones en `guiones/serie-como-funciona.md`. Cada video se describe
en `src/videos/como-funciona/C0X-*.tsx` con 4 capítulos y un cierre, sobre el
motor `serie.tsx` (titular que se escribe, tarjetas, transiciones, efectos y
vista alejada final). La duración de cada capítulo sale de su narración.

**Narración:** voz "Julián" de Higgsfield (motor ElevenLabs), un clip por capítulo.
1. Genera los clips y guárdalos en `public/audio/voz/<video>/original/01.mp3 … 05.mp3`
   (01–04 = capítulos, 05 = cierre).
2. Ejecuta `node scripts/preparar-voz.mjs <video>` (requiere `ffmpeg`): nivela el
   volumen, recorta silencios y escribe `src/videos/como-funciona/tiempos/<video>.json`.
3. Ajusta los momentos de cada animación con `v(segundos)` según lo que dice la voz.

**Efectos de sonido:** `python3 scripts/generar-sfx.py` crea `public/audio/sfx/*.wav`
(whoosh, pop, tic, campanita). Son propios, sin licencias de terceros.

**Música:** los videos salen sin música para agregarla al publicar en TikTok/Instagram.

## Tips para Reels y TikTok

- **Zonas seguras:** activa `mostrarZonasSeguras` en las props del video (panel
  derecho del Studio) para ver en rojo lo que tapa la interfaz de la app. Nada
  importante debe quedar ahí.
- **Gancho en 3 segundos:** la primera escena es la que decide si la gente se queda.
- **Duración:** 15–30 s funciona mejor para videos de producto.
- **Texto grande:** mínimo ~60 px para titulares; la mayoría ve sin sonido.
- **Música/voz:** pon el archivo en `public/audio/` y agrégalo con
  `<Audio src={staticFile("audio/pista.mp3")} />` (o súbelo después con la
  música de tendencia de cada plataforma).
- **Portada:** `npx remotion still src/index.ts F01-QueEsZafi out/portada.png --frame=60`.

## Actualizar Remotion

```bash
npm run upgrade
```

Todos los paquetes `remotion` y `@remotion/*` deben tener exactamente la misma versión.
