import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const root = path.resolve("public");

function garment({ name, color, gold, kind }) {
  const skirt =
    kind === "jacket"
      ? `<path d="M250 210 L550 210 L590 860 L210 860 Z" fill="${color}"/><path d="M400 210 L400 860" stroke="${gold}" stroke-width="6"/><circle cx="400" cy="320" r="8" fill="${gold}"/><circle cx="400" cy="420" r="8" fill="${gold}"/><circle cx="400" cy="520" r="8" fill="${gold}"/>`
      : `<path d="M310 180 h180 l40 120 h-260 z" fill="${color}" stroke="${gold}" stroke-width="6"/><path d="M230 340 h340 l70 560 h-480 z" fill="${color}"/><path d="M230 860 h480" stroke="${gold}" stroke-width="18"/><path d="M280 420 C340 470 460 470 520 420" fill="none" stroke="${gold}" stroke-width="4" opacity="0.8"/>`;
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 1040">
  <rect width="800" height="1040" fill="#f6efe4"/>
  <rect x="48" y="48" width="704" height="944" fill="none" stroke="#a68445" stroke-width="2"/>
  ${skirt}
  <text x="400" y="80" text-anchor="middle" font-family="Georgia, serif" font-size="28" fill="#6e1c2b">${name}</text>
  <rect x="0" y="960" width="800" height="80" fill="#3d0d16"/>
  <text x="400" y="1008" text-anchor="middle" font-family="Georgia, serif" font-size="28" fill="#e4c88a" letter-spacing="4">PLACEHOLDER</text>
</svg>`;
}

function portrait({ label, garmentColor, lip, skin, hair }) {
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 1040">
  <rect width="800" height="1040" fill="#f3e6d4"/>
  <circle cx="120" cy="120" r="70" fill="none" stroke="#a68445" stroke-width="2" opacity="0.5"/>
  <circle cx="680" cy="160" r="40" fill="none" stroke="#a68445" stroke-width="2" opacity="0.45"/>
  <path d="M160 780 C200 640 250 600 400 600 C550 600 600 640 640 780 L700 980 L100 980 Z" fill="${garmentColor}"/>
  <path d="M400 600 L400 980" stroke="#e4c88a" stroke-width="4" opacity="0.7"/>
  <rect x="300" y="430" width="200" height="220" rx="80" fill="${skin}"/>
  <path d="M250 470 C250 250 300 160 400 160 C500 160 550 250 550 470 C520 390 480 360 400 360 C320 360 280 390 250 470 Z" fill="${hair}"/>
  <ellipse cx="400" cy="430" rx="150" ry="180" fill="${skin}"/>
  <ellipse cx="345" cy="430" rx="16" ry="10" fill="#2a211c"/>
  <ellipse cx="455" cy="430" rx="16" ry="10" fill="#2a211c"/>
  <path d="M370 520 Q400 540 430 520" fill="none" stroke="#6a4038" stroke-width="3"/>
  <path d="M350 560 Q400 590 450 560 Q400 610 350 560 Z" fill="${lip}"/>
  <text x="400" y="150" text-anchor="middle" font-family="Georgia, serif" font-size="28" fill="#6e1c2b">${label}</text>
  <rect x="0" y="960" width="800" height="80" fill="#3d0d16"/>
  <text x="400" y="1008" text-anchor="middle" font-family="Georgia, serif" font-size="26" fill="#e4c88a" letter-spacing="3">PLACEHOLDER · NOT A PHOTO</text>
</svg>`;
}

const garments = [
  ["outfits/bride-mehndi.svg", { name: "Marigold lehenga", color: "#E2A52B", gold: "#F6E7C1", kind: "lehenga" }],
  ["outfits/bride-baraat.svg", { name: "Bridal red lehenga", color: "#8E1E2F", gold: "#E4C57A", kind: "lehenga" }],
  ["outfits/bride-walima.svg", { name: "Sage lehenga", color: "#B7C4B0", gold: "#E7D7B8", kind: "lehenga" }],
  ["outfits/guest-mehndi.svg", { name: "Mango anarkali", color: "#E08A2C", gold: "#F4E2C4", kind: "lehenga" }],
  ["outfits/guest-baraat.svg", { name: "Emerald jacket", color: "#1F6A4A", gold: "#E6D5B4", kind: "jacket" }],
  ["outfits/guest-walima.svg", { name: "Champagne anarkali", color: "#E6D2B0", gold: "#C4A574", kind: "lehenga" }],
];

const portraits = [
  ["demo/bride/selfie.svg", { label: "Bride", garmentColor: "#F4E4C8", lip: "#A85A55", skin: "#C48A62", hair: "#2A160F" }],
  ["demo/bride/face.svg", { label: "Bride crop", garmentColor: "#F4E4C8", lip: "#A85A55", skin: "#C48A62", hair: "#2A160F" }],
  ["demo/bride/simulation.svg", { label: "Bride skin goal", garmentColor: "#F4E4C8", lip: "#C48A7A", skin: "#D09A72", hair: "#2A160F" }],
  ["demo/bride/mehndi.svg", { label: "Mehndi", garmentColor: "#E2A52B", lip: "#C47A3A", skin: "#C48A62", hair: "#2A160F" }],
  ["demo/bride/baraat.svg", { label: "Baraat", garmentColor: "#8E1E2F", lip: "#8E1E2F", skin: "#C48A62", hair: "#2A160F" }],
  ["demo/bride/walima.svg", { label: "Walima", garmentColor: "#B7C4B0", lip: "#C4A090", skin: "#C48A62", hair: "#2A160F" }],
  ["demo/guest/selfie.svg", { label: "Guest", garmentColor: "#E6D2B0", lip: "#9A5C58", skin: "#A86B4E", hair: "#1A120E" }],
  ["demo/guest/face.svg", { label: "Guest crop", garmentColor: "#E6D2B0", lip: "#9A5C58", skin: "#A86B4E", hair: "#1A120E" }],
  ["demo/guest/simulation.svg", { label: "Guest skin goal", garmentColor: "#E6D2B0", lip: "#B48478", skin: "#C08462", hair: "#1A120E" }],
  ["demo/guest/mehndi.svg", { label: "Mehndi", garmentColor: "#E08A2C", lip: "#C47A48", skin: "#A86B4E", hair: "#1A120E" }],
  ["demo/guest/baraat.svg", { label: "Baraat", garmentColor: "#1F6A4A", lip: "#8E4A55", skin: "#A86B4E", hair: "#1A120E" }],
  ["demo/guest/walima.svg", { label: "Walima", garmentColor: "#E6D2B0", lip: "#C4A090", skin: "#A86B4E", hair: "#1A120E" }],
];

for (const [file, spec] of garments) {
  const full = path.join(root, file);
  await mkdir(path.dirname(full), { recursive: true });
  await writeFile(full, garment(spec));
}
for (const [file, spec] of portraits) {
  const full = path.join(root, file);
  await mkdir(path.dirname(full), { recursive: true });
  await writeFile(full, portrait(spec));
}
console.log("wrote placeholders");
