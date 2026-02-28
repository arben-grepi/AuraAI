import { betterAuth, User } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import prisma from "./prisma";
import { nextCookies } from "better-auth/next-js";
import { openAPI, organization, admin } from "better-auth/plugins";
import {
  sendChangeEmailVerificationEmail,
  sendEmailVerificationEmail,
  sendPasswordResetEmailEmail,
} from "@/email/email";
import { ac, admin as adminRole, superadmin } from "./permissions";

export const auth = betterAuth({
  database: prismaAdapter(prisma, {
    provider: "postgresql",
  }),
  emailAndPassword: {
    enabled: true,
    // disableSignUp: true,
    requireEmailVerification: false,
    minPasswordLength: 8,
    maxPasswordLength: 128,
    resetPasswordTokenExpiresIn: 60 * 60 * 24 * 7,
    sendResetPassword: async ({ user, url }) => {
      await sendPasswordResetEmailEmail(user.email, url);
    },
    onPasswordReset: async ({ user }) => {
      console.log(`Password for user ${user.email} has been reset.`);
    },
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
  plugins: [
    nextCookies(),
    openAPI(),
    organization({
      schema: {
        organization: {
          additionalFields: {
            backgroundColor: {
              type: "string",
              required: true,
            },
            buttonColor: {
              type: "string",
              required: true,
            },
            tone: {
              type: "string",
              required: false,
            },
            description: {
              type: "string",
              required: false,
            },
            systemPrompt: {
              type: "string",
              required: false,
            },
          },
        },
      },
    }),
    admin({
      ac,
      roles: {
        admin: adminRole,
        superadmin,
      },
      defaultRole: "user",
      adminUserIds: ["9vhMSKPOfU4MTR3g4O4VjsBW4cE4cPBm"],
    }),
  ],
});
