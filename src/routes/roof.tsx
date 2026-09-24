import { createFileRoute, redirect } from "@tanstack/react-router";
import { AREA_LINE, SITE } from "@/lib/site";

export const Route = createFileRoute("/roof")({
  beforeLoad: () => {
    throw redirect({
      to: "/contact",
      search: { service: "roofing", side: "exterior" },
    });
  },
  head: () => ({
    meta: [
      { title: `Roof | ${SITE.legalName}` },
      {
        name: "description",
        content: `Roof repair and replacement in San Antonio. Call ${SITE.phoneDisplay}. We walk the job. ${AREA_LINE}`,
      },
    ],
  }),
  component: () => null,
});
