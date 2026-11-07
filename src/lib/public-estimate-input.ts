import { CABINET_FINISHES } from "./public-cabinet-finishes.ts";
import { z } from "zod";
import {
  PROJECT_SERVICES, PROJECT_SIZES, FLOOR_MATERIALS, COUNTER_MATERIALS,
  SHOWER_MATERIALS, VANITY_SIZES, scopeAreaError, type ProjectInputs,
} from "./public-estimate-options.ts";

const oneOf = (values: readonly string[]) => z.string().refine(value => values.includes(value));
const area = z.number().finite().min(0).max(8000).nullable().optional();
const schema = z.object({
  service: oneOf(PROJECT_SERVICES.map(row => row.id)),
  size: oneOf(PROJECT_SIZES),
  floor: oneOf(FLOOR_MATERIALS.map(row => row.id)),
  counter: oneOf(COUNTER_MATERIALS.map(row => row.id)),
  shower: oneOf(SHOWER_MATERIALS.map(row => row.id)),
  prime: z.boolean(),
  newToilet: z.boolean(),
  exteriorCoats: z.union([z.literal(1), z.literal(2)]),
  delivery: z.number().finite().min(0).max(50000),
  specialist: z.number().finite().min(0).max(50000),
  floorSqft: area, showerSqft: area, counterSqft: area, roomSqft: area,
  cabinetBoxes: z.number().int().min(0).max(40).nullable().optional(),
  xlFridgeBoxes: z.number().int().min(0).max(6).nullable().optional(),
  cabinetFinish: oneOf(CABINET_FINISHES.map(row => row.id)).optional(),
  vanity: oneOf(VANITY_SIZES.map(row => row.id)).optional(),
}).strict();

export function validatePublicEstimateInput(data: unknown): ProjectInputs {
  const parsed = schema.safeParse(data);
  const input = parsed.success ? parsed.data as ProjectInputs : null;
  if (!input || scopeAreaError(input.service, input)) {
    throw new Response(JSON.stringify({
      error: "invalid_estimate_input",
      message: "Choose valid project selections and measurements.",
    }), { status: 400, headers: { "content-type": "application/json" } });
  }
  return input;
}
