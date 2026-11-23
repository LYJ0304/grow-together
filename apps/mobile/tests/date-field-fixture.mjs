// Use the same explicit selection flow as the app; opening never commits.
export async function selectDate(page, label, value) {
  await page.getByRole('button', { name: label, exact: true }).click();
  const modal = page.getByRole('dialog', {
    name: `${label} 선택`,
    exact: true,
  });
  await editDateParts(modal, value);
  await modal.getByRole('button', { name: '완료', exact: true }).click();
}
export async function editDateParts(modal, value) {
  const [year, month, day] = value.split('-').map(Number);
  for (const [part, number, suffix] of [
    ['year', year, '년'],
    ['month', month, '월'],
    ['day', day, '일'],
  ]) {
    const wheel = modal.getByTestId(`date-${part}-options`);
    const selected = wheel.locator('[role="radio"][aria-checked="true"]');
    const previous = Number(
      (await selected.getAttribute('aria-label')).slice(0, -1),
    );
    if (previous === number) continue;
    const row = await selected.boundingBox();
    await wheel.evaluate(
      (element, delta) => {
        element.scrollTop += delta;
      },
      (part === 'year' ? previous - number : number - previous) * row.height,
    );
    const option = wheel.getByRole('radio', {
      name: `${number}${suffix}`,
      exact: true,
    });
    await option.and(wheel.locator('[aria-checked="true"]')).waitFor();
  }
}
