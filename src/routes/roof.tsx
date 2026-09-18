import { createFileRoute, redirect } from "@tanstack/react-router";
import { AREA_LINE, SITE } from "@/lib/site";

export const Route = createFileRoute("/roof")({
  beforeLoad: () => {
    throw redirect({
      to: "/contact",
      search: { service: "roofing", side: "exterior" },
      hash: "ballpark",
    });
  },
  head: () => ({
    meta: [
      { title: `Roof | ${SITE.legalName}` },
      {
        name: "description",
        content: `Type your address for a San Antonio roof planning range. Low, medium, or steep. 3-tab, architectural, or designer. ${AREA_LINE} Call (210) 436-9117.`,
      },
    ],
  }),
  component: () => null,
});
