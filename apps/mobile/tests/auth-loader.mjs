import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import vm from 'node:vm';

const require = createRequire(import.meta.url);
const ts = require('typescript');

// Load the auth module graph with an isolated environment and fetch per test.
export function loadAuthModule(
  globals,
  entry = '../src/lib/features/auth/index.ts',
) {
  const context = vm.createContext({
    Headers,
    AbortController,
    setTimeout,
    clearTimeout,
    Error,
    JSON,
    Number,
    ...globals,
  });
  const cache = new Map();
  function load(url) {
    if (cache.has(url.href)) return cache.get(url.href).exports;
    const { outputText } = ts.transpileModule(readFileSync(url, 'utf8'), {
      compilerOptions: {
        target: ts.ScriptTarget.ES2022,
        module: ts.ModuleKind.CommonJS,
      },
    });
    const module = { exports: {} };
    cache.set(url.href, module);
    const execute = vm.runInContext(
      `(function (module, exports, require) { ${outputText}\n})`,
      context,
      { filename: url.pathname },
    );
    execute(module, module.exports, (specifier) =>
      specifier.startsWith('.')
        ? load(new URL(`${specifier}.ts`, url))
        : require(specifier),
    );
    return module.exports;
  }
  return Array.isArray(entry)
    ? entry.map((path) => load(new URL(path, import.meta.url)))
    : load(new URL(entry, import.meta.url));
}
