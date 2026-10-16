import assert from 'node:assert/strict';
import { Buffer } from 'node:buffer';
import { chromium } from 'playwright-core';

// Run against an exported web build. Each run uses isolated browser storage.
const siteUrl = process.argv[2] ?? 'http://localhost:8095';
const browser = await chromium.launch({
  executablePath: process.env.CHROME_PATH ?? '/usr/bin/google-chrome',
  headless: true,
  args: ['--no-sandbox'],
});
const page = await browser.newPage({ viewport: { width: 320, height: 640 } });
const back = () => page.getByRole('button', { name: '뒤로가기', exact: true });
const click = (name) => page.getByRole('button', { name, exact: true }).click();
const note = () =>
  page.getByRole('textbox', { name: '오늘의 성장 한 줄 기록' });
const waitForText = (text) => page.getByText(text, { exact: true }).waitFor();
const date = '2026-10-08';
const dateLabel = '2026년 10월 8일';

async function ready() {
  await back().waitFor();
  await page.waitForFunction(() => {
    const button = document.querySelector('[aria-label="뒤로가기"]');
    return (
      button &&
      Object.keys(button).some((key) => key.startsWith('__reactProps'))
    );
  });
}

async function assertCalendar() {
  await page.waitForURL('**/calendar*');
  await page.waitForFunction(
    (label) =>
      document
        .querySelector(
          `[aria-label="${label}"], [aria-label="${label}, 일기 있음"]`,
        )
        ?.getAttribute('aria-pressed') === 'true',
    dateLabel,
  );
}

try {
  // Direct entry has no app screen to pop; it must still return to this date.
  await page.goto(`${siteUrl}/diary?date=${date}&mode=create`);
  await ready();
  const iconBounds = await back().boundingBox();
  const titleBounds = await page
    .getByRole('heading', { name: 'AI 육아 일기 생성' })
    .boundingBox();
  assert(iconBounds.width >= 44 && iconBounds.height >= 44);
  assert(iconBounds.x + iconBounds.width <= titleBounds.x);
  assert(titleBounds.x + titleBounds.width <= 320);
  await click('뒤로가기');
  await assertCalendar();

  // Enter from the calendar, then walk backwards through every writing step.
  await click('선택한 날짜의 일기 생성하기');
  await ready();
  const record = page.getByRole('checkbox').first();
  await record.click();
  await click('다음으로');
  await note().fill('혼자 숟가락을 잡았어요.');
  await click('#성취/시도');
  const chooserPromise = page.waitForEvent('filechooser');
  await click('사진 첨부');
  const chooser = await chooserPromise;
  await chooser.setFiles({
    name: 'photo.png',
    mimeType: 'image/png',
    buffer: Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aH9sAAAAASUVORK5CYII=',
      'base64',
    ),
  });
  await page.getByRole('button', { name: '첨부 사진 변경' }).waitFor();
  await click('뒤로가기');
  assert.equal(await record.getAttribute('aria-checked'), 'true');
  await click('다음으로');
  assert.equal(await note().inputValue(), '혼자 숟가락을 잡았어요.');
  assert.equal(
    await page
      .getByRole('button', { name: '#성취/시도', exact: true })
      .getAttribute('aria-pressed'),
    'true',
  );
  assert(
    await page.getByRole('button', { name: '첨부 사진 변경' }).isVisible(),
  );
  await click('일기 생성하기');
  await page.getByRole('dialog').waitFor();
  await page.keyboard.press('Escape');
  await note().waitFor();
  await page.waitForTimeout(3200);
  assert(await note().isVisible());
  await click('일기 생성하기');
  await page.getByRole('button', { name: /^다시 생성하기/ }).waitFor();
  await click('다음으로');
  await page.getByRole('button', { name: '저장하기', exact: true }).waitFor();
  await click('뒤로가기');
  await page.getByRole('button', { name: '다음으로', exact: true }).waitFor();
  await click('뒤로가기');
  assert.equal(await note().inputValue(), '혼자 숟가락을 잡았어요.');
  assert(
    await page.getByRole('button', { name: '첨부 사진 변경' }).isVisible(),
  );
  await click('일기 생성하기');
  await page.getByRole('button', { name: /^다시 생성하기/ }).waitFor();
  await click('다음으로');
  // Hold the storage read so the saving state can be observed before it completes.
  await page.evaluate((diaryDate) => {
    const getItem = Storage.prototype.getItem;
    Storage.prototype.getItem = function (key) {
      if (key === `@growtogether/diary/v1/${diaryDate}`) {
        Storage.prototype.getItem = getItem;
        return new Promise((resolve) => {
          window.finishDiarySave = () => resolve(getItem.call(this, key));
        });
      }
      return getItem.call(this, key);
    };
  }, date);
  await click('저장하기');
  await page.getByRole('button', { name: '저장 중...', exact: true }).waitFor();
  assert(await back().isDisabled());
  await back().dispatchEvent('click');
  assert(new URL(page.url()).pathname === '/diary');
  await page.evaluate(() => window.finishDiarySave());
  await assertCalendar();
  await click('선택한 날짜의 일기 보기');
  await ready();
  await waitForText('저장된 일기');
  await click('뒤로가기');
  await assertCalendar();

  // Returning from step one must pop the calendar that opened the diary.
  await page.goto(`${siteUrl}/diary?date=2026-10-09&mode=create`);
  await ready();
  await click('뒤로가기');
  await page.waitForURL('**/calendar*');
  await click('선택한 날짜의 일기 생성하기');
  await ready();
  await click('뒤로가기');
  await page.waitForURL('**/calendar*');

  // Missing saved entries also expose the same top-left exit.
  await page.goto(`${siteUrl}/diary?date=2026-10-07&mode=view`);
  await ready();
  await waitForText('이 날짜에 저장된 일기가 없어요.');
  await click('뒤로가기');
  await page.waitForURL('**/calendar*');
  console.log(
    'PASS diary back navigation, direct entry, selected date, record/note/tag/photo retention, saved and missing entries, and 320px header layout',
  );
} catch (error) {
  console.error(await page.locator('body').innerText());
  throw error;
} finally {
  await browser.close();
}
