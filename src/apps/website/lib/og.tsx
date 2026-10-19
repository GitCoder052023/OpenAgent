import { ImageResponse } from "next/og";

export const ogSize = { width: 1200, height: 630 };
export const ogContentType = "image/png";

/**
 * One share-card template for every route, in the same editorial system as the
 * site: eggshell canvas, black whisper-weight display type, a hairline rule and
 * mono metadata. Each route supplies its own eyebrow, headline and summary so
 * a shared link says which page it points at.
 */
export function renderOgImage({
  eyebrow,
  lines,
  summary,
  footer,
}: {
  eyebrow: string;
  lines: string[];
  summary: string;
  footer: string;
}) {
  const fontSize = lines.length > 2 ? 72 : 88;

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
          padding: "68px 80px",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between" }}>
          <div style={{ display: "flex", fontSize: 24, color: "#000000" }}>
            OpenAgent
          </div>
          <div style={{ display: "flex", fontSize: 20, color: "#777169" }}>
            {eyebrow}
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column" }}>
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              fontSize,
              lineHeight: 1.05,
              letterSpacing: "-0.025em",
              color: "#000000",
            }}
          >
            {lines.map((line) => (
              <span key={line}>{line}</span>
            ))}
          </div>
          <div
            style={{
              display: "flex",
              marginTop: 36,
              fontSize: 25,
              lineHeight: 1.4,
              color: "#777169",
              maxWidth: 900,
            }}
          >
            {summary}
          </div>
        </div>

        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            borderTop: "1px solid #ebe8e4",
            paddingTop: 22,
            fontSize: 19,
            color: "#777169",
          }}
        >
          <div style={{ display: "flex" }}>{footer}</div>
          <div style={{ display: "flex", color: "#a59f97" }}>
            github.com/GitCoder052023/OpenAgent
          </div>
        </div>
      </div>
    ),
    ogSize,
  );
}
