import { describe, expect, it } from 'vitest';
import { entryScript } from './version';

describe('entryScript', () => {
  it('finds the hashed entry script in a built index.html', () => {
    const html = '<head><script type="module" crossorigin src="/assets/index-C6OOA-Wt.js"></script><link rel="modulepreload" href="/assets/react-maa9bP4J.js"></head>';
    expect(entryScript(html)).toBe('/assets/index-C6OOA-Wt.js');
  });
  it('handles attribute order and absolute URLs', () => {
    expect(entryScript('<script src="https://m.test/assets/index-AbC_1.js" type="module"></script>')).toBe('/assets/index-AbC_1.js');
  });
  it('returns null for the dev server page', () => {
    expect(entryScript('<script type="module" src="/src/main.tsx"></script>')).toBeNull();
  });
});
