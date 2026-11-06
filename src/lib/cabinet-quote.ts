import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const selections = z.array(z.object({
  roomId: z.string().min(1).max(100),
  finish: z.string().min(1).max(30),
  picks: z.array(z.object({
    sku: z.string().min(1).max(100),
    quantity: z.number().int().min(1).max(10000),
  })).max(1000),
})).max(100);

async function authorizeCabinetAccess() {
  const { getRequest, setResponseHeader } = await import("@tanstack/react-start/server");
  const { requireEmployee } = await import("./employee-session.server");
  setResponseHeader("Cache-Control", "private, no-store");
  await requireEmployee(getRequest());
}

export const loadCabinetCatalog = createServerFn({ method: "GET" }).handler(async () => {
  await authorizeCabinetAccess();
  const { cabinetCatalog } = await import("./cabinet-pricing.server");
  return cabinetCatalog();
});

export const loadCabinetQuotes = createServerFn({ method: "POST" })
  .validator((value: unknown) => selections.parse(value))
  .handler(async ({ data }) => {
    await authorizeCabinetAccess();
    const { quoteCabinets } = await import("./cabinet-pricing.server");
    return Object.fromEntries(data.map(({ roomId, finish, picks }) => [roomId, quoteCabinets(finish, picks)]));
  });
