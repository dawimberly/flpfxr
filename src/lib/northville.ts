/** Names only: verified on the manufacturer's site on November 4, 2026.
 * These are product options to discuss, not a claim of completed installations.
 * Jon must confirm which lines the crew currently accepts before publication.
 */
export const NORTHVILLE_SOURCE = "https://www.northvillecabinetry.com/door-styles-and-finishes";
export const NORTHVILLE_STYLES = [
  "Elegant White", "Grey Shaker", "Blue Shaker", "Metallic Shaker",
  "Antique White", "Midnight Espresso", "Cognac",
] as const;
export const NORTHVILLE_PROCESS = [
  { title: "Consultation", body: "Tell Jon about your kitchen, how you use it, and what you want to change." },
  { title: "Measuring and design", body: "Confirm the room measurements, cabinet layout, and selections before ordering." },
  { title: "Preparation", body: "Review the scope, protect the work area, and prepare the space for the cabinets." },
  { title: "Installation", body: "Set and secure the cabinets, fit trim and hardware, and check door and drawer alignment." },
  { title: "Final walkthrough", body: "Review the installation with Jon and identify any finishing adjustments." },
] as const;
