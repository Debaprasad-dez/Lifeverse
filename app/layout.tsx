import type { Metadata, Viewport } from "next";
import { Plus_Jakarta_Sans, Be_Vietnam_Pro, Quicksand } from "next/font/google";
import "./globals.css";
import PWARegister from "@/components/PWARegister";

const jakarta = Plus_Jakarta_Sans({
  variable: "--font-jakarta",
  subsets: ["latin"],
});

const vietnam = Be_Vietnam_Pro({
  variable: "--font-vietnam",
  weight: ["400", "500", "600"],
  subsets: ["latin"],
});

const quicksand = Quicksand({
  variable: "--font-quicksand",
  subsets: ["latin"],
});

const BASE = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

export const metadata: Metadata = {
  title: "LifeVerse",
  description: "Your life, a living world of floating kingdoms.",
  manifest: `${BASE}/manifest.webmanifest`,
  appleWebApp: { capable: true, title: "LifeVerse", statusBarStyle: "default" },
  icons: { icon: `${BASE}/icon.svg`, apple: `${BASE}/icon.svg` },
};

export const viewport: Viewport = {
  themeColor: "#9ed4ff",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${jakarta.variable} ${vietnam.variable} ${quicksand.variable} h-full antialiased`}
    >
      <body className="h-full">
        <PWARegister />
        {children}
      </body>
    </html>
  );
}
