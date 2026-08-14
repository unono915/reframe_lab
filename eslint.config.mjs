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
            "@/lib/repositories/*",
            "@/lib/ai/*",
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
    files: ["src/features/**/*.{ts,tsx}", "src/components/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: ["@/lib/repositories/*", "@/lib/ai/*"],
        },
      ],
    },
  },
  {
    /**
     * Phase 2 한정 예외. TrainingSessionProvider는 아직 `app/api/**`가 없는 상태에서
     * 인메모리 Repository와 Mock Coach를 직접 오케스트레이션하는 것이 Phase 2의 실제
     * 목표다(DEVELOPMENT_PLAN.md §10 Phase 2 구현 대상). Phase 3에서 Route Handler가
     * 생기면 이 Provider는 fetch('/api/sessions/...')로 바꾸고 이 override를 지운다 —
     * 그 전까지 다른 features/ 코드가 같은 지름길을 쓰지 못하게 이 파일 하나로 좁혀둔다.
     */
    files: ["src/features/training/TrainingSessionProvider.tsx"],
    rules: {
      "no-restricted-imports": "off",
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
