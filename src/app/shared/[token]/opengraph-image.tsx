import { ImageResponse } from "next/og";
import { db } from "@/lib/db";
import { env } from "@/env";

export const alt = "IntelliDoc Shared Resource";
export const size = {
  width: 1200,
  height: 630,
};
export const contentType = "image/png";

// Do NOT use Edge runtime here because we need Prisma to talk to the DB
// export const runtime = "edge";

export default async function Image({ params }: { params: Promise<{ token: string }> }) {
  const resolvedParams = await params;
  const token = resolvedParams.token;

  let resourceTitle = "";
  let authorName = "";
  let isValid = false;

  try {
    const sharedLink = await db.sharedLink.findUnique({
      where: { token },
      include: {
        user: {
          select: { name: true },
        },
      },
    });

    if (sharedLink && (!sharedLink.expiresAt || sharedLink.expiresAt > new Date())) {
      isValid = true;
      authorName = sharedLink.user?.name || "Anonymous";

      if (sharedLink.resourceType === "DOCUMENT") {
        const doc = await db.document.findUnique({ where: { id: sharedLink.resourceId } });
        resourceTitle = doc?.filename || "Shared Document";
      } else if (sharedLink.resourceType === "CONVERSATION") {
        const conv = await db.conversation.findUnique({ where: { id: sharedLink.resourceId } });
        resourceTitle = conv?.title || "Shared Conversation";
      }
    }
  } catch (error) {
    console.error("Error generating OG image for shared link:", error);
  }

  // Fallback to generic branding if invalid/expired/not found to prevent leaks
  if (!isValid || !resourceTitle) {
    return new ImageResponse(
      (
        <div
          style={{
            width: "100%",
            height: "100%",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: "#000000",
            backgroundImage: "radial-gradient(circle at 50% 50%, #1a1a1a 0%, #000000 100%)",
            color: "white",
          }}
        >
          <div
            style={{
              fontSize: "64px",
              fontWeight: "bold",
              letterSpacing: "-0.05em",
            }}
          >
            IntelliDoc AI
          </div>
          <div style={{ marginTop: "20px", fontSize: "32px", color: "#a1a1aa" }}>
            Secure Document Intelligence
          </div>
        </div>
      ),
      { ...size }
    );
  }

  // Valid shared link preview
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          padding: "80px",
          backgroundColor: "#ffffff",
          backgroundImage: "linear-gradient(to bottom right, #ffffff 0%, #f4f4f5 100%)",
          color: "#000000",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", marginBottom: "40px" }}>
          <div
            style={{
              width: "48px",
              height: "48px",
              borderRadius: "12px",
              backgroundColor: "#000000",
              color: "#ffffff",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "24px",
              fontWeight: "bold",
              marginRight: "20px",
            }}
          >
            ID
          </div>
          <span style={{ fontSize: "28px", fontWeight: "600", color: "#52525b" }}>
            IntelliDoc AI
          </span>
        </div>

        <div
          style={{
            display: "flex",
            flexDirection: "column",
            flex: 1,
            justifyContent: "center",
          }}
        >
          <div
            style={{
              fontSize: "32px",
              color: "#3f3f46",
              marginBottom: "16px",
              textTransform: "uppercase",
              letterSpacing: "0.05em",
              fontWeight: "600",
            }}
          >
            Shared Resource
          </div>
          <div
            style={{
              fontSize: "72px",
              fontWeight: "bold",
              lineHeight: 1.1,
              letterSpacing: "-0.02em",
              marginBottom: "32px",
              color: "#09090b",
              display: "-webkit-box",
              WebkitLineClamp: 3,
              WebkitBoxOrient: "vertical",
              overflow: "hidden",
            }}
          >
            {resourceTitle}
          </div>
          <div style={{ fontSize: "32px", color: "#52525b" }}>
            Shared securely by <strong style={{ color: "#09090b" }}>{authorName}</strong>
          </div>
        </div>
      </div>
    ),
    { ...size }
  );
}
