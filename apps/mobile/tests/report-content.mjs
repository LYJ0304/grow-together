import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
const callbacks = [];
const host = (tag) =>
  function Host({ children, ...props }) {
    return React.createElement(
      tag,
      { role: props.accessibilityRole, 'aria-label': props.accessibilityLabel },
      children,
    );
  };
const Native = {
  View: host('section'),
  Text: host('span'),
  StyleSheet: { create: (x) => x, hairlineWidth: 1 },
};
const button = (props) => {
  callbacks.push(props);
  return React.createElement(
    'button',
    { disabled: props.disabled },
    props.label ?? props.children,
  );
};
const exports = {};
const imports = {
  'react/jsx-runtime': await import('react/jsx-runtime'),
  'react-native': Native,
  '../../theme/colors': { colors: {} },
  '../typography': { typography: {} },
  '../action-button': { ActionButton: button },
  '../motion-pressable': { MotionPressable: button },
};
vm.runInNewContext(
  ts.transpileModule(
    readFileSync(
      new URL('../src/components/report/report-content.tsx', import.meta.url),
      'utf8',
    ),
    {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        jsx: ts.JsxEmit.ReactJSX,
      },
    },
  ).outputText,
  {
    exports,
    require: (name) => {
      assert(name in imports, name);
      return imports[name];
    },
  },
);
const { ReportContent } = exports;
const actions = [];
const render = (resource, extra = {}) => {
  callbacks.length = 0;
  return renderToStaticMarkup(
    React.createElement(ReportContent, {
      resource,
      onRecords: () => actions.push('records'),
      onSchedule: () => actions.push('schedule'),
      onLogin: () => actions.push('login'),
      ...extra,
    }),
  );
};
const report = {
  current: true,
  planned: 4,
  eligible: 2,
  completed: 1,
  diaryDays: 1,
  completionRate: 50,
  daily: [{ date: '2026-11-09', label: '월', completed: 1 }],
  activities: [{ name: '그림책 읽기', count: 1 }],
  memories: [
    {
      id: 3,
      date: '2026-11-09',
      excerpt: '<script>아이와 그림책을 골랐어요</script>',
      activities: ['그림책 읽기'],
    },
  ],
  insight: { state: 'error' },
};
let html = render({ state: 'unavailable' });
assert(html.includes('리포트를 준비하고 있어요'));
assert(!html.includes('완료 기록'));
assert(
  !html.includes('아직 돌아볼 기록이 없어요'),
  'Unavailable does not establish an empty dataset',
);
html = render({ state: 'ready', report });
assert(
  html.includes('활동 돌아보기') &&
    html.includes('50%') &&
    html.includes('기억'),
);
assert(
  html.includes('&lt;script&gt;'),
  'Original text must render safely without rewriting',
);
assert(
  html.includes('AI 이야기를 만들지 못했어요') && html.includes('그림책 읽기'),
  'AI failure must keep real records',
);
let opened;
render(
  { state: 'ready', report },
  {
    onMemory: (date) => {
      opened = date;
    },
  },
);
callbacks.find((x) => x.accessibilityRole === 'button').onPress();
assert.equal(opened, '2026-11-09');
html = render({
  state: 'ready',
  report: {
    ...report,
    completed: 0,
    diaryDays: 0,
    completionRate: null,
    memories: [],
    activities: [],
  },
});
assert(
  html.includes('아직 돌아볼 기록이 없어요') &&
    html.includes('아직 비율을 계산할 활동이 없어요'),
);
assert(!html.includes('0%') && !html.includes('AI 이야기 만들기'));
let selected;
const suggestion = {
  title: '그림책으로 이야기하기',
  description: '그림 속 사물을 찾아보세요.',
  reason: '기록한 그림책 활동을 이어가요.',
};
render(
  {
    state: 'ready',
    report: {
      ...report,
      insight: {
        state: 'ready',
        summary: '기록한 한 주예요.',
        observations: ['그림책을 골랐어요.'],
        suggestions: [suggestion],
      },
    },
  },
  {
    onSuggestion: (value) => {
      selected = value;
    },
  },
);
callbacks.find((x) => x.label === '이 활동으로 일정 준비하기').onPress();
assert.deepEqual(selected, suggestion);
render(
  { state: 'ready', report },
  { generating: true, onGenerate: () => actions.push('generate') },
);
assert(callbacks.find((x) => x.label === 'AI 이야기 만드는 중…').disabled);
assert(
  !actions.includes('generate'),
  'Rendering must never start generation or save schedules',
);
console.log(
  'PASS presentation boundary: unavailable vs empty, actual excerpts, independent AI error, null ratio, source navigation, explicit suggestion and generation handlers',
);
