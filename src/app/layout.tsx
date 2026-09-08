import type { Metadata, Viewport } from "next";
import { SerwistProvider } from "@serwist/turbopack/react";
import { AppBanners } from "@/features/pwa/AppBanners";
import { nanumSquareRound } from "@/styles/fonts";
import "./globals.css";

export const metadata: Metadata = {
  title: "다시봄",
  description: "관찰하고 질문하며 문제를 다시 정의하는 하루 5~10분 사고 코칭",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "다시봄",
  },
  other: {
    /*
      iOS 16.4 미만은 manifest의 `display: "standalone"`을 읽지 않는다. 그 버전에서
      홈 화면 아이콘으로 열면 **Safari UI가 그대로 남은 채** 뜬다 — 이 앱의 1차 타깃이
      "iPhone 홈 화면 설치형"인 것을 생각하면 첫인상이 통째로 달라지는 차이다.

      `appleWebApp.capable: true`를 이미 선언했는데도 필요한 이유는, Next 16이 그
      선언을 modern 태그(`mobile-web-app-capable`) 하나로만 내보내기 때문이다
      (node_modules/next/dist/docs/.../generate-metadata.md의 출력 예시로 확인).
      선언한 의도와 실제로 나가는 태그가 어긋나 있어서 직접 넣는다.
    */
    "apple-mobile-web-app-capable": "yes",
  },
  icons: {
    icon: [
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [
      { url: "/icons/apple-touch-icon-180.png", sizes: "180x180", type: "image/png" },
    ],
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  // safe-area(§6.4)를 실제 사용하려면 콘텐츠가 화면 가장자리까지 확장돼야 한다.
  viewportFit: "cover",
  // DESIGN.md §3.4 / §13.4: Splash·재실행 시 빈 흰 화면이 보이지 않도록 canvas와 맞춘다.
  themeColor: "#fffcf7",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko" className={nanumSquareRound.variable}>
      <body className="min-h-dvh bg-canvas">
        {/*
         * skipWaiting을 켜지 않았으므로(원칙 7·8) 새 SW는 자동으로 활성화되지 않는다.
         * reloadOnOnline도 꺼서, 작성 중인 세션이 온라인 복귀만으로 강제 새로고침되지 않게 한다.
         */}
        <SerwistProvider
          swUrl="/serwist/sw.js"
          register
          reloadOnOnline={false}
          disable={process.env.NODE_ENV === "development"}
        >
          {/* 배너를 먼저 그린다 — 문서 흐름에서 화면 위에 붙어야 아무것도 가리지 않는다. */}
          <AppBanners />
          {children}
        </SerwistProvider>
      </body>
    </html>
  );
}
