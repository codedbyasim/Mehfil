import { SessionProvider } from "@/components/session";
import { Shell } from "@/components/shell";
import type { Metadata } from "next";
import { Cormorant_Garamond, Noto_Nastaliq_Urdu, Outfit } from "next/font/google";
import "./globals.css";

const display = Cormorant_Garamond({
  subsets: ["latin"],
  weight: ["500", "600", "700"],
  variable: "--font-mehfil-display",
});

const sans = Outfit({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600"],
  variable: "--font-mehfil-sans",
});

const urdu = Noto_Nastaliq_Urdu({
  subsets: ["arabic"],
  weight: ["500"],
  variable: "--font-mehfil-urdu",
});

export const metadata: Metadata = {
  title: "MEHFIL — wedding week looks",
  description: "Plan Mehndi, Baraat, and Walima from one portrait. Outfits, grooming, and an event-day skin goal.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${display.variable} ${sans.variable} ${urdu.variable}`}>
      <body>
        <SessionProvider>
          <Shell>{children}</Shell>
        </SessionProvider>
      </body>
    </html>
  );
}
