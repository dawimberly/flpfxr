import { PROJECTS } from "@/data/projects";

type Service = "kitchen" | "bathroom";
type FAQ = { question: string; answer: string };

const faqs: Record<Service, FAQ[]> = {
  kitchen: [
    { question: "What kitchen work do you handle?", answer: "We focus on full-room kitchen remodels, including cabinets, countertops, flooring, and finishes. Tell us what you want to change so we can discuss the scope." },
    { question: "How do I get an estimate?", answer: "Call, text, or use the form above. We will discuss your kitchen and arrange a walkthrough to understand the work before preparing an estimate." },
    { question: "Can you help with the design?", answer: "Yes. Design is handled in-house. We can discuss your ideas and the room during the walkthrough." },
    { question: "How long will my kitchen remodel take?", answer: "The timeline depends on the scope, materials, scheduling, and what we find after work begins. We will discuss timing as we plan your project." },
    { question: "Can I stay in my home during the work?", answer: "We work carefully to keep your home livable, but access to the kitchen can be limited during a remodel. We will discuss your situation before work starts." },
    { question: "Do you work outside San Antonio?", answer: "We also serve nearby communities. Tell us where the project is and we can confirm whether it is in our service area." },
  ],
  bathroom: [
    { question: "What bathroom work do you handle?", answer: "We focus on full-room bathroom remodels, including tile, fixtures, flooring, and finishes. Tell us what you want to change so we can discuss the scope." },
    { question: "How do I get an estimate?", answer: "Call, text, or use the form above. We will discuss your bathroom and arrange a walkthrough to understand the work before preparing an estimate." },
    { question: "Can you help with the design?", answer: "Yes. Design is handled in-house. We can discuss your ideas and the room during the walkthrough." },
    { question: "How long will my bathroom remodel take?", answer: "The timeline depends on the scope, materials, scheduling, and what we find after work begins. We will discuss timing as we plan your project." },
    { question: "Can I use the bathroom during the remodel?", answer: "Bathroom access may be limited during the work. We will discuss the expected disruption and your household's needs before work starts." },
    { question: "Do you work outside San Antonio?", answer: "We also serve nearby communities. Tell us where the project is and we can confirm whether it is in our service area." },
  ],
};

const scopes: Record<Service, string[]> = {
  kitchen: ["Removal and preparation for the remodel", "Cabinets and countertops", "Flooring and tile", "Plumbing and fixtures", "Painting and finish work"],
  bathroom: ["Removal and preparation for the remodel", "Tile and flooring", "Vanities and countertops", "Plumbing and fixtures", "Painting and finish work"],
};

const steps = [
  ["Walkthrough", "We visit the room, listen to your plans, and look at the work involved."],
  ["Written estimate", "We prepare an estimate describing the proposed scope."],
  ["Scheduling", "Once the scope is agreed, we discuss timing and schedule the work."],
  ["Build", "We carry out the remodel and work carefully in your home."],
  ["Final walkthrough", "We walk through the finished work with you."],
];

function isReady(value: string) {
  return Boolean(value.trim()) && !/\[[^\]]*\]/.test(value);
}

export function RemodelDetails({ service }: { service: Service }) {
  const questions = faqs[service];
  const projects = PROJECTS.filter((project) =>
    project.service === service && project.published &&
    [project.photo, project.neighborhood, project.wanted, project.work, project.timeline].every(isReady),
  );
  const schema = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: questions.map(({ question, answer }) => ({
      "@type": "Question", name: question, acceptedAnswer: { "@type": "Answer", text: answer },
    })),
  };
  return (
    <div className="mx-auto max-w-6xl space-y-12 px-4 pb-16">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(schema).replace(/</g, "\\u003c") }} />
      <section>
        <h2 className="font-display text-3xl text-fg">What we handle</h2>
        <p className="mt-3 max-w-3xl text-muted">For full-room {service} remodels in San Antonio, the scope can include:</p>
        <ul className="mt-4 list-disc space-y-2 pl-5 text-muted">{scopes[service].map((item) => <li key={item}>{item}</li>)}</ul>
      </section>
      <section>
        <h2 className="font-display text-3xl text-fg">How it works</h2>
        <ol className="mt-4 grid gap-4 sm:grid-cols-2">{steps.map(([title, body], index) => <li key={title} className="rounded-xl bg-surface p-4"><h3 className="font-semibold text-fg">{index + 1}. {title}</h3><p className="mt-1 text-muted">{body}</p></li>)}</ol>
      </section>
      <section>
        <h2 className="font-display text-3xl text-fg">What affects the cost</h2>
        <p className="mt-3 max-w-3xl text-muted">Every room is different. Size, changes to the layout or plumbing, material selections, hidden damage, and any required permits can affect the scope and cost. We look at the room and discuss the details before preparing an estimate.</p>
      </section>
      <section>
        <h2 className="font-display text-3xl text-fg">Frequently asked questions</h2>
        <dl className="mt-5 space-y-5">{questions.map(({ question, answer }) => <div key={question}><dt className="font-semibold text-fg">{question}</dt><dd className="mt-1 max-w-3xl text-muted">{answer}</dd></div>)}</dl>
      </section>
      {projects.length ? <section><h2 className="font-display text-3xl text-fg">Recent projects</h2><div className="mt-5 grid gap-5 sm:grid-cols-2">{projects.map((project) => <article key={project.photo} className="overflow-hidden rounded-xl bg-surface"><img src={project.photo} alt={service + " remodel in " + project.neighborhood} loading="lazy" className="aspect-[4/3] w-full object-cover" /><div className="space-y-2 p-4"><h3 className="font-semibold text-fg">{project.neighborhood}</h3><p className="text-muted">{project.wanted}</p><p className="text-muted">{project.work}</p><p className="text-muted">{project.timeline}</p></div></article>)}</div></section> : null}
    </div>
  );
}
