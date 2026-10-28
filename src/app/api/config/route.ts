import { limitsFromEnv } from "@/lib/units";
import { json } from "@/lib/http";

export const dynamic = "force-dynamic";

export function GET() {
  const limits = limitsFromEnv();
  return json({
    demoDefault: true,
    hasYoucam: Boolean(process.env.YOUCAM_API_KEY),
    hasAiml: Boolean(process.env.AIML_API_KEY),
    limits: { daily: limits.daily, perIp: limits.perIp, session: limits.session },
    server: "https://yce-api-01.makeupar.com",
  });
}
