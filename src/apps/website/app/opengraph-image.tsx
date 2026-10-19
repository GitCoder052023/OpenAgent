import { ImageResponse } from "next/og";
import { toolCount } from "@/lib/tools";

export const alt = "OpenAgent — Instinct thinks. OpenAgent acts.";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          background: "#fdfcfc",
          padding: "72px 80px",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between" }}>
          <div style={{ display: "flex", fontSize: 24, color: "#000000" }}>
            OpenAgent
          </div>
          <div style={{ display: "flex", fontSize: 20, color: "#a59f97" }}>
            macOS · MIT · active beta
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column" }}>
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              fontSize: 92,
              lineHeight: 1.05,
              letterSpacing: "-0.025em",
              color: "#000000",
            }}
          >
            <span>Instinct thinks.</span>
            <span>OpenAgent acts.</span>
          </div>
          <div
            style={{
              display: "flex",
              marginTop: 40,
              fontSize: 26,
              color: "#777169",
              maxWidth: 820,
            }}
          >
            A local macOS execution environment with {toolCount} callable tools.
          </div>
        </div>

        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            borderTop: "1px solid #ebe8e4",
            paddingTop: 24,
            fontSize: 20,
            color: "#777169",
          }}
        >
          <div style={{ display: "flex" }}>
            shell · native apps · chrome · social · whatsapp · mcp
          </div>
          <div style={{ display: "flex", color: "#a59f97" }}>
            github.com/GitCoder052023/OpenAgent
          </div>
        </div>
      </div>
    ),
    size,
  );
}
