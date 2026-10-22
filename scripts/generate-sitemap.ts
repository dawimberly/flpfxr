import { writeFileSync } from "node:fs";
import { BLOG_POSTS } from "../src/lib/blog.ts";
import { SEO_ORIGIN, PUBLIC_PAGE_PATHS } from "../src/lib/seo-config.ts";

const paths = [...PUBLIC_PAGE_PATHS, ...BLOG_POSTS.map(post => `/blog/${post.slug}`)];
if (new Set(paths).size !== paths.length) throw new Error("Duplicate sitemap URL");
const escapeXml = (value: string) => value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");
const xml = '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'
  + paths.map(path => `  <url><loc>${escapeXml(new URL(path, SEO_ORIGIN).href)}</loc></url>`).join("\n")
  + '\n</urlset>\n';
writeFileSync(new URL("../public/sitemap.xml", import.meta.url), xml);
console.log(`Generated sitemap with ${paths.length} public URLs`);
