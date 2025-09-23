import { betterAuth, User } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import prisma from "./prisma";
import { nextCookies } from "better-auth/next-js";
import { openAPI } from "better-auth/plugins";
import {
  sendChangeEmailVerificationEmail,
  sendEmailVerificationEmail,
} from "@/email/email";

export const auth = betterAuth({
  database: prismaAdapter(prisma, {
    provider: "postgresql",
  }),
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: true,
    minPasswordLength: 8,
    maxPasswordLength: 128,
    resetPasswordTokenExpiresIn: 60 * 60 * 24 * 7,
  },
  emailVerification: {
    sendVerificationEmail: async ({
      user,
      url,
    }: {
      user: User;
      url: string;
    }) => {
      await sendEmailVerificationEmail(user.email, url);
    },
    sendOnSignUp: false,
    autoSignInAfterVerification: true,
    expiresIn: 3600,
  },
  user: {
    changeEmail: {
      enabled: true,
      sendChangeEmailVerification: async ({ user, url }) => {
        await sendChangeEmailVerificationEmail(user.email, url);
      },
    },
  },
  baseURL:
    process.env.NODE_ENV === "production"
      ? process.env.BETTER_AUTH_URL
      : "http://localhost:3000",
  plugins: [nextCookies(), openAPI()],
});
