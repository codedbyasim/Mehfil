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
    name: "Yellow-green lehenga",
    description: "Yellow and green lehenga with a floral choli and a green dupatta.",
    dominant: "#E2B21E",
    accent: "#2E8B3E",
    suggestedCategory: "upper_body",
    image: "/demo/bride/garments/mehndi_lehenga_yellow_green.jpg",
    source: "AI-generated product shot made for MEHFIL. No logos, no brand, no face.",
  },
  {
    id: "bride-baraat-lehenga",
    functionId: "baraat",
    presentation: "woman",
    audiences: ["bride"],
    name: "Red and gold lehenga",
    description: "Deep red lehenga with gold zari and a red net dupatta.",
    dominant: "#8E242C",
    accent: "#C6A36A",
    suggestedCategory: "upper_body",
    image: "/demo/bride/garments/baraat_lehenga_red_gold.jpg",
    source: "AI-generated product shot made for MEHFIL. No logos, no brand, no face.",
  },
  {
    id: "bride-walima-lehenga",
    functionId: "walima",
    presentation: "woman",
    audiences: ["bride"],
    name: "Pastel gharara",
    description: "Pastel pink and silver gharara with a scalloped dupatta.",
    dominant: "#F2C9CF",
    accent: "#C9C9CF",
    suggestedCategory: "upper_body",
    image: "/demo/bride/garments/walima_gharara_pastel_silver.jpg",
    source: "AI-generated product shot made for MEHFIL. No logos, no brand, no face.",
  },
  {
    id: "guest-mehndi-anarkali",
    functionId: "mehndi",
    presentation: "woman",
    audiences: ["guest"],
    name: "Mango anarkali",
    description: "Festive mango anarkali for a guest, not a bridal red.",
    dominant: "#E08A2C",
    accent: "#F4E2C4",
    suggestedCategory: "full_body",
    image: "/demo/guest/garments/guest-mehndi-anarkali.jpg",
    source: "AI-generated product shot made for MEHFIL. No logos, no brand, no face.",
  },
  {
    id: "guest-baraat-jacket",
    functionId: "baraat",
    presentation: "woman",
    audiences: ["guest"],
    name: "Emerald jacket",
    description: "Emerald evening jacket with a mandarin collar.",
    dominant: "#1F6A4A",
    accent: "#E6D5B4",
    suggestedCategory: "upper_body",
    image: "/demo/guest/garments/guest-baraat-jacket.jpg",
    source: "AI-generated product shot made for MEHFIL. No logos, no brand, no face.",
  },
  {
    id: "guest-walima-anarkali",
    functionId: "walima",
    presentation: "woman",
    audiences: ["guest"],
    name: "Champagne anarkali",
    description: "Champagne anarkali with a light gold hem.",
    dominant: "#E6D2B0",
    accent: "#C4A574",
    suggestedCategory: "full_body",
    image: "/demo/guest/garments/guest-walima-anarkali.jpg",
    source: "AI-generated product shot made for MEHFIL. No logos, no brand, no face.",
  },
];

export function outfitById(id: string): Outfit | undefined {
  return OUTFITS.find((outfit) => outfit.id === id);
}

export function outfitsFor(presentation: Presentation, role: "bride" | "groom" | "guest"): Outfit[] {
  return OUTFITS.filter((outfit) => outfit.presentation === presentation && outfit.audiences.includes(role));
}
