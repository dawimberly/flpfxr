/** Route-owned social text stays in sync with document metadata on client navigation. */
type PageMeta = { title?: string; name?: string; property?: string; content?: string };
const socialTextKeys = new Set(['og:title', 'og:description', 'twitter:title', 'twitter:description']);
export function publicPageMeta(meta: PageMeta[]): PageMeta[] {
  const title = meta.find(item => item.title !== undefined)?.title;
  const description = meta.find(item => item.name === 'description')?.content;
  return [
    ...meta.filter(item => !socialTextKeys.has(item.property ?? item.name ?? '')),
    ...(title ? [{ property: 'og:title', content: title }, { name: 'twitter:title', content: title }] : []),
    ...(description ? [{ property: 'og:description', content: description }, { name: 'twitter:description', content: description }] : []),
  ];
}
