import { ImageResponse } from "next/og"

// Next.js auto-wires this file as og:image and twitter:image for every route
// (the root layout keeps twitter.card = "summary_large_image").
export const alt = "Savvo. Run your raise without a spreadsheet."
export const size = { width: 1200, height: 630 }
export const contentType = "image/png"

export default function OpengraphImage() {
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
          background: "linear-gradient(145deg, #1c1917 0%, #292524 55%, #3b2415 100%)",
          fontFamily: "Georgia, 'Times New Roman', serif",
          position: "relative",
        }}
      >
        {/* Copper glow accent, echoing the site's gradient aesthetic */}
        <div
          style={{
            position: "absolute",
            top: -220,
            right: -160,
            width: 560,
            height: 560,
            borderRadius: 9999,
            background: "radial-gradient(circle, rgba(234,88,12,0.28) 0%, rgba(234,88,12,0) 70%)",
          }}
        />
        <div
          style={{
            position: "absolute",
            bottom: -260,
            left: -180,
            width: 620,
            height: 620,
            borderRadius: 9999,
            background: "radial-gradient(circle, rgba(194,65,12,0.22) 0%, rgba(194,65,12,0) 70%)",
          }}
        />
        <div
          style={{
            fontSize: 148,
            color: "#fafaf9",
            letterSpacing: "-0.03em",
            display: "flex",
          }}
        >
          Savvo
        </div>
        <div
          style={{
            marginTop: 28,
            fontSize: 44,
            color: "#d6d3d1",
            fontFamily: "Helvetica, Arial, sans-serif",
            display: "flex",
          }}
        >
          Run your raise without a spreadsheet
        </div>
        <div
          style={{
            position: "absolute",
            bottom: 44,
            fontSize: 28,
            color: "#ea580c",
            fontFamily: "Helvetica, Arial, sans-serif",
            display: "flex",
          }}
        >
          savvo.app
        </div>
      </div>
    ),
    size
  )
}
