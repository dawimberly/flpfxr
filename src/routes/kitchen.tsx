import { createFileRoute, redirect } from "@tanstack/react-router";
import { AREA_LINE, SITE } from "@/lib/site";

export const Route = createFileRoute("/kitchen")({
  beforeLoad: () => {
    throw redirect({
      to: "/contact",
      search: { service: "kitchen", side: "interior" },
    });
  },
  head: () => ({
    meta: [
      { title: `Kitchen remodel | ${SITE.legalName}` },
      {
        name: "description",
        content: `Kitchen remodels in San Antonio. Call ${SITE.phoneDisplay}. Design in-house. ${AREA_LINE}`,
      },
    ],
  }),
  component: () => null,
});
