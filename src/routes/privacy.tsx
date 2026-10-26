import { createFileRoute } from "@tanstack/react-router";
import { PageIntro } from "@/components/site-shell";
import { SITE } from "@/lib/site";

export const Route = createFileRoute("/privacy")({
  component: PrivacyPage,
  head: () => ({
    links: [{ rel: "canonical", href: `${SITE.url}/privacy` }],
    meta: [
      { title: `Privacy | ${SITE.legalName}` },
      { name: "description", content: "How The Flip Fixer uses website inquiries, analytics, and advertising measurement." },
    ],
  }),
});

function PrivacyPage() {
  return (
    <div>
      <PageIntro eyebrow="Website privacy" title="Your information">
        <p>Questions about your information? Email {SITE.email} or call {SITE.phoneDisplay}.</p>
      </PageIntro>
      <section className="mx-auto max-w-3xl space-y-8 px-4 pb-16 text-muted">
        <div className="space-y-3">
          <h2 className="font-display text-2xl text-fg">When you contact us</h2>
          <p>We use the name, phone number, email address, job details, and optional photo you provide to respond to your inquiry and discuss the work. Please avoid including sensitive personal information in your message or photo.</p>
          <p>Our job inquiry forms send messages through our email delivery provider, Resend, and store them in our website database hosted by Neon. The separate Community partnership form sends information through FormSubmit. Our website is hosted by Vercel. These service providers process information to operate the website and deliver your request.</p>
          <p>The form can save a draft in your browser so you can retry a failed submission. Advertising click identifiers and the page where you arrived may be included with your inquiry to help us understand how you found us.</p>
        </div>
        <div className="space-y-3">
          <h2 className="font-display text-2xl text-fg">Analytics and advertising measurement</h2>
          <p>We use Google Analytics and Microsoft Clarity to understand how visitors use the site and improve it; see <a className="text-primary underline" href="https://www.microsoft.com/en-us/privacy/privacystatement">Microsoft’s privacy statement</a>.</p>
          <p>We use Google Analytics and Google Ads to understand website visits and measure advertising results. Google tags and cookies can collect information about your browser, device, pages visited, and interactions, including call and text link clicks.</p>
          <p>We share information with Google to perform advertising measurement on our behalf. After an accepted form submission, Google Ads enhanced conversions can use your provided email address, phone number, and name in hashed form to help match the inquiry to an ad interaction. Google call tracking can replace the displayed phone number with a forwarding number to measure calls and their duration.</p>
          <p><a className="text-primary underline" href="https://business.safety.google/privacy/">How Google uses information from sites that use its services</a>.</p>
        </div>
        <div className="space-y-3">
          <h2 className="font-display text-2xl text-fg">Your choices</h2>
          <p>You can contact us directly by phone or email instead of using a form. Your browser settings let you block or delete cookies and clear saved website data. Blocking cookies or scripts may affect website features and measurement.</p>
          <p>You can manage Google advertising preferences at <a className="text-primary underline" href="https://myadcenter.google.com/">My Ad Center</a> and learn about the <a className="text-primary underline" href="https://tools.google.com/dlpage/gaoptout">Google Analytics opt-out browser add-on</a>.</p>
          <p>For questions about information you submitted, or to request its correction or deletion, email <a className="text-primary underline" href={`mailto:${SITE.email}`}>{SITE.email}</a>.</p>
        </div>
      </section>
    </div>
  );
}
