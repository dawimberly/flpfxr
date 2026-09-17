export type XactimateRoofExtras = {
  address: string;
  insured: string;
  squares: number | null;
  solarPanels: number;
  solarHardware: number;
  turtleVents: number;
  turbineVents: number;
  pipeJacks: number;
};

function grab(rx: RegExp, text: string): string {
  const m = text.match(rx);
  return m?.[1]?.replace(/,/g, "").trim() ?? "";
}

function qty(rx: RegExp, text: string): number {
  const n = Number(grab(rx, text));
  return Number.isFinite(n) ? n : 0;
}

export function isXactimateText(text: string): boolean {
  return /Xactimate|Price List:|Restoration\/Service\/Remodel|Number of Squares/i.test(text);
}

export function parseXactimateRoof(text: string): XactimateRoofExtras | null {
  if (!isXactimateText(text) && !/Solar electric panel/i.test(text)) return null;
  const squares =
    qty(/([\d.]+)\s+Number of Squares/i, text) ||
    qty(/Remove [^\n]{0,40}?comp[^\n]{0,40}?([\d.]+)\s+SQ/i, text) ||
    null;
  return {
    address:
      grab(/Property:\s*([^\n]+)\n([^\n]+)/i, text)
        .split(/\n/)
        .join(", ") || grab(/Property:\s*([^\n]+)/i, text),
    insured: grab(/Insured:\s*([^\n]+?)(?:\s+Home:|\s+E-mail:|\s+Property:|$)/i, text),
    squares: squares && squares > 1 ? squares : null,
    solarPanels: qty(/Solar electric panel[^\n]{0,40}?([\d.]+)\s+EA/i, text),
    solarHardware: qty(/Solar panel[- ]+mounting[^\n]{0,40}?([\d.]+)\s+EA/i, text),
    turtleVents: qty(/Roof vent\s*[-–—]?\s*turtle[^\n]{0,40}?([\d.]+)\s+EA/i, text),
    turbineVents: qty(/Roof vent\s*[-–—]?\s*turbine[^\n]{0,40}?([\d.]+)\s+EA/i, text),
    pipeJacks: qty(/(?:Pipe jack|Pipe flashing|Pipe jack flashing)[^\n]{0,40}?([\d.]+)\s+EA/i, text),
  };
}
