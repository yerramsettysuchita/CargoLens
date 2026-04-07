import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
  weight: ["400", "500", "600", "700"],
});

export const viewport: Viewport = {
  themeColor: "#1E40AF",
  colorScheme: "light",
  width: "device-width",
  initialScale: 1,
};

export const metadata: Metadata = {
  title: {
    default: "CargoLens — Global Trade Dashboard",
    template: "%s | CargoLens",
  },
  description:
    "AI-powered global logistics control tower for SMEs, freight forwarders, and cross-border operators. Multi-corridor shipment visibility, supplier risk mapping, tariff simulation, and carbon-aware rerouting.",
  keywords: [
    "global logistics",
    "cross-border trade",
    "shipment tracking",
    "tariff simulator",
    "supply chain visibility",
    "carbon routing",
    "SME exporter",
    "freight forwarder",
    "DP World",
    "trade corridor",
    "UFLPA",
    "CBAM",
  ],
  authors: [{ name: "CargoLens" }],
  creator: "CargoLens",
  metadataBase: new URL("https://cargolens.vercel.app"),
  openGraph: {
    type: "website",
    locale: "en_IN",
    url: "https://cargolens.vercel.app",
    siteName: "CargoLens",
    title: "CargoLens — Global Trade Dashboard",
    description:
      "Multi-corridor shipment visibility, global supplier risk mapping, tariff simulation, and carbon-aware rerouting for SMEs and cross-border operators.",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "CargoLens — AI Logistics Dashboard",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "CargoLens — Global Trade Dashboard",
    description: "AI-powered global logistics dashboard for SMEs and cross-border trade operators.",
    images: ["/og-image.png"],
  },
  manifest: "/manifest.json",
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "any" },
      { url: "/icon.svg", type: "image/svg+xml" },
    ],
    apple: "/apple-touch-icon.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={inter.variable} style={{ colorScheme: "light" }} suppressHydrationWarning>
      <head>
        <meta name="color-scheme" content="light only" />
      </head>
      <body className="min-h-screen antialiased" suppressHydrationWarning>{children}</body>
    </html>
  );
}
