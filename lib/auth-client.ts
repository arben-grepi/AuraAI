import { createAuthClient } from "better-auth/react";
import { organizationClient, adminClient } from "better-auth/client/plugins";
export const {
  signIn,
  signUp,
  signOut,
  changeEmail,
  verifyEmail,
  sendVerificationEmail,
  requestPasswordReset,
  resetPassword,
} = createAuthClient({
  baseURL: process.env.BETTER_AUTH_URL,
  plugins: [organizationClient(), adminClient()],
});
