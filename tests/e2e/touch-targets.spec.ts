import { expect, test, type Page } from "@playwright/test";
import { resetActiveSession } from "./helpers/cleanup";
import {
  completeSelfAssessment,
  fillStagesUntilFeedback,
  fillStagesUntilQuestioning,
  settle,
} from "./helpers/training-flow";

/**
 * 손가락으로 누를 수 있는 크기인지 확인한다 (DESIGN.md §6 최소 44×44px).
 *
 * `accessibility.spec.ts`의 axe 검사는 이걸 보지 않는다 — 대비·라벨·역할은 잡지만
 * "너무 작아서 못 누른다"는 잡지 못한다. 그런데 이 앱의 1차 타깃은 손으로 쓰는
 * iPhone이고, 실제로 P1 작업에서 자기 점검 라디오가 20px이라 세그먼트로 바꾼 적이
 * 있다. 그때는 눈으로 발견했다.
 *
 * 기준은 DESIGN.md가 정한 값이라 임의로 낮추지 않는다(§8). 이 테스트가 깨지면
 * 기준을 고칠 것이 아니라 화면을 고쳐야 한다.
 */
test.skip(
  !process.env.E2E_TEST_EMAIL || !process.env.E2E_TEST_PASSWORD,
  "E2E_TEST_EMAIL/PASSWORD 미설정 — 로그인 필요한 E2E는 건너뜀 (.env.example 참고)",
);

const MIN_TOUCH_PX = 44;

test.beforeEach(async ({ request }) => {
  await resetActiveSession(request);
});

interface SmallTarget {
  tag: string;
  text: string;
  width: number;
  height: number;
}

async function tooSmallTargets(page: Page, min: number): Promise<SmallTarget[]> {
  return page.evaluate((minPx) => {
    const found: SmallTarget[] = [];
    const nodes = document.querySelectorAll(
      "button, a, input, textarea, select, label, [role='button']",
    );
    for (const element of Array.from(nodes)) {
      /*
        라벨은 두 종류라 구분해야 한다.
        - 입력을 **감싸는** 라벨(자기 점검 세그먼트): 손가락이 닿는 자리가 여기다.
          안의 입력은 `sr-only`로 1px까지 줄여두므로, 라벨을 안 보면 정작 눌리는
          것을 재지 않게 된다.
        - 입력 **옆에 붙는** 설명 라벨(`Field`의 "새 질문" 같은 문구): 누르는 자리가
          아니라 글자다. 44px을 요구할 대상이 아니다.
      */
      if (
        element.tagName === "LABEL" &&
        !element.querySelector("input, select, textarea")
      )
        continue;

      const rect = element.getBoundingClientRect();
      // 숨어 있는 것은 누를 수 없으므로 대상이 아니다.
      if (rect.width === 0 && rect.height === 0) continue;
      // 스크린리더 전용으로 1px까지 줄여둔 입력은 손가락이 닿는 자리가 아니다 —
      // 그 자리는 감싸고 있는 라벨이고, 그 라벨이 위에서 따로 검사된다.
      if (rect.width <= 2 && rect.height <= 2) continue;
      if (rect.width < minPx || rect.height < minPx) {
        found.push({
          tag: element.tagName.toLowerCase(),
          text: (element.textContent ?? "").trim().slice(0, 40),
          width: Math.round(rect.width),
          height: Math.round(rect.height),
        });
      }
    }
    return found;
  }, min) as Promise<SmallTarget[]>;
}

/** 이 검사는 손가락 기준이다 — 데스크톱 뷰포트에서는 의미가 없다. */
async function skipUnlessMobile(page: Page): Promise<boolean> {
  const width = page.viewportSize()?.width ?? 0;
  return width > 0 && width < 768;
}

test("주요 화면의 누를 수 있는 것들이 44px 이상이다", async ({ page }) => {
  test.skip(!(await skipUnlessMobile(page)), "손가락 기준 검사 — 모바일 뷰포트만");

  for (const path of ["/", "/history", "/growth", "/auth/login", "/onboarding"]) {
    await page.goto(path);
    await settle(page);
    const small = await tooSmallTargets(page, MIN_TOUCH_PX);
    expect(small, `${path}에 44px 미만인 조작 요소가 있다`).toEqual([]);
  }
});

test("훈련 화면의 누를 수 있는 것들이 44px 이상이다", async ({ page }) => {
  test.skip(!(await skipUnlessMobile(page)), "손가락 기준 검사 — 모바일 뷰포트만");

  await page.goto("/training/new");
  await fillStagesUntilQuestioning(page);
  await settle(page);
  expect(
    await tooSmallTargets(page, MIN_TOUCH_PX),
    "질문 단계에 44px 미만인 조작 요소가 있다",
  ).toEqual([]);
});

test("자기 점검 세그먼트가 44px 이상이다", async ({ page }) => {
  test.skip(!(await skipUnlessMobile(page)), "손가락 기준 검사 — 모바일 뷰포트만");

  // 이 화면을 따로 보는 이유: 여기 있던 라디오 20px이 실제로 기준 미달이었고,
  // 세그먼트로 바꾸면서 고쳤다. 되돌아가지 않도록 잠근다.
  await page.goto("/training/new");
  await fillStagesUntilFeedback(page);
  await settle(page);
  expect(
    await tooSmallTargets(page, MIN_TOUCH_PX),
    "자기 점검 폼에 44px 미만인 조작 요소가 있다",
  ).toEqual([]);

  await completeSelfAssessment(page);
  await settle(page);
  expect(
    await tooSmallTargets(page, MIN_TOUCH_PX),
    "자기 점검을 마친 뒤 화면에 44px 미만인 조작 요소가 있다",
  ).toEqual([]);
});
