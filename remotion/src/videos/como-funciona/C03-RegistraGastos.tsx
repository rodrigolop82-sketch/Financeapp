// C03 · 4 formas de registrar gastos.
// Pantallas y textos de la hoja "Agregar" (AddSheet), el dictado por voz
// (VoiceOverlay) y la importación de estados de cuenta (statement-import).
import React from "react";
import { useCurrentFrame } from "remotion";
import { Mic } from "lucide-react";
import { colors, fonts } from "../../brand/theme";
import { tween } from "../../components";
import { Appear, CardIn, PopIn, SerieProps, SerieVideo, Tap, v, VideoDef, videoLength } from "./serie";
import tiempos from "./tiempos/c03.json";
import { Card, CardLabel, Pill, TxRow, z } from "./ui";

const Typed: React.FC<{ text: string; start: number; cps?: number; caret?: boolean }> = ({ text, start, cps = 1, caret = true }) => {
  const frame = useCurrentFrame();
  const n = Math.max(0, Math.min(text.length, Math.floor((frame - start) * cps)));
  return (
    <>
      {text.slice(0, n)}
      {caret && n < text.length && frame >= start && <span style={{ color: z.electric }}>|</span>}
    </>
  );
};

const Chip: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <span
    style={{
      display: "inline-flex",
      alignItems: "center",
      gap: 6,
      padding: "10px 18px",
      borderRadius: 99,
      border: `2px solid ${z.border}`,
      background: z.cardAlt,
      fontSize: 23,
      fontWeight: 600,
      color: z.navy,
    }}
  >
    {children}
  </span>
);

/** Tarjeta "Entendí esto" que la app muestra antes de guardar. */
const Entendi: React.FC<{ at: number; rows: { emoji: string; name: string; sub: string; amount: string }[]; chipsAt?: number[]; save?: string }> = ({
  at,
  rows,
  chipsAt = [],
  save = "Guardar",
}) => (
  <Appear at={at}>
    <div style={{ marginTop: 18, padding: "18px 22px", borderRadius: 22, background: z.cardAlt, border: `2px solid ${z.divider}` }}>
      <div style={{ fontFamily: fonts.serif, fontSize: 36, color: z.navy, marginBottom: 4 }}>Entendí esto</div>
      {rows.map((r, i) => (
        <TxRow key={r.name} {...r} last={i === rows.length - 1} />
      ))}
      {chipsAt.length > 0 && (
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 10 }}>
          {["🚕 Transporte ▾", "📅 Hoy ▾", "💳 Tarjeta ▾"].map((c, i) => (
            <PopIn key={c} at={chipsAt[Math.min(i, chipsAt.length - 1)] + i * 2}>
              <Chip>{c}</Chip>
            </PopIn>
          ))}
        </div>
      )}
      <div
        style={{
          marginTop: 16,
          height: 70,
          borderRadius: 16,
          background: z.electric,
          color: colors.white,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: fonts.display,
          fontWeight: 700,
          fontSize: 30,
        }}
      >
        {save}
      </div>
    </div>
  </Appear>
);

/* 01 — Escríbelo */
export const Escribelo: React.FC = () => (
  <CardIn at={4}>
    <Card>
      <CardLabel>Agregar</CardLabel>
      <div style={{ fontSize: 24, color: z.secondary, marginBottom: 12 }}>Escríbelo como se lo dirías a alguien.</div>
      <div style={{ height: 84, borderRadius: 20, border: `3px solid ${z.electric}`, display: "flex", alignItems: "center", padding: "0 24px", fontSize: 38, color: z.ink }}>
        <Typed text="uber 38" start={v(2.6)} cps={0.4} />
      </div>
      <Entendi at={v(4.1)} rows={[{ emoji: "🚕", name: "Uber", sub: "Gasto", amount: "Q 38" }]} chipsAt={[v(5.5), v(6.5)]} />
    </Card>
  </CardIn>
);

/* 02 — Díctalo */
const Dictalo: React.FC = () => {
  const frame = useCurrentFrame();
  const listening = frame >= v(1.5);
  return (
    <CardIn at={4} rotate={1.2}>
      <Card>
        <CardLabel>Dictar</CardLabel>
        <div style={{ fontFamily: fonts.serif, fontSize: 52, color: z.navy }}>Cuéntame tu gasto</div>
        <div style={{ display: "flex", alignItems: "center", gap: 28, margin: "26px 0" }}>
          <span
            style={{
              width: 130,
              height: 130,
              borderRadius: 99,
              background: z.electric,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              boxShadow: listening ? `0 0 0 ${14 + Math.sin(frame / 4) * 8}px ${z.ghost}` : "none",
            }}
          >
            <Mic size={62} color={colors.white} />
          </span>
          <div style={{ display: "flex", gap: 8, alignItems: "center", height: 110 }}>
            {Array.from({ length: 13 }).map((_, i) => (
              <span
                key={i}
                style={{
                  width: 12,
                  borderRadius: 9,
                  background: z.electricPale,
                  height: listening ? 16 + Math.abs(Math.sin(frame / 3 + i * 1.1)) * 80 : 16,
                }}
              />
            ))}
          </div>
        </div>
        <div style={{ fontFamily: fonts.serif, fontStyle: "italic", fontSize: 40, color: z.navy, minHeight: 100, lineHeight: 1.2 }}>
          “<Typed text="gasté 200 en el súper y 38 de uber" start={v(1.7)} cps={0.75} caret={false} />”
        </div>
        <div style={{ fontSize: 22, color: z.secondary }}>Toca ✓ cuando termines</div>
      </Card>
    </CardIn>
  );
};

/* 03 — Súbelo (PDF o foto) */
const STEPS = [
  { at: v(3.1), t: "Leyendo el PDF" },
  { at: v(3.7), t: "Encontrando movimientos de BAM" },
  { at: v(4.6), t: "Buscando duplicados" },
];

const Subelo: React.FC = () => {
  const frame = useCurrentFrame();
  const found = frame >= v(5.4);
  return (
    <CardIn at={4} rotate={-1.2}>
      <Card>
        <CardLabel>Importar estado de cuenta</CardLabel>
        <div style={{ display: "flex", padding: 6, borderRadius: 18, background: "#E7EBF2", marginBottom: 22 }}>
          {["📷 Foto", "📄 PDF"].map((l, i) => (
            <div
              key={l}
              style={{
                flex: 1,
                textAlign: "center",
                padding: "12px 0",
                borderRadius: 14,
                fontSize: 25,
                fontWeight: 700,
                background: i === 1 ? z.card : "transparent",
                color: i === 1 ? z.navy : z.muted,
                boxShadow: i === 1 ? "0 2px 8px rgba(30,58,95,0.15)" : undefined,
              }}
            >
              {l}
            </div>
          ))}
        </div>
        {!found ? (
          <>
            <Appear at={v(1.2)}>
              <div style={{ display: "flex", alignItems: "center", gap: 16, padding: "16px 20px", borderRadius: 18, border: `2px dashed ${z.electricPale}`, background: z.ghost, fontSize: 27, color: z.navy, fontWeight: 600 }}>
                📄 estado-octubre.pdf
              </div>
            </Appear>
            <div style={{ fontFamily: fonts.serif, fontSize: 36, color: z.navy, margin: "22px 0 8px" }}>
              {frame >= STEPS[0].at ? "Leyendo tu estado de cuenta…" : ""}
            </div>
            {STEPS.map((s, i) => {
              const done = frame >= (STEPS[i + 1]?.at ?? v(5.4));
              return (
                <Appear key={s.t} at={s.at} y={12}>
                  <div style={{ display: "flex", alignItems: "center", gap: 14, padding: "8px 0", fontSize: 26, color: done ? z.successText : z.secondary }}>
                    <span style={{ width: 32 }}>{done ? "✓" : "◌"}</span>
                    {s.t}
                  </div>
                </Appear>
              );
            })}
          </>
        ) : (
          <Appear at={v(5.4)}>
            <div style={{ fontFamily: fonts.serif, fontSize: 52, color: z.navy }}>Encontramos 23 cargos</div>
            <div style={{ fontSize: 24, color: z.secondary, margin: "6px 0 14px" }}>Revisa que la categoría esté bien antes de agregarlos.</div>
            <TxRow emoji="🛒" name="Walmart" sub="Supermercado · 3 oct" amount="Q 486" />
            <TxRow emoji="⛽" name="Puma" sub="Gasolina · 5 oct" amount="Q 300" last />
            <div style={{ display: "flex", gap: 12, marginTop: 14 }}>
              <PopIn at={v(5.7)}>
                <Pill kind="ok">✓ 3 duplicados evitados</Pill>
              </PopIn>
              <PopIn at={v(5.9)}>
                <Pill kind="info">Agregar 20 movimientos</Pill>
              </PopIn>
            </div>
          </Appear>
        )}
      </Card>
    </CardIn>
  );
};

/* 04 — Pégalo (mensaje del banco) */
const Pegalo: React.FC = () => {
  const frame = useCurrentFrame();
  const pasted = frame >= v(1.9);
  return (
    <div style={{ position: "relative" }}>
      <Appear at={4}>
        <div
          style={{
            maxWidth: 720,
            padding: "20px 24px",
            borderRadius: 26,
            borderBottomLeftRadius: 8,
            background: "#E7EBF2",
            fontSize: 26,
            lineHeight: 1.35,
            color: z.ink,
            marginBottom: 22,
            transform: `scale(${pasted ? 0.94 : 1})`,
            transformOrigin: "left top",
            opacity: pasted ? 0.7 : 1,
          }}
        >
          <div style={{ fontSize: 20, fontWeight: 700, color: z.secondary, marginBottom: 4 }}>BAM · SMS</div>
          BAM le informa: Compra por Q 150.00 en WALMART aprobada.
        </div>
      </Appear>
      <CardIn at={v(1.6)} rotate={1}>
        <Card>
          <CardLabel>💬 Mensaje del banco</CardLabel>
          <div style={{ minHeight: 70, borderRadius: 18, border: `3px solid ${z.border}`, padding: "16px 20px", fontSize: 25, color: z.ink, opacity: pasted ? 1 : 0.3 }}>
            {pasted ? "BAM le informa: Compra por Q 150.00 en WALMART…" : "Pega aquí la notificación"}
          </div>
          <Entendi at={v(2.75)} rows={[{ emoji: "🛒", name: "Walmart", sub: "Supermercado · hoy", amount: "Q 150" }]} />
        </Card>
      </CardIn>
      <Tap at={v(1.85)} x={400} y={330} />
      <Tap at={v(4.2)} x={430} y={760} />
    </div>
  );
};

export const C03_DEF: VideoDef = {
  id: "c03",
  tiempos,
  chapters: [
    {
      tone: "light",
      eyebrow: { n: "01", label: "Escríbelo" },
      headline: ["Como se lo ", { t: "dirías a alguien.", s: "accent" }],
      Body: Escribelo,
      audio: "01",
      sfx: [
        { at: 4, name: "pop", volume: 0.3 },
        ...[0, 3, 6, 9, 12, 15, 18].map((d) => ({ at: v(2.6) + d, name: "tic" as const, volume: 0.25 })),
        { at: v(4.1), name: "pop", volume: 0.35 },
      ],
    },
    {
      tone: "navy",
      eyebrow: { n: "02", label: "Díctalo" },
      headline: ["O solo ", { t: "dilo.", s: "mark" }],
      Body: Dictalo,
      audio: "02",
      sfx: [{ at: 4, name: "pop", volume: 0.3 }],
    },
    {
      tone: "electric",
      eyebrow: { n: "03", label: "Súbelo" },
      headline: ["PDF o foto, ", { t: "en segundos.", s: "accentBox" }],
      Body: Subelo,
      audio: "03",
      sfx: [
        { at: v(1.2), name: "pop", volume: 0.3 },
        ...STEPS.map((s) => ({ at: s.at, name: "tic" as const, volume: 0.3 })),
        { at: v(5.4), name: "campanita", volume: 0.3 },
      ],
    },
    {
      tone: "light",
      eyebrow: { n: "04", label: "Pégalo" },
      headline: ["¿Te llegó un SMS? ", { t: "Pégalo.", s: "mark" }],
      headlineSize: 108,
      Body: Pegalo,
      audio: "04",
      sfx: [
        { at: 4, name: "pop", volume: 0.3 },
        { at: v(1.85), name: "tic", volume: 0.35 },
        { at: v(2.75), name: "pop", volume: 0.35 },
      ],
    },
  ],
  outro: {
    headline: ["Escríbelo. Díctalo.", { br: true }, { t: "Súbelo.", s: "accent" }],
    audio: "05",
  },
};

export const C03_DURATION = videoLength(C03_DEF);

export const C03RegistraGastos: React.FC<SerieProps> = ({ mostrarZonasSeguras }) => (
  <SerieVideo def={C03_DEF} mostrarZonasSeguras={mostrarZonasSeguras} />
);
