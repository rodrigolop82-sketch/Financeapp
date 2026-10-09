// PLANTILLA — copia este archivo a la carpeta de la categoría correcta para
// crear un video nuevo (ver README.md → "Crear un video nuevo").
import React from "react";
import { AbsoluteFill } from "remotion";
import { linearTiming, TransitionSeries } from "@remotion/transitions";
import { fade } from "@remotion/transitions/fade";
import { Sparkles } from "lucide-react";
import {
  Background,
  CallToAction,
  FeatureCard,
  Headline,
  Reveal,
  SafeArea,
  SafeZoneGuide,
} from "../../components";
import { sec } from "../../config/formats";

export type PlantillaProps = {
  gancho: string;
  mostrarZonasSeguras: boolean;
};

const T = 12; // frames de cada transición
const SCENES = [sec(3), sec(4), sec(4)]; // duración de cada escena
export const PLANTILLA_DURATION = SCENES.reduce((a, b) => a + b, 0) - T * (SCENES.length - 1);
const transition = linearTiming({ durationInFrames: T });

export const Plantilla: React.FC<PlantillaProps> = ({ gancho, mostrarZonasSeguras }) => (
  <AbsoluteFill>
    <Background />
    <TransitionSeries>
      {/* 1. Gancho: los primeros 3 segundos deciden si la gente se queda */}
      <TransitionSeries.Sequence durationInFrames={SCENES[0]}>
        <SafeArea>
          <Headline text={gancho} size={104} />
        </SafeArea>
      </TransitionSeries.Sequence>
      <TransitionSeries.Transition presentation={fade()} timing={transition} />

      {/* 2. Contenido */}
      <TransitionSeries.Sequence durationInFrames={SCENES[1]}>
        <SafeArea>
          <Reveal from="right" style={{ width: "100%" }}>
            <FeatureCard icon={Sparkles} title="Tu idea aquí" description="Una línea de apoyo" />
          </Reveal>
        </SafeArea>
      </TransitionSeries.Sequence>
      <TransitionSeries.Transition presentation={fade()} timing={transition} />

      {/* 3. Cierre con llamado a la acción */}
      <TransitionSeries.Sequence durationInFrames={SCENES[2]}>
        <CallToAction />
      </TransitionSeries.Sequence>
    </TransitionSeries>
    {mostrarZonasSeguras && <SafeZoneGuide />}
  </AbsoluteFill>
);
