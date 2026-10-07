import { ImageResponse } from "next/og";

export const alt = "OpenAgent — The Local macOS Body for Instinct";
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
          height: "100%",
          width: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          backgroundColor: "#fdfcfc",
          padding: "70px 80px",
          position: "relative",
        }}
      >
        {/* Top Header */}
        <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
          <div
            style={{
              display: "flex",
              fontSize: "28px",
              fontWeight: 700,
              color: "#000000",
              letterSpacing: "-0.03em",
            }}
          >
            OpenAgent
          </div>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "16px",
              fontWeight: 600,
              padding: "4px 10px",
              borderRadius: "6px",
              backgroundColor: "#f5f3f1",
              border: "1px solid #ebe8e4",
              color: "#44403b",
            }}
          >
            macOS
          </div>
          <div
            style={{
              display: "flex",
              marginLeft: "auto",
              fontSize: "16px",
              color: "#777169",
              padding: "6px 16px",
              borderRadius: "9999px",
              border: "1px solid #ebe8e4",
              backgroundColor: "#f5f3f1",
            }}
          >
            openagent.sh
          </div>
        </div>

        {/* Center Headline & Content */}
        <div style={{ display: "flex", flexDirection: "column", gap: "20px", maxWidth: "900px" }}>
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              fontSize: "54px",
              fontWeight: 300,
              lineHeight: 1.1,
              letterSpacing: "-0.03em",
              color: "#000000",
            }}
          >
            <span>Say &quot;Wake up, Jarvis.&quot;</span>
            <span>Then just talk.</span>
          </div>
          <div
            style={{
              display: "flex",
              fontSize: "23px",
              lineHeight: 1.4,
              color: "#777169",
              fontWeight: 400,
            }}
          >
            The local macOS body for Instinct. Always-listening hands-free assistant operating your Mac, real Chrome, and social accounts.
          </div>
        </div>

        {/* Bottom Metadata Badges */}
        <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
          <div
            style={{
              display: "flex",
              padding: "8px 18px",
              borderRadius: "9999px",
              backgroundColor: "#000000",
              color: "#ffffff",
              fontSize: "15px",
              fontWeight: 500,
            }}
          >
            macOS 14 & 15
          </div>
          <div
            style={{
              display: "flex",
              padding: "8px 18px",
              borderRadius: "9999px",
              backgroundColor: "#f5f3f1",
              border: "1px solid #ebe8e4",
              color: "#44403b",
              fontSize: "15px",
              fontWeight: 500,
            }}
          >
            195 Tests Passing
          </div>
          <div
            style={{
              display: "flex",
              padding: "8px 18px",
              borderRadius: "9999px",
              backgroundColor: "#f5f3f1",
              border: "1px solid #ebe8e4",
              color: "#44403b",
              fontSize: "15px",
              fontWeight: 500,
            }}
          >
            55+ Native Tools
          </div>
          <div
            style={{
              display: "flex",
              padding: "8px 18px",
              borderRadius: "9999px",
              backgroundColor: "#f5f3f1",
              border: "1px solid #ebe8e4",
              color: "#44403b",
              fontSize: "15px",
              fontWeight: 500,
            }}
          >
            Zero API Keys Needed
          </div>
        </div>
      </div>
    ),
    {
      ...size,
    }
  );
}
