import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "다시봄",
  description: "관찰하고 질문하며 문제를 다시 정의하는 하루 5~10분 사고 코칭",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
