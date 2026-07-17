import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "MacroFactor Module",
  description: "Nutrición adaptativa estilo MacroFactor",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es">
      <body className="bg-gray-100 text-gray-900 antialiased">{children}</body>
    </html>
  );
}
