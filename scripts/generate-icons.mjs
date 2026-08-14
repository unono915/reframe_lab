// 일회성 아이콘 생성 스크립트. next/og(ImageResponse)로 임시 App Icon을 만든다.
// DESIGN.md §17.7: 최종 Logo·App Icon Symbol은 Human Input 대상이다. 여기서 만드는 아이콘은
// §3.2/§3.3이 정의한 임시 Symbol(겹친 두 Frame)의 래스터 버전이며, 확정 전까지만 사용한다.
import { ImageResponse } from "next/og.js";
import { createElement } from "react";
import { mkdir, writeFile } from "node:fs/promises";

const CANVAS = "#FFFCF7";
const BRAND = "#168C80";
const BRAND_STRONG = "#0B6F66";

function symbol({ size, background, safeZoneRatio }) {
  const frameSize = Math.round(size * safeZoneRatio);
  const offset = Math.round(frameSize * 0.22);
  const stroke = Math.max(3, Math.round(size * 0.045));
  const radius = Math.round(frameSize * 0.3);

  return createElement(
    "div",
    {
      style: {
        width: size,
        height: size,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background,
      },
    },
    createElement(
      "div",
      {
        style: {
          position: "relative",
          width: frameSize + offset,
          height: frameSize + offset,
          display: "flex",
        },
      },
      createElement("div", {
        style: {
          position: "absolute",
          left: 0,
          top: offset,
          width: frameSize,
          height: frameSize,
          borderRadius: radius,
          border: `${stroke}px solid ${BRAND}`,
        },
      }),
      createElement("div", {
        style: {
          position: "absolute",
          left: offset,
          top: 0,
          width: frameSize,
          height: frameSize,
          borderRadius: radius,
          border: `${stroke}px solid ${BRAND_STRONG}`,
        },
      }),
    ),
  );
}

const targets = [
  { file: "icon-192.png", size: 192, background: CANVAS, safeZoneRatio: 0.56 },
  { file: "icon-512.png", size: 512, background: CANVAS, safeZoneRatio: 0.56 },
  { file: "icon-maskable-512.png", size: 512, background: CANVAS, safeZoneRatio: 0.42 },
  {
    file: "apple-touch-icon-180.png",
    size: 180,
    background: CANVAS,
    safeZoneRatio: 0.56,
  },
];

await mkdir(new URL("../public/icons/", import.meta.url), { recursive: true });

for (const target of targets) {
  const response = new ImageResponse(symbol(target), {
    width: target.size,
    height: target.size,
  });
  const buffer = Buffer.from(await response.arrayBuffer());
  const outPath = new URL(`../public/icons/${target.file}`, import.meta.url);
  await writeFile(outPath, buffer);
  console.log(`wrote ${target.file} (${buffer.length} bytes)`);
}
