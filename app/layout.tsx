import type { Metadata } from "next";
import "@fontsource/outfit/300.css";
import "@fontsource/outfit/400.css";
import "@fontsource/outfit/500.css";
import "@fontsource/outfit/600.css";
import "@fontsource/outfit/700.css";
import "@fontsource/outfit/800.css";
import "@fontsource/outfit/900.css";
import "@fontsource/dm-serif-display/400.css";
import "@fontsource/dm-serif-display/400-italic.css";
import "@fontsource/dm-sans/300.css";
import "@fontsource/dm-sans/400.css";
import "@fontsource/dm-sans/500.css";
import "@fontsource/dm-sans/600.css";
import "@fontsource/dm-sans/700.css";
import "./globals.css";
import { InstallPromptManager } from "@/components/install/InstallPromptManager";
import { ServiceWorkerRegistration } from "@/components/ServiceWorkerRegistration";
import { ThemeProvider } from "@/components/ThemeProvider";
import { Splash } from "@/components/motion/Splash";
import { SPLASH_BOOT_SCRIPT } from "@/lib/motion";

export const metadata: Metadata = {
  title: "Zafi — Ordena tu dinero. Construye tu futuro.",
  description:
    "Tu planner financiero personal para Latinoamérica. Diagnóstico honesto, plan de acción priorizado, y acompañamiento proactivo mes a mes.",
  manifest: "/manifest.json",
  themeColor: "#0D1F36",
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
    <html lang="es" suppressHydrationWarning>
      <head>
        <link rel="manifest" href="/manifest.json" />
        <link rel="apple-touch-icon" href="/icon-192.png" />
        {/* Antes de pintar: oculta el splash si ya se vio en esta sesión. */}
        <script dangerouslySetInnerHTML={{ __html: SPLASH_BOOT_SCRIPT }} />
      </head>
      <body className="font-sans antialiased">
        <ThemeProvider>
          <ServiceWorkerRegistration />
          <Splash />
          <InstallPromptManager>
            {children}
          </InstallPromptManager>
        </ThemeProvider>
      </body>
    </html>
  );
}
