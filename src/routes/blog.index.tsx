import { createFileRoute, Link } from "@tanstack/react-router";
import { Photo } from "@/components/photo";
import { CtaBand, PageIntro } from "@/components/site-shell";
import { BLOG_POSTS } from "@/lib/blog";
import { SITE } from "@/lib/site";

export const Route = createFileRoute("/blog/")({
  component: BlogPage,
  head: () => ({
    meta: [
      { title: `Remodeling Resources | ${SITE.name}` },
      {
        name: "description",
        content:
          "Plan your San Antonio remodel with practical guides to appointments, estimates, quotes, and the building process from The Flip Fixer.",
      },
    ],
    links: [{ rel: "canonical", href: `${SITE.url}/blog` }],
  }),
});

function BlogPage() {
  return (
    <div>
      <PageIntro eyebrow="The Flip Fixer journal" title="Know what comes next.">
        <p>
          Practical remodeling resources for San Antonio homeowners. From the first conversation to
          the final walkthrough.
        </p>
      </PageIntro>
      <section
        aria-label="Remodeling guides"
        className="mx-auto grid max-w-6xl gap-6 px-4 pb-16 md:grid-cols-3"
      >
        {BLOG_POSTS.map((post) => (
          <article
            key={post.slug}
            className="overflow-hidden rounded-2xl bg-surface shadow-[var(--shadow-border)]"
          >
            <Photo src={post.image} alt="" className="aspect-[4/3] w-full object-cover" />
            <div className="p-6">
              <p className="text-xs font-semibold uppercase tracking-wider text-primary">
                {post.category}
              </p>
              <h2 className="mt-3 font-display text-2xl font-semibold text-fg">
                <Link to="/blog/$slug" params={{ slug: post.slug }} className="hover:text-primary">
                  {post.title}
                </Link>
              </h2>
              <p className="mt-3 text-sm leading-relaxed text-muted">{post.description}</p>
              <Link
                to="/blog/$slug"
                params={{ slug: post.slug }}
                className="mt-6 inline-flex py-2 text-sm font-semibold text-primary"
                aria-label={`Read ${post.title}`}
              >
                Read the guide →
              </Link>
            </div>
          </article>
        ))}
      </section>
      <CtaBand
        title="Let's talk about your project."
        body="Tell us what you want to change. We will help you figure out the next step."
      />
    </div>
  );
}
