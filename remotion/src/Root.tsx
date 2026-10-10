// Registro de todos los videos de Zafi. Cada <Folder> aparece como una
// carpeta en el Studio. Para agregar un video: impórtalo y añade una
// <Composition> en la carpeta de su categoría.
import React from "react";
import { Composition, Folder } from "remotion";
import { VERTICAL } from "./config/formats";
import { QueEsZafi, F01_DURATION } from "./videos/funcionalidades/F01-QueEsZafi";
import { EmpiezaEn3Pasos, G01_DURATION } from "./videos/guias/G01-EmpiezaEn3Pasos";
import { IntroZafi, M01_DURATION } from "./videos/marca/M01-IntroZafi";
import { IntroEditorial, M02_DURATION } from "./videos/marca/M02-IntroEditorial";
import { MockupSerie, MOCKUP_FRAMES } from "./videos/como-funciona/Mockup";
import { PruebaVoz, PRUEBA_DURATION } from "./videos/como-funciona/PruebaVoz";
import { Plantilla, PLANTILLA_DURATION } from "./videos/_plantilla/Plantilla";

export const RemotionRoot: React.FC = () => (
  <>
    {/* M — Marca: intros y piezas de identidad */}
    <Folder name="Marca">
      <Composition
        id="M01-IntroZafi"
        component={IntroZafi}
        durationInFrames={M01_DURATION}
        {...VERTICAL}
        defaultProps={{ mostrarZonasSeguras: false }}
      />
      <Composition
        id="M02-IntroEditorial"
        component={IntroEditorial}
        durationInFrames={M02_DURATION}
        {...VERTICAL}
        defaultProps={{ mostrarZonasSeguras: false }}
      />
    </Folder>

    {/* F — Funcionalidades: qué hace la app */}
    <Folder name="Funcionalidades">
      <Composition
        id="F01-QueEsZafi"
        component={QueEsZafi}
        durationInFrames={F01_DURATION}
        {...VERTICAL}
        defaultProps={{ mostrarZonasSeguras: false }}
      />
    </Folder>

    {/* H — Herramientas: una herramienta a fondo (voz, importar, chat…)
        <Folder name="Herramientas"> … </Folder> */}

    {/* B — Beneficios: por qué usar Zafi
        <Folder name="Beneficios"> … </Folder> */}

    {/* G — Guías prácticas: cómo hacer algo paso a paso */}
    <Folder name="Guias">
      <Composition
        id="G01-EmpiezaEn3Pasos"
        component={EmpiezaEn3Pasos}
        durationInFrames={G01_DURATION}
        {...VERTICAL}
        defaultProps={{ mostrarZonasSeguras: false }}
      />
    </Folder>

    {/* C — Serie "Cómo funciona Zafi" */}
    <Folder name="ComoFunciona">
      <Composition id="C-Mockup" component={MockupSerie} durationInFrames={MOCKUP_FRAMES} {...VERTICAL} />
      <Composition
        id="C-PruebaVoz-Mujer"
        component={PruebaVoz}
        durationInFrames={PRUEBA_DURATION}
        {...VERTICAL}
        defaultProps={{ voz: "mujer" as const, conAudio: true, mostrarZonasSeguras: false }}
      />
      <Composition
        id="C-PruebaVoz-Hombre"
        component={PruebaVoz}
        durationInFrames={PRUEBA_DURATION}
        {...VERTICAL}
        defaultProps={{ voz: "hombre" as const, conAudio: true, mostrarZonasSeguras: false }}
      />
    </Folder>

    <Folder name="Plantilla">
      <Composition
        id="Plantilla"
        component={Plantilla}
        durationInFrames={PLANTILLA_DURATION}
        {...VERTICAL}
        defaultProps={{
          gancho: "¿Sabías que puedes *ahorrar más* sin ganar más?",
          mostrarZonasSeguras: true,
        }}
      />
    </Folder>
  </>
);
