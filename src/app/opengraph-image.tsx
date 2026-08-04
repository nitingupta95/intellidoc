import { ImageResponse } from "next/og";
import { env } from "@/env";

export const runtime = "edge";
export const alt = "IntelliDoc AI";
export const size = {
  width: 1200,
  height: 630,
};
export const contentType = "image/png";

export default async function Image() {
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
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            padding: "40px",
            border: "1px solid rgba(255,255,255,0.1)",
            borderRadius: "24px",
            background: "rgba(255,255,255,0.05)",
          }}
        >
          {/* Mocking the BrainCircuit icon with text for OG since we can't easily load lucide in next/og without raw SVG */}
          <div
            style={{
              fontSize: "64px",
              fontWeight: "bold",
              letterSpacing: "-0.05em",
              marginBottom: "24px",
              display: "flex",
              alignItems: "center",
            }}
          >
            <span style={{ color: "#fff", marginRight: "12px" }}>⚡</span>
            IntelliDoc AI
          </div>
          <div
            style={{
              fontSize: "32px",
              color: "#a1a1aa",
              maxWidth: "800px",
              textAlign: "center",
              lineHeight: 1.4,
            }}
          >
            The most modern AI-powered document intelligence platform.
          </div>
        </div>
        <div
          style={{
            position: "absolute",
            bottom: "40px",
            fontSize: "24px",
            color: "#52525b",
          }}
        >
          {env.NEXT_PUBLIC_SITE_URL.replace("https://", "")}
        </div>
      </div>
    ),
    {
      ...size,
    }
  );
}
