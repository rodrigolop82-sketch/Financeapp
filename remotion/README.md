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
| F     | Funcionalidades  | `videos/funcionalidades` |
| H     | Herramientas     | `videos/herramientas`    |
| B     | Beneficios       | `videos/beneficios`      |
| G     | Guías prácticas  | `videos/guias`           |

## Videos incluidos

| ID                    | Duración | De qué trata                                            |
| --------------------- | -------- | ------------------------------------------------------- |
| `M01-IntroZafi`       | 17 s     | Intro de marca: "¿otra app de gastos? No." → tu asesor financiero personal (diagnóstico, plan, chat) → logo |
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
