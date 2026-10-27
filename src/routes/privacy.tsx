import { createFileRoute } from "@tanstack/react-router";
import { PageIntro } from "@/components/site-shell";
import { SITE } from "@/lib/site";

export const Route = createFileRoute("/privacy")({
  component: PrivacyPage,
  head: () => ({
    links: [{ rel: "canonical", href: `${SITE.url}/privacy` }],
    meta: [
      { title: `Privacy | ${SITE.legalName}` },
      {
        name: "description",
        content: `How ${SITE.legalName} uses website inquiries, first-party lead source notes, analytics, and advertising measurement.`,
      },
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
          <p>Job inquiry forms send that information through our email provider, Resend, to the notification address configured for this site (by default {SITE.email}). The same inquiry is stored in our website database hosted by Neon. The separate Community partnership form sends only what you type through FormSubmit and does not include the lead-source note below. The website is hosted by Vercel. These providers process information to operate the site and deliver your request.</p>
          <p>The form can save a draft in this browser&apos;s session storage so a failed submission can be retried.</p>
          <p>On the first page view in a browser tab, the site saves a first-party lead-source note in that same session storage: advertising click identifiers (gclid, gbraid, and wbraid), UTM parameters (source, medium, campaign, term, and content), the referring domain, and the landing-page path. Later pages in the tab do not replace that note. It is not a cookie, and it is not sent to Google Analytics, Google Ads, Microsoft Clarity, or any other analytics provider. If session storage is blocked, the note stays in memory for that page only. The inquiry form still works if the note cannot be saved.</p>
          <p>When you submit a job inquiry, the note is sent only with that inquiry, together with the submitting page path, a coarse device type (mobile, tablet, or desktop), and your optional answer to &quot;How did you hear about us?&quot; The choices are Google search, Google Ads, Google Maps / Business Profile, referral from a friend or family member, past customer, social media, or other. The server checks the length and characters of those fields and adds a source label before the inquiry is emailed. That label is a best-effort classification, not proof of how the visit started.</p>
        </div>
        <div className="space-y-3">
          <h2 className="font-display text-2xl text-fg">Analytics and advertising measurement</h2>
          <p>We use Google Analytics and Microsoft Clarity to understand how visitors use the site and improve it; see <a className="text-primary underline" href="https://www.microsoft.com/en-us/privacy/privacystatement">Microsoft’s privacy statement</a>.</p>
          <p>We use Google Analytics and Google Ads to understand website visits and measure advertising results. Google tags and cookies can collect information about your browser, device, pages visited, and interactions, including call and text link clicks.</p>
          <p>We share information with Google to perform advertising measurement on our behalf. After an accepted form submission, Google Ads enhanced conversions can use your provided email address, phone number, and name in hashed form to help match the inquiry to an ad interaction. Google call tracking can replace the displayed phone number with a forwarding number to measure calls and their duration.</p>
          <p>The lead-source note above is not part of these analytics tools, and this site does not send that note to them. The analytics tools still receive other information. Google tags receive page addresses and referrer addresses with the query string and fragment removed. After an accepted job inquiry, Google Ads can receive a hashed email address, phone number, and name to measure conversions. When a Microsoft Clarity project id is configured, Clarity loads on public pages (not the estimator or login) and can receive the page address the browser is visiting. Inquiry forms are masked in Clarity. There is no cookie-consent banner. Google tags load only on theflipfixer.com and www.theflipfixer.com.</p>
          <p><a className="text-primary underline" href="https://business.safety.google/privacy/">How Google uses information from sites that use its services</a>.</p>
        </div>
        <div className="space-y-3">
          <h2 className="font-display text-2xl text-fg">Your choices</h2>
          <p>You can contact us directly by phone or email instead of using a form. Your browser settings let you block or delete cookies and clear saved website data, including the session-storage lead-source note. Blocking that storage does not stop the inquiry form. Blocking cookies or scripts may affect website features and measurement.</p>
          <p>You can manage Google advertising preferences at <a className="text-primary underline" href="https://myadcenter.google.com/">My Ad Center</a> and learn about the <a className="text-primary underline" href="https://tools.google.com/dlpage/gaoptout">Google Analytics opt-out browser add-on</a>.</p>
          <p>For questions about information you submitted, or to request its correction or deletion, email <a className="text-primary underline" href={`mailto:${SITE.email}`}>{SITE.email}</a>.</p>
        </div>
      </section>
    </div>
  );
}
