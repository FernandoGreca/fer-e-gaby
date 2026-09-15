import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = {
  title: "Fer + Gaby | Nossos desejos",
  description:
    "Pequenos desejos, grandes sorrisos. As listas de presentes de Fer e Gaby.",
};
export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
