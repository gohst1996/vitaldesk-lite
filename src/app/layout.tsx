import type { Metadata, Viewport } from "next";
import "./globals.css";
import { BannerDemo } from "@/components/banner-demo";

export const metadata: Metadata = {
  title: "VitalDesk Lite",
  description: "Pedí tu cita en menos de un minuto, desde el celular.",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "VitalDesk",
  },
  icons: {
    icon: [{ url: "/icon.svg", type: "image/svg+xml" }],
    apple: [{ url: "/apple-icon.png" }],
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  viewportFit: "cover",
  themeColor: "#0d9488",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es" className="h-full antialiased">
      <body className="flex min-h-full flex-col">
        <BannerDemo />
        {children}
      </body>
    </html>
  );
}
