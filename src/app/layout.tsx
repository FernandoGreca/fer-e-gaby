import type { Metadata } from "next";
import "./globals.css";
import { Portal } from "@/components/portal";
export const metadata: Metadata = {
  title: "Fer + Gaby",
  icons: {
    icon: (process.env.NEXT_PUBLIC_BASE_PATH ?? "/fer-e-gabi") + "/icon.svg",
  },
  description: "Nosso cantinho de desejos, memórias e momentos compartilhados.",
};
export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body>
        <Portal>{children}</Portal>
      </body>
    </html>
  );
}
