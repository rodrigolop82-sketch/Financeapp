import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";

const geistSans = localFont({
  src: "./fonts/GeistVF.woff",
  variable: "--font-geist-sans",
  weight: "100 900",
});
const geistMono = localFont({
  src: "./fonts/GeistMonoVF.woff",
  variable: "--font-geist-mono",
  weight: "100 900",
});

export const metadata: Metadata = {
  title: "Zafi — Ordená tu dinero. Construí tu futuro.",
  description:
    "Tu planner financiero personal para Latinoamérica. Diagnóstico honesto, plan de acción priorizado, y acompañamiento proactivo mes a mes.",
  manifest: "/manifest.json",
  themeColor: "#1E3A5F",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Zafi",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es">
      <body
        className={`${geistSans.variable} ${geistMono.variable} font-[family-name:var(--font-geist-sans)] antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
