import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { emailService } from "@/lib/email";
import crypto from "crypto";

export async function POST(req: NextRequest) {
  try {
    const { email } = await req.json();

    if (!email) {
      return NextResponse.json(
        { error: "Email is required" },
        { status: 400 }
      );
    }

    // Check if user exists
    const user = await db.user.findUnique({
      where: { email },
    });

    // We don't want to reveal if a user exists or not for security reasons,
    // so we return success either way, but we only generate a token and send an email if they exist.
    if (user) {
      // Generate a secure token
      const token = crypto.randomBytes(32).toString("hex");
      
      // Token expires in 1 hour
      const expires = new Date(Date.now() + 1000 * 60 * 60);

      // Delete any existing tokens for this email to prevent spam
      await db.verificationToken.deleteMany({
        where: { identifier: email },
      });

      // Save token in DB
      await db.verificationToken.create({
        data: {
          identifier: email,
          token,
          expires,
        },
      });

      // Send the email
      await emailService.sendPasswordReset(email, token);
    }

    return NextResponse.json(
      { message: "If an account exists with that email, we have sent a password reset link." },
      { status: 200 }
    );
  } catch (error) {
    console.error("Forgot password error:", error);
    return NextResponse.json(
      { error: "An error occurred while processing your request" },
      { status: 500 }
    );
  }
}
