import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import SuperAdminRecoveryBridge from "@/components/SuperAdminRecoveryBridge";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: "CA46 · Trazabilidad alimentaria",
    template: "%s · CA46",
  },
  description:
    "Gestión de trazabilidad, etiquetado, cocina y control de temperaturas para empresas alimentarias.",
  applicationName: "CA46",
  robots: { index: true, follow: true },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="es"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <SuperAdminRecoveryBridge />
        {children}
      </body>
    </html>
  );
}
