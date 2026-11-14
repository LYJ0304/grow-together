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
  await modal
    .getByRole('textbox', { name: '연도 바로 입력', exact: true })
    .fill(String(year));
  for (const [part, number, suffix] of [
    ['month', month, '월'],
    ['day', day, '일'],
  ]) {
    await modal
      .getByTestId(`date-${part}-options`)
      .evaluate((element, number) => {
        element.scrollTop = (number - 1) * 48;
      }, number);
    await modal
      .getByRole('radio', { name: `${number}${suffix}`, exact: true })
      .click();
  }
}
