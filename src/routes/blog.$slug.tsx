import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { Photo } from "@/components/photo";
import { CtaBand, PageIntro } from "@/components/site-shell";
import { BLOG_POSTS } from "@/lib/blog";
import { SITE } from "@/lib/site";

export const Route = createFileRoute("/blog/$slug")({
  loader: ({ params }) => {
    const post = BLOG_POSTS.find((item) => item.slug === params.slug);
    if (!post) throw notFound();
    return post;
  },
  head: ({ loaderData: post }) =>
    post
      ? {
          meta: [
            { title: `${post.title} | ${SITE.name}` },
            { name: "description", content: post.description },
            { property: "og:title", content: post.title },
            { property: "og:description", content: post.description },
            { property: "og:type", content: "article" },
            { property: "og:image", content: `${SITE.url}${post.image}` },
          ],
          links: [{ rel: "canonical", href: `${SITE.url}/blog/${post.slug}` }],
        }
      : {},
  component: BlogArticle,
  notFoundComponent: () => (
    <PageIntro title="Guide not found">
      <Link to="/blog" className="text-primary">
        Browse remodeling resources
      </Link>
    </PageIntro>
  ),
});

function BlogArticle() {
  const post = Route.useLoaderData();
  const related = BLOG_POSTS.filter((item) => item.slug !== post.slug);
  return (
    <div>
      <article>
        <div className="mx-auto max-w-3xl px-4 pt-8">
          <Link to="/blog" className="text-sm font-medium text-primary">
            ← All remodeling resources
          </Link>
        </div>
        <PageIntro eyebrow={post.category} title={post.title}>
          <p>{post.description}</p>
        </PageIntro>
        <div className="mx-auto max-w-3xl px-4 pb-16">
          <Photo
            src={post.image}
            alt=""
            className="photo-frame mb-10 aspect-[16/9] w-full object-cover"
          />
          <p className="mb-8 text-sm text-muted">By The Flip Fixer · San Antonio, Texas</p>
          <div className="space-y-9">
            {post.sections.map((section) => (
              <section key={section.title}>
                <h2 className="font-display text-2xl font-semibold text-fg">{section.title}</h2>
                <p className="mt-3 text-lg leading-relaxed text-muted">{section.body}</p>
              </section>
            ))}
          </div>
          <div className="mt-10 rounded-2xl bg-surface p-6">
            <h2 className="font-display text-2xl text-fg">Have a project in mind?</h2>
            <p className="mt-3 text-muted">
              Tell us about your space, your priorities, and where the work is located.
            </p>
            <Link
              to="/contact"
              className="mt-4 inline-flex rounded-lg bg-primary px-5 py-3 font-semibold text-primary-fg hover:bg-primary-hover"
            >
              Request an appointment
            </Link>
          </div>
        </div>
      </article>
      <aside aria-label="Related guides" className="mx-auto max-w-3xl px-4 pb-16">
        <h2 className="font-display text-2xl text-fg">Keep planning</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          {related.map((item) => (
            <Link
              key={item.slug}
              to="/blog/$slug"
              params={{ slug: item.slug }}
              className="rounded-xl border border-border p-5 font-medium text-primary hover:bg-surface"
            >
              {item.title} →
            </Link>
          ))}
        </div>
      </aside>
      <CtaBand />
    </div>
  );
}
