import { NextResponse, NextRequest } from "next/server";
import { debitCredits, type DebitType } from "@/lib/wallet";

const DEBIT_TYPES: DebitType[] = ["DEBIT_CHAT", "DEBIT_EMBEDDING", "DEBIT_VOICE", "DEBIT_SUMMARY"];
import { env } from "@/env";

export async function POST(
  req: NextRequest,
  props: { params: Promise<{ userId: string }> }
) {
  try {
    const params = await props.params;
    const authHeader = req.headers.get("authorization");
    if (authHeader !== `Bearer ${env.INTERNAL_SERVICE_SECRET}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { amount, metadata, type = "DEBIT_CHAT" } = body;

    if (amount === undefined || typeof amount !== 'number') {
      return NextResponse.json({ error: "Invalid amount" }, { status: 400 });
    }
    if (!DEBIT_TYPES.includes(type)) {
      return NextResponse.json({ error: "Invalid debit type" }, { status: 400 });
    }

    const result = await debitCredits(params.userId, amount, metadata, type);
    
    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 402 });
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error("Internal wallet debit error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
