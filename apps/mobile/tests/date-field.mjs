import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import vm from 'node:vm';
const require = createRequire(import.meta.url);
const ts = require('typescript');
function compile(path, dependencies) {
  const module = { exports: {} };
  const source = ts.transpileModule(
    readFileSync(new URL(path, import.meta.url), 'utf8'),
    {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        jsx: ts.JsxEmit.ReactJSX,
        esModuleInterop: true,
      },
    },
  ).outputText;
  vm.runInNewContext(source, {
    module,
    exports: module.exports,
    Date,
    require: dependencies,
  });
  return module.exports;
}
const dates = compile('../src/lib/onboarding.ts', () => ({}));
for (const value of ['2024-02-29', '2024-04-30', '2000-01-01']) {
  assert.equal(dates.localDate(dates.parseDate(value)), value);
}
for (const value of ['2023-02-29', '2024-04-31', '0000-01-01'])
  assert.equal(dates.parseDate(value), null);
assert.equal(dates.dateLabel('2024-02-29'), '2024년 2월 29일');
assert.equal(dates.dateLabel(''), '날짜 선택');
assert.equal(dates.localDate(new Date(2024, 1, 29, 0, 0)), '2024-02-29');
assert.equal(dates.localDate(new Date(2024, 1, 29, 23, 59)), '2024-02-29');
for (const platform of ['ios', 'android']) {
  let slots = [],
    cursor = 0,
    changes = [],
    handle;
  const element = (type, props) => ({ type, props });
  const react = {
    forwardRef: (render) => render,
    useState: (initial) => {
      const i = cursor++;
      if (!(i in slots)) slots[i] = initial;
      return [
        slots[i],
        (v) => {
          slots[i] = v;
        },
      ];
    },
    useRef: () => ({ current: null }),
    useImperativeHandle: (_, factory) => {
      handle = factory();
    },
  };
  const { DateField } = compile(
    '../src/components/onboarding/date-field.tsx',
    (name) => {
      if (name === 'react') return react;
      if (name === 'react/jsx-runtime')
        return { jsx: element, jsxs: element, Fragment: 'Fragment' };
      if (name === 'react-native')
        return {
          Platform: { OS: platform },
          Keyboard: { dismiss() {} },
          View: 'View',
          Text: 'Text',
          Pressable: 'Pressable',
        };
      if (name.includes('datetimepicker'))
        return { __esModule: true, default: 'Picker' };
      if (name.includes('onboarding')) return dates;
      if (name.includes('action-button'))
        return { ActionButton: 'ActionButton' };
      return { colors: {} };
    },
  );
  const props = {
    label: '생년월일',
    value: '',
    maximum: '2026-11-14',
    onChange: (v) => changes.push(v),
  };
  function render(extra = {}) {
    cursor = 0;
    return DateField({ ...props, ...extra }, null);
  }
  function find(tree, type, label) {
    if (!tree || typeof tree !== 'object') return;
    if (tree.type === type && (!label || tree.props.label === label))
      return tree;
    const children = tree.props?.children;
    for (const child of Array.isArray(children)
      ? children.flat()
      : [children]) {
      const match = find(child, type, label);
      if (match) return match;
    }
  }
  let tree = render();
  assert.equal(find(tree, 'Picker'), undefined);
  handle.focus();
  tree = render();
  assert.equal(changes.length, 0, 'opening a blank date must not commit today');
  find(tree, 'Picker').props.onChange(
    { type: 'set' },
    dates.parseDate('2024-02-29'),
  );
  tree = render();
  if (platform === 'ios') {
    assert.equal(changes.length, 0, 'spinner edits remain pending');
    find(tree, 'ActionButton', '날짜 선택 취소').props.onPress();
    tree = render();
    assert.equal(changes.length, 0);
    handle.focus();
    tree = render();
    find(tree, 'Picker').props.onChange(
      { type: 'set' },
      dates.parseDate('2024-02-29'),
    );
    tree = render();
    find(tree, 'ActionButton', '날짜 선택 완료').props.onPress();
  }
  assert.deepEqual(changes, ['2024-02-29']);
  render({ value: '2020-04-30' });
  handle.focus();
  tree = render({ value: '2020-04-30' });
  assert.equal(dates.localDate(find(tree, 'Picker').props.value), '2020-04-30');
  find(tree, 'Picker').props.onChange({ type: 'dismissed' });
  assert.deepEqual(
    changes,
    ['2024-02-29'],
    'dismissal does not overwrite existing values',
  );
  render({ disabled: true });
  handle.focus();
  assert.equal(find(render({ disabled: true }), 'Picker'), undefined);
  render();
  handle.focus();
  tree = render();
  find(tree, 'Picker').props.onChange(
    { type: 'set' },
    dates.parseDate('2027-01-01'),
  );
  if (platform === 'ios') {
    tree = render();
    find(tree, 'ActionButton', '날짜 선택 완료').props.onPress();
  }
  assert.deepEqual(changes, ['2024-02-29'], 'future birthdays must not commit');
  // Due dates must not inherit the birthday maximum.
  render({ maximum: undefined });
  handle.focus();
  tree = render({ maximum: undefined });
  assert.equal(find(tree, 'Picker').props.maximumDate, undefined);
  find(tree, 'Picker').props.onChange(
    { type: 'set' },
    dates.parseDate('2027-01-01'),
  );
  if (platform === 'ios') {
    tree = render({ maximum: undefined });
    find(tree, 'ActionButton', '날짜 선택 완료').props.onPress();
  }
  assert.deepEqual(changes, ['2024-02-29', '2027-01-01']);
  console.log(
    `PASS ${platform}: pending selection, confirm/cancel, dismissal, disabled, due-date range`,
  );
}
console.log(
  `PASS local dates, leap/month boundaries, Korean label (${process.env.TZ})`,
);
