/** Crew sign-in is supported; account provisioning is server/admin only. */
export const emailAndPasswordEnabled = true;
export const emailAndPasswordOptions = { enabled: emailAndPasswordEnabled, disableSignUp: true } as const;
