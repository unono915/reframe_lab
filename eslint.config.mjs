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
          patterns: ["@/lib/repositories/*", "@/lib/ai/*", "@/lib/supabase/*", "@supabase/*"],
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
