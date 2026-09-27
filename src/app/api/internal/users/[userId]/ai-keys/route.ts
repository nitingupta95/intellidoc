import { NextResponse, NextRequest } from "next/server";
import { db } from "@/lib/db";
import { env } from "@/env";
import { safeDecryptApiKey } from "@/lib/crypto";

// Internal only (AI service worker): returns a user's decrypted BYOK keys so
// document indexing can run on them. Keys are fetched at processing time
// instead of being placed in queue messages.
export async function GET(
  req: NextRequest,
  props: { params: Promise<{ userId: string }> }
) {
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${env.INTERNAL_SERVICE_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { userId } = await props.params;
  const user = await db.user.findUnique({
    where: { id: userId },
    select: { openaiKey: true, geminiKey: true },
  });
  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  return NextResponse.json(
    {
      openaiKey: safeDecryptApiKey(user.openaiKey),
      geminiKey: safeDecryptApiKey(user.geminiKey),
    },
    { headers: { "Cache-Control": "no-store" } }
  );
}
