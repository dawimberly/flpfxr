import assert from 'node:assert/strict';
import test from 'node:test';
import { publicPageMeta } from './public-page-meta.ts';

test('one page-specific value per social text key; preserves indexing and article metadata', () => {
  const extras = [{ name: 'robots', content: 'noindex' }, { property: 'og:type', content: 'article' }, { property: 'og:image', content: 'https://theflipfixer.com/article.webp' }];
  const meta = publicPageMeta([{ title: 'Kitchen | The Flip Fixer' }, { name: 'description', content: 'Kitchen details.' }, { property: 'og:title', content: 'Stale' }, ...extras]);
  for (const key of ['og:title', 'og:description', 'twitter:title', 'twitter:description']) {
    const matches = meta.filter(item => (item.property ?? item.name) === key);
    assert.equal(matches.length, 1);
    assert.equal(matches[0].content, key.endsWith('title') ? 'Kitchen | The Flip Fixer' : 'Kitchen details.');
  }
  for (const extra of extras) assert.ok(meta.includes(extra));
  assert.deepEqual(publicPageMeta(meta), meta);
});
