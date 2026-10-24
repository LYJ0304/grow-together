import { authenticatedSessionFixture } from './auth-fixture.mjs';
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
await page.addInitScript(authenticatedSessionFixture);
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
  assert(iconBounds.y + iconBounds.height <= titleBounds.y);
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
  await chooser.setFiles(
    [0, 1, 2].map((index) => ({
      name: `photo-${index}.png`,
      mimeType: 'image/png',
      buffer: Buffer.from(
        'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aH9sAAAAASUVORK5CYII=',
        'base64',
      ),
    })),
  );
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
  await page.getByRole('button', { name: /^다시 생성하기/ }).waitFor();
  await click('뒤로가기');
  assert.equal(await note().inputValue(), '혼자 숟가락을 잡았어요.');
  assert(
    await page.getByRole('button', { name: '첨부 사진 변경' }).isVisible(),
  );
  await click('작성 중인 일기로 돌아가기');
  assert.equal(
    await page.getByRole('img', { name: /^일기 사진 [123], 총 3장$/ }).count(),
    3,
  );
  await page
    .getByRole('button', { name: '이 일기 저장하기', exact: true })
    .waitFor();
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
  await click('이 일기 저장하기');
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

  // Deletion uses the existing viewer and updates both calendar and cached data.
  await click('선택한 날짜의 일기 보기');
  await ready();
  await waitForText(dateLabel);
  for (const name of ['일기 삭제', '캘린더로 돌아가기']) {
    const bounds = await page
      .getByRole('button', { name, exact: true })
      .boundingBox();
    assert(bounds.x >= 0 && bounds.x + bounds.width <= 320);
    assert(bounds.y >= 0 && bounds.y + bounds.height <= 640);
    assert(bounds.height >= 44);
  }
  await page.screenshot({ path: '/tmp/growtogether-issue-56-view.png' });
  await click('일기 삭제');
  await page.getByRole('dialog').waitFor();
  await waitForText('삭제한 일기는 복구할 수 없어요.');
  await page.screenshot({ path: '/tmp/growtogether-issue-56-confirm.png' });
  for (const name of ['취소', '삭제']) {
    const bounds = await page
      .getByRole('button', { name, exact: true })
      .boundingBox();
    assert(bounds.x >= 0 && bounds.x + bounds.width <= 320);
    assert(bounds.height >= 44);
  }
  await click('취소');
  assert(await page.getByText('저장된 일기', { exact: true }).isVisible());
  assert(
    await page.evaluate(
      (key) => !!localStorage.getItem(key),
      `@growtogether/diary/v1/${date}`,
    ),
  );
  // Keep another date to detect accidental whole-store deletion.
  await page.evaluate(
    ({ date }) => {
      const key = `@growtogether/diary/v1/${date}`;
      const diary = JSON.parse(localStorage.getItem(key));
      localStorage.setItem(
        '@growtogether/diary/v1/2026-10-09',
        JSON.stringify({ ...diary, date: '2026-10-09' }),
      );
      const removeItem = Storage.prototype.removeItem;
      window.diaryDeleteCalls = 0;
      Storage.prototype.removeItem = function (key) {
        if (key === `@growtogether/diary/v1/${date}`) {
          window.diaryDeleteCalls++;
          if (window.failDiaryDelete) throw new Error('Unavailable');
          return new Promise((resolve) => {
            window.finishDiaryDelete = () => {
              removeItem.call(this, key);
              resolve();
            };
          });
        }
        return removeItem.call(this, key);
      };
      window.failDiaryDelete = true;
    },
    { date },
  );
  await click('일기 삭제');
  await click('삭제');
  await waitForText('일기를 삭제하지 못했어요. 다시 시도해주세요.');
  assert(
    await page.evaluate(
      (key) => !!localStorage.getItem(key),
      `@growtogether/diary/v1/${date}`,
    ),
  );
  await page.evaluate(() => {
    window.failDiaryDelete = false;
  });
  await click('삭제');
  const deletingButton = page.getByRole('button', {
    name: '삭제 중...',
    exact: true,
  });
  await deletingButton.waitFor();
  assert(await deletingButton.isDisabled());
  assert(
    await page.getByRole('button', { name: '취소', exact: true }).isDisabled(),
  );
  assert(await page.locator('[aria-label="뒤로가기"]').isDisabled());
  await deletingButton.dispatchEvent('click');
  await page.keyboard.press('Escape');
  assert(await page.getByRole('dialog').isVisible());
  await page.evaluate(() => history.back());
  await page.waitForTimeout(300);
  assert.equal(new URL(page.url()).pathname, '/diary');
  assert(await page.getByText('저장된 일기', { exact: true }).isVisible());
  assert(await page.getByRole('dialog').isVisible());
  assert.equal(await page.evaluate(() => window.diaryDeleteCalls), 2);
  await page.evaluate(() => window.finishDiaryDelete());
  await assertCalendar();
  await waitForText('일기를 삭제했어요.');
  await page
    .getByRole('button', { name: '선택한 날짜의 일기 생성하기', exact: true })
    .waitFor();
  assert.equal(
    await page
      .getByRole('button', { name: dateLabel, exact: true })
      .getAttribute('aria-pressed'),
    'true',
  );
  assert(
    await page.evaluate(
      () => !!localStorage.getItem('@growtogether/diary/v1/2026-10-09'),
    ),
  );
  // A direct visit after deletion must also show the empty state.
  await page.goto(`${siteUrl}/diary?date=${date}&mode=view`);
  await ready();
  await waitForText('이 날짜에 저장된 일기가 없어요.');
  await click('뒤로가기');
  await assertCalendar();
  await click('선택한 날짜의 일기 생성하기');
  await ready();
  await click('다음으로');
  await note().fill('삭제 후 다시 작성한 일기');
  await click('일기 생성하기');
  await page.getByRole('button', { name: /^다시 생성하기/ }).waitFor();
  await click('이 일기 저장하기');
  await assertCalendar();
  await waitForText('일기를 저장했어요.');
  await click('선택한 날짜의 일기 보기');
  await ready();
  await waitForText('저장된 일기');
  assert(
    (await page.locator('body').innerText()).includes(
      '삭제 후 다시 작성한 일기',
    ),
  );
  await click('뒤로가기');
  await assertCalendar();

  await page.evaluate(() =>
    localStorage.removeItem('@growtogether/diary/v1/2026-10-09'),
  );

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
  // Loading and corrupt-data retry remain available in the saved viewer.
  await page.addInitScript(() => {
    const getItem = Storage.prototype.getItem;
    Storage.prototype.getItem = function (key) {
      if (key === '@growtogether/diary/v1/2026-10-06') {
        Storage.prototype.getItem = getItem;
        return new Promise((resolve) => {
          window.finishDiaryRead = () => resolve('{broken');
        });
      }
      return getItem.call(this, key);
    };
  });
  await page.goto(`${siteUrl}/diary?date=2026-10-06&mode=view`);
  await ready();
  await waitForText('저장된 일기를 불러오는 중이에요.');
  await page.evaluate(() => window.finishDiaryRead());
  await waitForText('저장된 일기를 불러오지 못했어요. 다시 시도해주세요.');
  await page.evaluate(() =>
    localStorage.setItem(
      '@growtogether/diary/v1/2026-10-06',
      JSON.stringify({
        date: '2026-10-06',
        content: '다시 불러온 일기',
        photoUris: [],
        emotions: ['기쁨'],
        growthPoints: ['스스로 걸었어요.'],
      }),
    ),
  );
  await click('다시 불러오기');
  await waitForText('다시 불러온 일기');
  await waitForText('2026년 10월 6일');
  await waitForText('기쁨');
  await waitForText('· 스스로 걸었어요.');
  console.log(
    'PASS diary deletion confirmation/cancel/failure/retry, duplicate prevention, recreation, calendar updates, and diary back navigation, direct entry, selected date, record/note/tag/photo retention, saved and missing entries, and 320px header layout',
  );
} catch (error) {
  console.error(await page.locator('body').innerText());
  throw error;
} finally {
  await browser.close();
}
