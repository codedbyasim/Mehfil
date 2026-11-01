import { json } from "@/lib/http";

export const dynamic = "force-dynamic";

export function GET() {
  return json({
    demoDefault: true,
    hasYoucam: Boolean(process.env.YOUCAM_API_KEY),
    hasAiml: Boolean(process.env.AIML_API_KEY),
    live: "open",
    server: "https://yce-api-01.makeupar.com",
  });
}
