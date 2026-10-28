import { json } from "@/lib/http";
import { YouCamError, creditBalance } from "@/server/youcam";

export const dynamic = "force-dynamic";
export const maxDuration = 10;

export async function GET() {
  if (!process.env.YOUCAM_API_KEY) return json({ available: false });
  try {
    const balance = await creditBalance();
    return json({ available: true, balance });
  } catch (error) {
    const code = error instanceof YouCamError ? error.code : "credit_failed";
    return json({ available: false, error: code }, 502);
  }
}
