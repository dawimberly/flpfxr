/**
 * Fail-closed editorial switches. Enable certification only after Jon's
 * documentation has been reviewed. Artwork permission is a separate requirement:
 * this release deliberately contains no Northville artwork.
 */
export const PUBLICATION_FLAGS = {
  northvilleCertificationVerified: false,
  financingApproved: false,
} as const;

export const FINANCING_COPY = "Flexible financing options available";
