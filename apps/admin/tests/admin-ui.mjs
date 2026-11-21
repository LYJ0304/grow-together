import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import { chromium } from "playwright-core";
const base = process.env.ADMIN_URL ?? "http://127.0.0.1:3001";
const artifacts = process.env.ADMIN_ARTIFACTS ?? "/tmp/grow-admin-screenshots";
await mkdir(artifacts, { recursive: true });
const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH ?? "/usr/bin/chromium",
  headless: true,
  args: ["--no-sandbox", "--disable-dev-shm-usage"],
});
const errors = [];
const external = [];
const page = await browser.newPage({
  viewport: { width: 1440, height: 1000 },
  reducedMotion: "reduce",
});
page.on("pageerror", (error) => errors.push(error.message));
page.on("request", (r) => {
  if (!r.url().startsWith(base) && !r.url().startsWith("data:"))
    external.push(r.url());
});
async function go(route) {
  await page.goto(base + route);
  await page.locator("h1").waitFor();
  await page.waitForFunction(
    () => !document.querySelector('[aria-label="샘플 화면 로딩 중"]'),
  );
}
async function noOverflow(label) {
  assert(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
    `horizontal overflow: ${label}`,
  );
}
try {
  for (const width of process.env.ADMIN_INTERACTIONS_ONLY
    ? []
    : [320, 375, 390, 430, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    for (const route of [
      "/",
      "/users",
      "/ai",
      "/system",
      "/audit",
      "/settings",
      "/login",
    ]) {
      await go(route);
      await noOverflow(`${width} ${route}`);
    }
    await go("/");
    await page.screenshot({
      path: `${artifacts}/overview-${width}.png`,
      fullPage: true,
    });
    if (width === 390) {
      await page
        .getByRole("button", { name: "메뉴 열기", exact: true })
        .click();
      const nav = page.getByRole("dialog");
      for (const name of [
        "Overview",
        "Users",
        "AI Operations",
        "System",
        "Audit Logs",
        "Settings",
      ])
        assert(await nav.getByRole("link", { name, exact: true }).isVisible());
      await nav.getByRole("link", { name: "Users", exact: true }).click();
      await page.waitForURL("**/users");
      await page.getByRole("dialog").waitFor({ state: "hidden" });
    }
  }
  await page.setViewportSize({ width: 1440, height: 1000 });
  await go("/users");
  await page
    .getByRole("textbox", { name: "이름, 이메일 또는 사용자 ID 검색" })
    .fill("USR_0002");
  await page.waitForFunction(() =>
    document.querySelector(".pagination")?.textContent.includes("총 1개"),
  );
  assert(
    await page.getByRole("button", { name: /이서준 usr_0002/ }).isVisible(),
  );
  await page.getByRole("button", { name: /이서준 usr_0002/ }).click();
  await page.getByRole("dialog").waitFor();
  await page
    .getByRole("button", { name: "계정 정지 시뮬레이션", exact: true })
    .click();
  await page.getByRole("alertdialog").waitFor();
  await page.getByRole("button", { name: "취소", exact: true }).click();
  await page.getByRole("alertdialog").waitFor({ state: "hidden" });
  await page
    .getByRole("button", { name: "계정 정지 시뮬레이션", exact: true })
    .click();
  await page
    .getByRole("button", { name: "데모에서 확인", exact: true })
    .click();
  await page
    .getByRole("button", { name: "계정 활성화 시뮬레이션", exact: true })
    .waitFor();
  await page.keyboard.press("Escape");
  await page.getByRole("dialog").waitFor({ state: "hidden" });
  await page
    .getByRole("textbox", { name: "이름, 이메일 또는 사용자 ID 검색" })
    .fill("");
  await page.waitForFunction(() =>
    document.querySelector(".pagination")?.textContent.includes("총 128개"),
  );
  await page.getByRole("button", { name: "다음 페이지", exact: true }).click();
  await page.waitForFunction(() =>
    document.querySelector(".pagination")?.textContent.includes("2 / 16"),
  );
  await page
    .getByRole("combobox", { name: "계정 상태", exact: true })
    .selectOption("suspended");
  await page.waitForFunction(
    () => !document.querySelector('[aria-label="샘플 화면 로딩 중"]'),
  );
  assert((await page.locator("tbody tr").count()) > 0);
  assert(
    (await page.locator("tbody tr").allTextContents()).every((t) =>
      t.includes("정지"),
    ),
  );
  await page
    .getByRole("textbox", { name: "이름, 이메일 또는 사용자 ID 검색" })
    .fill("no-such-user");
  await page.getByRole("heading", { name: "표시할 항목이 없어요" }).waitFor();
  await page.getByRole("button", { name: "필터 초기화", exact: true }).click();
  await go("/ai");
  await page
    .getByRole("combobox", { name: "기간", exact: true })
    .selectOption("30");
  await page
    .getByRole("combobox", { name: "AI 기능", exact: true })
    .selectOption("chat");
  await page.waitForFunction(
    () => !document.querySelector('[aria-label="샘플 화면 로딩 중"]'),
  );
  assert((await page.getByText("Planned", { exact: true }).count()) === 2);
  const chart = page.locator(".recharts-wrapper").first();
  await chart.click({ position: { x: 120, y: 80 } });
  await page
    .locator(".recharts-tooltip-wrapper")
    .first()
    .waitFor({ state: "visible" });
  await go("/audit");
  await page
    .getByRole("textbox", { name: "작업자, 작업 유형 또는 대상 검색" })
    .fill("settings.update");
  await page.waitForFunction(() =>
    document.querySelector("tbody")?.textContent.includes("settings.update"),
  );
  assert(
    (await page.locator("tbody tr").allTextContents()).every((t) =>
      t.includes("settings.update"),
    ),
  );
  await go("/settings");
  const flag = page.getByRole("switch", { name: "Chat AI 데모 설정" });
  const before = await flag.getAttribute("aria-checked");
  await flag.click();
  assert.notEqual(await flag.getAttribute("aria-checked"), before);
  await page
    .getByRole("textbox", { name: "워크스페이스 이름", exact: true })
    .fill("Demo review");
  await page
    .getByRole("button", { name: "데모 설정 저장", exact: true })
    .click();
  await page
    .locator(".workspace-name")
    .filter({ hasText: "Demo review" })
    .waitFor();
  await page
    .getByRole("textbox", { name: "워크스페이스 이름", exact: true })
    .fill("Unsaved");
  await page.getByRole("button", { name: "데모 초기화", exact: true }).click();
  await page
    .getByRole("button", { name: "데모에서 확인", exact: true })
    .click();
  await page.waitForFunction(
    () =>
      document.querySelector(".workspace-name")?.textContent ===
      "Grow Together",
  );
  assert.equal(
    await page
      .getByRole("textbox", { name: "워크스페이스 이름", exact: true })
      .inputValue(),
    "Grow Together",
  );
  await page
    .getByRole("combobox", { name: "화면 상태 미리보기" })
    .selectOption("loading");
  await page.getByRole("status", { name: "샘플 화면 로딩 중" }).waitFor();
  await page
    .getByRole("combobox", { name: "화면 상태 미리보기" })
    .selectOption("error");
  await page.getByRole("heading", { name: "데모 오류 상태" }).waitFor();
  await page.getByRole("button", { name: "정상 샘플로 돌아가기" }).click();
  await page
    .getByRole("combobox", { name: "화면 상태 미리보기" })
    .selectOption("empty");
  await page
    .getByRole("heading", { name: "데이터가 없는 화면 미리보기" })
    .waitFor();
  await page
    .getByRole("button", { name: "샘플 다시 보기", exact: true })
    .click();
  await go("/login");
  await page.getByRole("button", { name: "데모 로그인", exact: true }).click();
  await page.locator(".form-error[role=alert]").waitFor();
  await page.getByLabel("임의 비밀번호").fill("sample-only");
  await page.getByRole("button", { name: "데모 로그인", exact: true }).click();
  await page.waitForURL(base + "/");
  assert.equal(
    await page.evaluate(() => sessionStorage.getItem("grow-admin-demo")),
    "active",
  );
  assert.equal(
    await page.evaluate(() =>
      JSON.stringify(sessionStorage).includes("sample-only"),
    ),
    false,
  );
  await page.setViewportSize({ width: 390, height: 844 });
  await go("/users");
  await page.getByRole("button", { name: "필터", exact: true }).click();
  await page
    .getByRole("dialog")
    .getByRole("combobox", { name: "계정 상태", exact: true })
    .selectOption("active");
  await page.getByRole("button", { name: "필터 적용", exact: true }).click();
  await page.waitForFunction(
    () => !document.querySelector('[aria-label="샘플 화면 로딩 중"]'),
  );
  await page.locator(".mobile-list-item").first().click();
  await page.getByRole("dialog").waitFor();
  await noOverflow("mobile detail");
  await page.screenshot({
    path: `${artifacts}/user-detail-mobile.png`,
    fullPage: true,
  });
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "닫기", exact: true })
    .click();
  await page.getByRole("dialog").waitFor({ state: "hidden" });
  await page.screenshot({
    path: `${artifacts}/users-mobile.png`,
    fullPage: true,
  });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await go("/users");
  await page.screenshot({
    path: `${artifacts}/users-desktop.png`,
    fullPage: true,
  });
  assert.deepEqual(errors, []);
  assert.deepEqual(external, []);
  console.log(
    "PASS: 49 route/viewport overflow checks; navigation, users, dialogs, filters, chart, audit, settings, demo states and login.",
  );
} finally {
  await browser.close();
}
