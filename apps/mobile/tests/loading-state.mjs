import assert from 'node:assert/strict';
import { isInitialLoading } from '../src/lib/loading-state.ts';
for (const data of [null, [], {}, 0, '']) {
  assert.equal(
    isInitialLoading({ data, isPending: true, isFetching: true }),
    false,
  );
}
assert.equal(
  isInitialLoading({ data: undefined, isPending: true, isFetching: true }),
  true,
);
assert.equal(
  isInitialLoading({ data: undefined, isPending: true, isFetching: false }),
  false,
  'disabled/paused is not active loading',
);
assert.equal(
  isInitialLoading({ data: undefined, isPending: false, isFetching: true }),
  false,
  'error refetch is not initial pending',
);
assert.equal(
  isInitialLoading({ data: [], isPending: false, isFetching: true }),
  false,
  'background refetch retains cache',
);
console.log(
  'PASS initial/disabled/paused/error/cached/null/empty loading states',
);
