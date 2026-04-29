import type { Metadata, Viewport } from "next";
import { Heebo } from "next/font/google";
import "./globals.css";

const heebo = Heebo({
  variable: "--font-heebo",
  subsets: ["hebrew", "latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "רשימת קניות",
  description: "ניהול רשימות קניות משותפות",
  applicationName: "רשימת קניות",
  manifest: "/manifest.webmanifest",
  icons: {
    icon: "/icon.svg",
    apple: "/apple-touch-icon.png",
  },
  appleWebApp: {
    capable: true,
    title: "רשימת קניות",
    statusBarStyle: "default",
  },
};

export const viewport: Viewport = {
  themeColor: "#3880ff",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="he" dir="rtl" className={`${heebo.variable} h-full antialiased`}>
      <body className="min-h-full bg-[#f4f5f8] text-slate-950">{children}</body>
    </html>
  );
}
