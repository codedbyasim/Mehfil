import { json } from "@/lib/http";
import { boundGrant, runRequired } from "@/server/run-auth";

export const dynamic = "force-dynamic";
export const maxDuration = 10;

export async function GET(request: Request) {
  if (!process.env.YOUCAM_API_KEY) return json({ available: false });
  if (!boundGrant(request)) return json(runRequired(), 401);
  return json({ available: true });
}
