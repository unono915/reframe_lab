import nextCoreWebVitals from "eslint-config-next/core-web-vitals";
import nextTypescript from "eslint-config-next/typescript";

/**
 * 레이어 경계 규칙 (DEVELOPMENT_PLAN.md §4.1).
 * `domain/`이 유일한 상태 전환 판정자로 남으려면, 이 레이어가 React·Next·외부 SDK를
 * import하지 못하게 lint 레벨에서 강제해야 한다. Phase 4에서 실제 AI Provider SDK
 * 패키지명을 추가하면 domain 블록의 patterns에도 추가한다.
 */
const layerBoundaries = [
  {
    files: ["src/domain/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          paths: ["react", "react-dom"],
          patterns: [
            "next",
            "next/*",
            "@supabase/*",
            "@/lib/*",
            "@/features/*",
            "@/components/*",
            "@/app/*",
          ],
        },
      ],
    },
  },
  {
    files: ["src/lib/schemas/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          paths: ["react", "react-dom"],
          patterns: [
            "next",
            "next/*",
            "@supabase/*",
            "@/lib/repositories/*",
            "@/lib/ai/*",
            "@/lib/supabase/*",
            "@/lib/auth/*",
            "@/features/*",
            "@/components/*",
            "@/app/*",
          ],
        },
      ],
    },
  },
  {
    files: ["src/lib/repositories/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          paths: ["react", "react-dom"],
          patterns: ["@/features/*", "@/components/*", "@/app/*"],
        },
      ],
    },
  },
  {
    files: ["src/lib/ai/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          paths: ["react", "react-dom"],
          patterns: ["@/features/*", "@/components/*", "@/app/*", "@/lib/repositories/*"],
        },
      ],
    },
  },
  {
    /**
     * `features/`·`components/`는 Supabase SDK를 직접 만지지 않는다. 로그인·가입 등은
     * `lib/auth/`가 제공하는 얇은 함수를 통해서만 호출한다 — repositories/ai와 같은
     * Adapter 경계 원칙을 인증에도 동일하게 적용한다.
     */
    files: ["src/features/**/*.{ts,tsx}", "src/components/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            "@/lib/repositories/*",
            "@/lib/ai/*",
            "@/lib/supabase/*",
            "@supabase/*",
          ],
        },
      ],
    },
  },
  {
    // 화면(`src/app/**/*.tsx` — page·layout)에도 같은 경계를 건다. `features/`와
    // `components/`만 막고 있었는데, 화면 파일은 그 규칙 밖이라 구멍이 있었다.
    //
    // 이게 왜 보안 문제인가: 이 앱의 AI 제공자 Adapter는 **서버 전용 API Key**를
    // 읽는다(원칙 9). 클라이언트 컴포넌트가 `@/lib/ai/*`를 import하면 그 모듈이
    // 클라이언트 번들에 딸려 들어가고, 서버 전용 값이 브라우저로 나갈 길이 생긴다.
    // 저장소·Supabase SDK도 같은 이유로 화면이 직접 만지지 않는다 — 데이터 접근은
    // Route Handler(`src/app/api/**`)를 거쳐야 인증·멱등성·오류 코드가 지켜진다.
    //
    // `.tsx`만 고른 이유: Route Handler는 전부 `.ts`이고, 그쪽은 서버라 이 import들이
    // 정상이다.
    files: ["src/app/**/*.tsx"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            "@/lib/repositories/*",
            "@/lib/ai/*",
            "@/lib/supabase/*",
            "@supabase/*",
          ],
        },
      ],
    },
  },
];

const eslintConfig = [
  ...nextCoreWebVitals,
  ...nextTypescript,
  ...layerBoundaries,
  {
    rules: {
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
    },
  },
  {
    ignores: [
      "node_modules/**",
      ".next/**",
      "public/sw.js",
      "playwright-report/**",
      "test-results/**",
      "coverage/**",
    ],
  },
];

export default eslintConfig;
