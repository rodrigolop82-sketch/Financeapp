// C00 · Zafi en 60 segundos.
// Resumen de toda la serie: reutiliza una escena de cada video (C01–C06)
// con su propia narración y cierra con la vista alejada de las 6 escenas.
import React from "react";
import { fonts } from "../../brand/theme";
import { Diagnostico } from "./C01-Empieza";
import { EmpiezaMes } from "./C02-PlanDelMes";
import { Escribelo } from "./C03-RegistraGastos";
import { Pregunta } from "./C04-Aprende";
import { Cuando } from "./C05-Metas";
import { Estrategia } from "./C06-Deudas";
import { CardIn, SerieProps, SerieVideo, v, VideoDef, videoLength } from "./serie";
import tiempos from "./tiempos/c00.json";
import { Card, EmojiTile, z } from "./ui";

/* 00 — Gancho: las 6 cosas que hace Zafi */
const FEATURES = [
  { e: "🩺", l: "Diagnóstico" },
  { e: "🗓️", l: "Plan del mes" },
  { e: "✍️", l: "Registrar gastos" },
  { e: "🎯", l: "Metas" },
  { e: "💳", l: "Deudas" },
  { e: "📚", l: "Aprende" },
];
const featureAt = (i: number) => v(1.1 + i * 0.3);

const Gancho: React.FC = () => (
  <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 26 }}>
    {FEATURES.map((f, i) => (
      <CardIn key={f.l} at={featureAt(i)} rotate={i % 2 === 0 ? -2 : 2}>
        <Card width={410} pad={24} style={{ display: "flex", alignItems: "center", gap: 18 }}>
          <EmojiTile emoji={f.e} size={70} />
          <span style={{ fontFamily: fonts.display, fontWeight: 700, fontSize: 32, color: z.navy, lineHeight: 1.1 }}>{f.l}</span>
        </Card>
      </CardIn>
    ))}
  </div>
);

export const C00_DEF: VideoDef = {
  id: "c00",
  tiempos,
  chapters: [
    {
      tone: "navy",
      eyebrow: { n: "00", label: "Zafi" },
      headline: ["Zafi en ", { t: "60 segundos.", s: "mark" }],
      Body: Gancho,
      audio: "00",
      sfx: FEATURES.map((_, i) => ({ at: featureAt(i), name: "pop" as const, volume: 0.25 })),
    },
    {
      tone: "electric",
      eyebrow: { n: "01", label: "Diagnóstico" },
      headline: ["Tu salud financiera, ", { t: "en un número.", s: "accentBox" }],
      headlineSize: 112,
      Body: Diagnostico,
      audio: "01",
      sfx: [
        { at: 4, name: "pop", volume: 0.3 },
        { at: v(3.35), name: "pop", volume: 0.4 },
      ],
    },
    {
      tone: "light",
      eyebrow: { n: "02", label: "Plan del mes" },
      headline: ["Hoy puedes gastar ", { t: "Q 245.", s: "mark" }],
      Body: EmpiezaMes,
      audio: "02",
      sfx: [
        { at: v(1.8), name: "tic", volume: 0.3 },
        { at: v(2.55), name: "pop", volume: 0.35 },
        { at: v(3.4), name: "pop", volume: 0.35 },
      ],
    },
    {
      tone: "navy",
      eyebrow: { n: "03", label: "Registrar" },
      headline: ["Como se lo ", { t: "dirías a alguien.", s: "accent" }],
      Body: Escribelo,
      audio: "03",
      sfx: [
        { at: 4, name: "pop", volume: 0.3 },
        ...[0, 3, 6, 9, 12, 15, 18].map((d) => ({ at: v(2.6) + d, name: "tic" as const, volume: 0.25 })),
        { at: v(4.1), name: "pop", volume: 0.35 },
      ],
    },
    {
      tone: "light",
      eyebrow: { n: "04", label: "Metas" },
      headline: ["Zafi calcula ", { t: "cuándo llegas.", s: "accent" }],
      Body: Cuando,
      audio: "04",
      sfx: [
        { at: 2, name: "pop", volume: 0.3 },
        { at: v(4.0), name: "pop", volume: 0.4 },
      ],
    },
    {
      tone: "electric",
      eyebrow: { n: "05", label: "Deudas" },
      headline: [{ t: "Bola de nieve", s: "mark" }, { br: true }, "o ", { t: "avalancha?", s: "accentBox" }],
      headlineSize: 112,
      Body: () => <Estrategia t1={1.1} tVs={2.25} t2={2.4} />,
      audio: "05",
      sfx: [
        { at: v(1.1), name: "pop", volume: 0.35 },
        { at: v(2.25), name: "pop", volume: 0.4 },
        { at: v(2.4), name: "pop", volume: 0.35 },
      ],
    },
    {
      tone: "navy",
      eyebrow: { n: "06", label: "Aprende" },
      headline: ["Aprende y ", { t: "pregunta.", s: "accent" }],
      Body: Pregunta,
      audio: "06",
      sfx: [
        { at: v(1.15), name: "tic", volume: 0.35 },
        { at: v(3.5), name: "pop", volume: 0.35 },
      ],
    },
  ],
  outro: {
    headline: ["Todo tu dinero.", { br: true }, { t: "Un solo lugar.", s: "accent" }],
    audio: "07",
    tiles: [1, 2, 3, 4, 5, 6],
  },
};

export const C00_DURATION = videoLength(C00_DEF);

export const C00Zafi60: React.FC<SerieProps> = ({ mostrarZonasSeguras }) => <SerieVideo def={C00_DEF} mostrarZonasSeguras={mostrarZonasSeguras} />;
