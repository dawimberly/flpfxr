export type BlogPost = {
  slug: string;
  title: string;
  category: string;
  description: string;
  image: string;
  sections: Array<{ title: string; body: string }>;
  photos?: Array<{ src: string; alt: string; caption: string }>;
};

export const BLOG_POSTS: BlogPost[] = [
  {
    slug: "kitchen-remodel-before-during-after",
    title: "A kitchen remodel: before, during, and after",
    category: "From the jobsite",
    description:
      "See one of our real kitchen remodels through tear-out, cabinet installation, and the finished room.",
    image: "/images/gallery-23-d.webp",
    sections: [
      {
        title: "The starting point",
        body: "The original kitchen had painted cabinets, square floor tile, and an L-shaped counter around the sink and range. The before photo records the space before work began.",
      },
      {
        title: "Opening up the room",
        body: "The tear-out photo shows the work between the existing kitchen and the new installation. This stage gives a different view of the room than a finished photo can: the old materials have come out, and the next parts of the job still need to go in.",
      },
      {
        title: "Cabinets going in",
        body: "The installation photo shows the new cabinet layout taking shape. It is a useful point in the sequence to compare cabinet positions with the finished sink run and peninsula.",
      },
      {
        title: "The finished kitchen",
        body: "The finished photos show shaker-style cabinet fronts, light counters, a light tile backsplash, under-cabinet lighting, and a wood-look floor laid in a herringbone pattern. The sink run and peninsula give two views of how those finishes work together.",
      },
      {
        title: "Planning a kitchen of your own",
        body: "Photos help communicate the kind of space you want, but your scope and price need to be based on your room. Bring your priorities and inspiration photos to the walkthrough so we can discuss layout, selections, and the next step.",
      },
    ],
    photos: [
      {
        src: "/images/gallery-23-a.webp",
        alt: "Original kitchen with painted cabinets and square floor tile",
        caption: "Before: the existing kitchen.",
      },
      {
        src: "/images/gallery-23-b.webp",
        alt: "Kitchen during tear-out",
        caption: "During: tear-out.",
      },
      {
        src: "/images/gallery-23-c.webp",
        alt: "New kitchen cabinets being installed",
        caption: "During: cabinets going in.",
      },
      {
        src: "/images/gallery-23-d.webp",
        alt: "Finished sink run with shaker cabinets, light countertops and herringbone-pattern floor",
        caption: "After: the sink run and peninsula.",
      },
      {
        src: "/images/gallery-23-e.webp",
        alt: "Finished kitchen peninsula from a second angle",
        caption: "After: another view of the peninsula.",
      },
    ],
  },
  {
    slug: "first-remodeling-appointment",
    title: "Your first remodeling appointment",
    category: "Before we visit",
    description:
      "A little preparation makes the walkthrough more useful. Here is what to have ready and what to discuss.",
    image: "/images/gallery-09-c.webp",
    sections: [
      {
        title: "Start with what needs to change",
        body: "A room does not have to be picture-perfect before a contractor visits. Show us what is not working: the layout, worn finishes, storage, damage, or the repairs that keep getting pushed back. Tell us how you use the space and what a successful project would look like.",
      },
      {
        title: "Bring your priorities and a realistic budget",
        body: "A few inspiration photos help explain your taste. Separate must-haves from nice-to-haves, and share the budget range you are comfortable discussing. That helps us talk through practical options instead of designing a project that does not fit.",
      },
      {
        title: "Walk the space together",
        body: "We discuss the work, look at visible conditions, and take the measurements needed to develop the scope. Point out known leaks, past repairs, access restrictions, and anything that may affect the job. A first visit cannot reveal everything hidden behind walls or under floors.",
      },
      {
        title: "Talk about living through the work",
        body: "Let us know about pets, children, parking, work-from-home schedules, and rooms you need to keep using. Ask about material selections, access, dust protection, cleanup, and any expected utility interruptions.",
      },
      {
        title: "Leave knowing the next step",
        body: "Before the visit ends, clarify what information is still needed, who is making selections, and when to expect the next update. Ask whether the next document is a preliminary estimate or a proposal for a defined scope. You should understand the work and pricing before agreeing to proceed.",
      },
    ],
  },
  {
    slug: "estimate-vs-quote",
    title: "Estimate vs. quote: what are you comparing?",
    category: "Planning the budget",
    description:
      "Understand the scope, allowances, and assumptions behind a remodeling price before you compare numbers.",
    image: "/images/gallery-01-a.webp",
    sections: [
      {
        title: "An estimate helps you plan",
        body: "An estimate is an expected cost based on the information available. Early numbers may rely on approximate quantities, preliminary selections, or assumptions about existing conditions. Ask what still needs to be confirmed and what could move the price.",
      },
      {
        title: "A quote needs a defined scope",
        body: "A detailed quote or proposal should describe the work being priced, materials or allowances, exclusions, and payment terms. The title alone does not tell you whether a price is fixed. Read the actual document and agreement, including how changes are handled.",
      },
      {
        title: "An allowance is a placeholder",
        body: "If tile, fixtures, or other finishes have not been selected, a proposal may include a dollar allowance. Ask whether it covers materials only or also labor, delivery, tax, and other costs. Choosing a product above the allowance can change the total.",
      },
      {
        title: "Compare the same work",
        body: "Two prices are only useful side by side when they cover comparable work. Check demolition, disposal, surface preparation, repairs, installation, finishing, protection, and cleanup. A shorter list of included work can make a price look lower.",
      },
      {
        title: "Put changes in writing",
        body: "A layout change, an upgraded finish, or a hidden condition can affect both cost and schedule. Ask how a proposed change will be documented and approved. Keep the agreed scope, price adjustments, and schedule effects together with your project records.",
      },
    ],
  },
  {
    slug: "remodeling-process",
    title: "From floor protection to the final walkthrough",
    category: "During the remodel",
    description:
      "What happens between approving the work and enjoying the finished room? Walk through the main stages.",
    image: "/images/gallery-08-a.webp",
    sections: [
      {
        title: "1. Plan and protect",
        body: "Before demolition, clarify the work area, access routes, staging space, and household needs. Floor coverings, masking, and dust barriers are selected for the work. Protection helps limit dust and damage; remodeling can still be noisy and dusty.",
      },
      {
        title: "2. Coordinate materials",
        body: "Material delivery and storage need a plan. Check selections, quantities, and visible shipping damage before installation. Some items need to arrive before work starts; others are delivered in stages. Lead times can affect the sequence.",
      },
      {
        title: "3. Demo and inspect",
        body: "Existing finishes and fixtures come out as the scope requires. Opening the space can reveal conditions that were not visible at the appointment. If something changes the planned work, clarify the proposed response, cost, and schedule before proceeding with that change.",
      },
      {
        title: "4. Build in the right order",
        body: "Framing, plumbing, electrical, wall preparation, and finish installation depend on the project. Required permits and inspections also affect the order. Ask which milestones matter for your job and when selections or homeowner decisions are needed.",
      },
      {
        title: "5. Finish, clean, and walk through",
        body: "The last stage includes the details: trim, touch-ups, hardware, sealants, and cleanup. Walk the completed scope together, record any remaining items, and ask about care instructions and applicable warranty information. Know who to contact if a question comes up afterward.",
      },
    ],
  },
];
