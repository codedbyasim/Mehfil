import type { GarmentCategory, Presentation } from "@/lib/types";

export type Outfit = {
  id: string;
  functionId: "mehndi" | "baraat" | "walima";
  presentation: Presentation;
  audiences: Array<"bride" | "groom" | "guest">;
  name: string;
  description: string;
  dominant: string;
  accent: string;
  suggestedCategory: GarmentCategory;
  image: string;
  source: string;
};

export const OUTFITS: Outfit[] = [
  {
    id: "groom-mehndi-kurta",
    functionId: "mehndi",
    presentation: "man",
    audiences: ["groom", "guest"],
    name: "Mustard kurta",
    description: "Mustard cotton-silk kurta with a narrow embroidered placket.",
    dominant: "#D89C30",
    accent: "#F3E2B0",
    suggestedCategory: "upper_body",
    image: "/demo/groom/garments/mehndi_kurta_mustard.jpg",
    source: "AI-generated product shot made for MEHFIL. No logos, no brand, no face.",
  },
  {
    id: "groom-baraat-sherwani",
    functionId: "baraat",
    presentation: "man",
    audiences: ["groom", "guest"],
    name: "Ivory-gold sherwani",
    description: "Ivory sherwani with gold zari around the collar and cuffs.",
    dominant: "#E4D8CC",
    accent: "#C6A36A",
    suggestedCategory: "upper_body",
    image: "/demo/groom/garments/baraat_sherwani_ivory_gold.jpg",
    source: "AI-generated product shot made for MEHFIL. No logos, no brand, no face.",
  },
  {
    id: "groom-walima-princecoat",
    functionId: "walima",
    presentation: "man",
    audiences: ["groom", "guest"],
    name: "Navy prince coat",
    description: "Navy prince coat with a mandarin collar and covered buttons.",
    dominant: "#12182C",
    accent: "#D7C4A4",
    suggestedCategory: "upper_body",
    image: "/demo/groom/garments/walima_princecoat_navy.jpg",
    source: "AI-generated product shot made for MEHFIL. No logos, no brand, no face.",
  },
  {
    id: "bride-mehndi-lehenga",
    functionId: "mehndi",
    presentation: "woman",
    audiences: ["bride"],
    name: "Marigold lehenga",
    description: "Marigold lehenga, one garment, clean ground. Placeholder illustration.",
    dominant: "#E2A52B",
    accent: "#F6E7C1",
    suggestedCategory: "full_body",
    image: "/outfits/bride-mehndi.svg",
    source: "Original vector illustration drawn for MEHFIL. Not a photograph.",
  },
  {
    id: "bride-baraat-lehenga",
    functionId: "baraat",
    presentation: "woman",
    audiences: ["bride"],
    name: "Bridal red lehenga",
    description: "Deep red lehenga with a gold border. Placeholder illustration.",
    dominant: "#8E1E2F",
    accent: "#E4C57A",
    suggestedCategory: "full_body",
    image: "/outfits/bride-baraat.svg",
    source: "Original vector illustration drawn for MEHFIL. Not a photograph.",
  },
  {
    id: "bride-walima-lehenga",
    functionId: "walima",
    presentation: "woman",
    audiences: ["bride"],
    name: "Sage lehenga",
    description: "Pale sage lehenga. Placeholder illustration.",
    dominant: "#B7C4B0",
    accent: "#E7D7B8",
    suggestedCategory: "full_body",
    image: "/outfits/bride-walima.svg",
    source: "Original vector illustration drawn for MEHFIL. Not a photograph.",
  },
  {
    id: "guest-mehndi-anarkali",
    functionId: "mehndi",
    presentation: "woman",
    audiences: ["guest"],
    name: "Mango anarkali",
    description: "Festive mango anarkali for a guest, not a bridal red. Placeholder illustration.",
    dominant: "#E08A2C",
    accent: "#F4E2C4",
    suggestedCategory: "full_body",
    image: "/outfits/guest-mehndi.svg",
    source: "Original vector illustration drawn for MEHFIL. Not a photograph.",
  },
  {
    id: "guest-baraat-jacket",
    functionId: "baraat",
    presentation: "woman",
    audiences: ["guest"],
    name: "Emerald jacket",
    description: "Emerald evening jacket. Placeholder illustration.",
    dominant: "#1F6A4A",
    accent: "#E6D5B4",
    suggestedCategory: "upper_body",
    image: "/outfits/guest-baraat.svg",
    source: "Original vector illustration drawn for MEHFIL. Not a photograph.",
  },
  {
    id: "guest-walima-anarkali",
    functionId: "walima",
    presentation: "woman",
    audiences: ["guest"],
    name: "Champagne anarkali",
    description: "Champagne anarkali. Placeholder illustration.",
    dominant: "#E6D2B0",
    accent: "#C4A574",
    suggestedCategory: "full_body",
    image: "/outfits/guest-walima.svg",
    source: "Original vector illustration drawn for MEHFIL. Not a photograph.",
  },
];

export function outfitById(id: string): Outfit | undefined {
  return OUTFITS.find((outfit) => outfit.id === id);
}

export function outfitsFor(presentation: Presentation, role: "bride" | "groom" | "guest"): Outfit[] {
  return OUTFITS.filter((outfit) => outfit.presentation === presentation && outfit.audiences.includes(role));
}
