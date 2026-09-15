import { Camera, Gift } from "lucide-react";
export const services = [
  {
    href: "/presentes",
    title: "Lista de presentes",
    description:
      "Pequenos desejos, escolhidos com carinho. Descubra o que faz nossos olhos brilharem.",
    action: "Conhecer nossos desejos",
    icon: Gift,
    theme: "blush",
  },
  {
    href: "/galeria",
    title: "Galeria",
    description:
      "Dias especiais e a beleza do cotidiano. Um álbum dos momentos que queremos guardar.",
    action: "Ver nossas memórias",
    icon: Camera,
    theme: "lavender",
  },
] as const;
