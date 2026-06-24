import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import bcrypt from "bcryptjs";
import { getRedisClient } from "@/lib/redis/client";
import { emailService } from "@/lib/email";

export async function POST(req: Request) {
  try {
    const { name, email, password } = await req.json();

    if (!name || !email || !password) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const existingUser = await db.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      return NextResponse.json({ error: "User with this email already exists" }, { status: 409 });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const user = await db.user.create({
      data: {
        name,
        email,
        password: hashedPassword,
      },
    });

    // Generate and store OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const redis = await getRedisClient();
    await redis.set(`auth:otp:${email}`, otp, "EX", 600); // 10 minutes

    // Send OTP email
    await emailService.sendVerificationOTP(email, otp);

    return NextResponse.json({ success: true, email: user.email }, { status: 201 });
  } catch (error) {
    console.error("Registration error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
