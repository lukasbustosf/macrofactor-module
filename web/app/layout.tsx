import type { Metadata } from "next";
import "./globals.css";
import { themeScript } from "@/lib/theme";

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
    <html lang="es" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="bg-slate-100 dark:bg-slate-900 text-slate-900 dark:text-slate-100 antialiased min-h-screen">
        {children}
      </body>
    </html>
  );
}
