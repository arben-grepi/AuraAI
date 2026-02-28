import { createAuthClient } from "better-auth/react";
import {
  organizationClient,
  inferOrgAdditionalFields,
  adminClient,
} from "better-auth/client/plugins";
import type { auth } from "./auth";
import { ac, admin as adminRole, superadmin } from "./permissions";

export const {
  signIn,
  signUp,
  signOut,
  changeEmail,
  verifyEmail,
  sendVerificationEmail,
  requestPasswordReset,
  resetPassword,
  organization,
  admin,
} = createAuthClient({
  baseURL:
    process.env.NODE_ENV === "production"
      ? process.env.BETTER_AUTH_URL
      : "http://localhost:3000",
  plugins: [
    organizationClient({
      schema: inferOrgAdditionalFields<typeof auth>(),
    }),
    adminClient({
      ac,
      roles: {
        admin: adminRole,
        superadmin,
      },
    }),
  ],
});
