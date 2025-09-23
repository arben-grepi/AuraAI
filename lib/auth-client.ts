import { createAuthClient } from "better-auth/react";
export const {
  signIn,
  signUp,
  signOut,
  changeEmail,
  verifyEmail,
  sendVerificationEmail,
} = createAuthClient({
  baseURL: process.env.BETTER_AUTH_URL,
});
