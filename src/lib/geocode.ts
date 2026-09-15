import { createServerFn } from "@tanstack/react-start";
import { authMiddleware } from "@/lib/auth/middleware";

export type GeocodeHit = {
  lat: number;
  lng: number;
  label: string;
};

export const geocodeAddress = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((data: { query: string }) => data)
  .handler(async ({ data }): Promise<{ hit: GeocodeHit | null; error: string | null }> => {
    const query = data.query.trim();
    if (query.length < 5) return { hit: null, error: "Enter a fuller street address." };
    const url = new URL("https://nominatim.openstreetmap.org/search");
    url.searchParams.set("q", query);
    url.searchParams.set("format", "json");
    url.searchParams.set("limit", "1");
    url.searchParams.set("countrycodes", "us");
    url.searchParams.set("addressdetails", "0");
    const res = await fetch(url, {
      headers: {
        Accept: "application/json",
        "User-Agent": "TheFlipFixerRoofTracer/1.0 (jon@theflipfixer.com)",
      },
    });
    if (!res.ok) return { hit: null, error: "Address lookup failed. Try again." };
    const rows = (await res.json()) as Array<{ lat: string; lon: string; display_name: string }>;
    const row = rows[0];
    if (!row) return { hit: null, error: "No match. Check the street and city." };
    return {
      hit: {
        lat: Number(row.lat),
        lng: Number(row.lon),
        label: row.display_name,
      },
      error: null,
    };
  });
