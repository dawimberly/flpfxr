import { useMemo, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { ArrowRight } from "lucide-react";
import { AddressSuggestField } from "@/components/address-suggest-field";
import { RoofMap } from "@/components/roof-map";
import { Button } from "@/components/ui/button";
import { fetchBuildingOutline } from "@/lib/geocode";
import { geocodeHouseAddress, looksLikeStreetAddress } from "@/lib/roof-geocode";
import type { LatLng, RoofFacet } from "@/lib/roof-math";
import {
  PUBLIC_PITCH,
  PUBLIC_PITCH_IDS,
  PUBLIC_SHINGLE,
  PUBLIC_SHINGLE_IDS,
  publicRoofLeadMessage,
  publicRoofQuote,
  type PublicPitchId,
  type PublicShingleId,
} from "@/lib/roof-public-quote";
import { saveLeadDraft } from "@/lib/site";
import { cn, formatUsdRange } from "@/lib/utils";

const SA_CENTER = { lat: 29.4241, lng: -98.4936 };
const ADDRESS_PLACEHOLDER = "3407 Stonehaven Dr, San Antonio, TX 78230";

function noopSelect(_id: string | null) {}
function noopClick(_latlng: LatLng) {}
function noopMove(_id: string, _index: number, _latlng: LatLng) {}

export function RoofPublicQuote() {
  const navigate = useNavigate();
  const [address, setAddress] = useState("");
  const [center, setCenter] = useState(SA_CENTER);
  const [zoom, setZoom] = useState(12);
  const [ring, setRing] = useState<LatLng[] | null>(null);
  const [planSqft, setPlanSqft] = useState<number | null>(null);
  const [pitchId, setPitchId] = useState<PublicPitchId>("medium");
  const [shingleId, setShingleId] = useState<PublicShingleId>("architectural");
  const [looking, setLooking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const pitch = PUBLIC_PITCH[pitchId];
  const facets: RoofFacet[] = useMemo(() => {
    if (!ring?.length) return [];
    return [{ id: "roof", latlngs: ring, pitch: pitch.pitch, slopeDeg: null }];
  }, [pitch.pitch, ring]);

  const quote = planSqft != null ? publicRoofQuote(planSqft, pitchId, shingleId) : null;
  const rangeLabel = quote ? formatUsdRange(quote.low, quote.high) : "";

  async function measureAddress(query: string) {
    if (!looksLikeStreetAddress(query)) {
      setError(
        "Enter a house number and street, like 3407 Stonehaven Dr, San Antonio, TX 78230.",
      );
      return;
    }
    setLooking(true);
    setError(null);
    try {
      const result = await geocodeHouseAddress(query);
      if (result.error || !result.hit) {
        setRing(null);
        setPlanSqft(null);
        setError(result.error ?? "No rooftop match. Check the street and city.");
        return;
      }
      setCenter({ lat: result.hit.lat, lng: result.hit.lng });
      setZoom(19);
      const outline = await fetchBuildingOutline({
        data: { lat: result.hit.lat, lng: result.hit.lng },
      });
      if (!outline.ring?.length || outline.planSqft == null) {
        setRing(null);
        setPlanSqft(null);
        setError(outline.error ?? "No building outline at this rooftop.");
        return;
      }
      setRing(outline.ring);
      setPlanSqft(outline.planSqft);
    } catch {
      setRing(null);
      setPlanSqft(null);
      setError("Address lookup failed. Try Measure this roof again.");
    } finally {
      setLooking(false);
    }
  }

  function onSearch(event: React.FormEvent) {
    event.preventDefault();
    void measureAddress(address);
  }

  function pickAddress(label: string) {
    setAddress(label);
    void measureAddress(label);
  }

  function goToContact() {
    if (!quote) return;
    saveLeadDraft({
      service: "roofing",
      message: publicRoofLeadMessage({
        address: address.trim(),
        pitchId,
        shingleId,
        quote,
        rangeLabel,
      }),
    });
    void navigate({ to: "/contact", search: { service: "roofing" } });
  }

  return (
    <div
      id="ballpark"
      className="scroll-mt-28 rounded-2xl bg-surface p-5 shadow-[var(--shadow-border)] md:p-8"
    >
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">
        Ballpark
      </p>
      <h2 className="mt-2 font-display text-2xl text-fg md:text-3xl">
        Type the house
      </h2>
      <p className="mt-2 text-sm text-muted">
        We outline that roof. You pick pitch and shingles. Planning range for
        San Antonio. Not a bid.
      </p>

      <form className="relative z-50 mt-6 flex flex-col gap-2 sm:flex-row" onSubmit={onSearch}>
        <AddressSuggestField
          value={address}
          onChange={setAddress}
          onPick={pickAddress}
          disabled={looking}
          placeholder={ADDRESS_PLACEHOLDER}
        />
        <Button type="submit" size="lg" disabled={looking} className="sm:shrink-0">
          {looking ? "Measuring..." : "Measure this roof"}
        </Button>
      </form>
      {error ? <p className="mt-2 text-sm text-destructive">{error}</p> : null}

      <div className="relative z-0 mt-6 overflow-hidden rounded-xl">
        <RoofMap
          center={center}
          zoom={zoom}
          facets={facets}
          draft={[]}
          selectedId={null}
          drawing={false}
          edges={[]}
          onClick={noopClick}
          onSelect={noopSelect}
          onMoveVertex={noopMove}
          readOnly
        />
      </div>

      <p className="mt-6 text-xs font-semibold uppercase tracking-[0.2em] text-muted">
        Pitch
      </p>
      <div className="mt-2 grid grid-cols-3 gap-2">
        {PUBLIC_PITCH_IDS.map((id) => (
          <button
            key={id}
            type="button"
            onClick={() => setPitchId(id)}
            className={cn(
              "h-14 rounded-lg px-2 text-sm font-medium transition-[background-color,color] duration-150",
              pitchId === id
                ? "bg-cream text-cream-fg"
                : "bg-bg text-muted shadow-[var(--shadow-border)] hover:text-fg",
            )}
          >
            <span className="block">{PUBLIC_PITCH[id].label}</span>
            <span className="block text-[11px] font-normal opacity-80">
              {PUBLIC_PITCH[id].hint}
            </span>
          </button>
        ))}
      </div>

      <p className="mt-6 text-xs font-semibold uppercase tracking-[0.2em] text-muted">
        Shingles
      </p>
      <div className="mt-2 grid grid-cols-3 gap-2">
        {PUBLIC_SHINGLE_IDS.map((id) => (
          <button
            key={id}
            type="button"
            onClick={() => setShingleId(id)}
            className={cn(
              "h-14 rounded-lg px-2 text-sm font-medium transition-[background-color,color] duration-150",
              shingleId === id
                ? "bg-cream text-cream-fg"
                : "bg-bg text-muted shadow-[var(--shadow-border)] hover:text-fg",
            )}
          >
            <span className="block">{PUBLIC_SHINGLE[id].label}</span>
            <span className="block text-[11px] font-normal opacity-80">
              {PUBLIC_SHINGLE[id].hint}
            </span>
          </button>
        ))}
      </div>

      {quote ? (
        <div className="mt-6 rounded-xl bg-bg p-5">
          <p className="text-sm text-muted">
            About {quote.squaresWithWaste.toFixed(0)} squares, {pitch.label.toLowerCase()} pitch,{" "}
            {PUBLIC_SHINGLE[shingleId].label.toLowerCase()}
          </p>
          <p className="mt-2 font-display text-3xl text-fg tabular-nums md:text-4xl">
            {rangeLabel}
          </p>
          <p className="mt-1 text-xs text-subtle">
            About 2 squares either way on this outline. Cut-up roofs can land
            about 10-15% off. We'll walk it free.
          </p>
          <Button type="button" size="lg" className="mt-6 w-full" onClick={goToContact}>
            Send this range
            <ArrowRight className="size-4" />
          </Button>
        </div>
      ) : (
        <p className="mt-6 text-sm text-muted">
          Measure a house to see the range.
        </p>
      )}
    </div>
  );
}
