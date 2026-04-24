import { ImageResponse } from "next/og"
import { readFile } from "node:fs/promises"
import { join } from "node:path"

export const alt = "DeckyVault - Steam Deck Benchmarks & Settings"
export const size = {
    width: 1200,
    height: 630,
}
export const contentType = "image/png"

export default async function Image() {
    const logoData = await readFile(
        join(process.cwd(), "app/icon.png"),
        "base64"
    )
    const logoSrc = `data:image/png;base64,${logoData}`

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
                    background: "#100b14",
                    color: "#ebe4f1",
                    fontFamily: "sans-serif",
                    gap: "16px",
                }}
            >
                <img
                    src={logoSrc}
                    alt="DeckyVault"
                    height={120}
                    style={{ borderRadius: "16px" }}
                />
                <div
                    style={{
                        fontSize: 64,
                        fontWeight: 700,
                        letterSpacing: "-0.02em",
                    }}
                >
                    DeckyVault
                </div>
                <div
                    style={{
                        fontSize: 28,
                        fontWeight: 400,
                        opacity: 0.8,
                    }}
                >
                    Steam Deck Benchmarks & Settings
                </div>
            </div>
        ),
        {
            ...size,
        }
    )
}
