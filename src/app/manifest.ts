import type { MetadataRoute } from "next";
export const dynamic = "force-static";
export default function manifest(): MetadataRoute.Manifest {
  const base = process.env.NEXT_PUBLIC_BASE_PATH ?? "/fer-e-gaby";
  return {
    name: "Fer + Gaby",
    short_name: "Fer + Gaby",
    description: "Nossos desejos e memórias",
    start_url: base + "/",
    scope: base + "/",
    display: "standalone",
    background_color: "#fdfbf8",
    theme_color: "#954f66",
    icons: [
      {
        src: base + "/icon.svg",
        sizes: "any",
        type: "image/svg+xml",
        purpose: "any",
      },
    ],
  };
}
