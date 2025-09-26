"use server";

import { APIError } from "better-auth";
import { auth } from "./auth";
import { redirect } from "next/navigation";
import prisma from "./prisma";
import { headers } from "next/headers";
import { revalidateTag } from "next/cache";
import { ActionResult } from "./types";
import {
  signInSchema,
  signUpSchema,
  requestPasswordResetSchema,
  resetPasswordSchema,
} from "./schema";
import { z } from "zod";

export async function signUp(
  values: z.infer<typeof signUpSchema>,
): Promise<ActionResult<{ data: string }>> {
  const validated = signUpSchema.safeParse(values);

  if (!validated.success) {
    return { success: false, data: null, error: validated.error.message };
  }

  const { email, password, firstName, lastName } = validated.data;

  try {
    await auth.api.signUpEmail({
      body: {
        name: `${firstName} ${lastName}`,
        email,
        password,
      },
    });
  } catch (error) {
    if (error instanceof APIError) {
      return { error: error.message, success: false, data: null };
    }
    console.error(
      "[BETTER_AUTH] Sign up with email and password has not worked",
      error,
    );
    return { error: "Could not sign up", success: false, data: null };
  }

  return {
    success: true,
    data: { data: "We sent you an email to verify your account" },
    error: null,
  };
}

export async function signIn(
  values: z.infer<typeof signInSchema>,
): Promise<ActionResult<{ data: string }>> {
  const validated = signInSchema.safeParse(values);

  if (!validated.success) {
    return { success: false, data: null, error: validated.error.message };
  }

  const { email, password } = validated.data;

  try {
    await auth.api.signInEmail({
      body: {
        email,
        password,
      },
    });
  } catch (error) {
    if (error instanceof APIError) {
      return { error: error.message, success: false, data: null };
    }
    console.error(
      "[BETTER_AUTH] Sign in with email and password has not worked",
      error,
    );
    return {
      error: "An unexpected error occurred",
      success: false,
      data: null,
    };
  }

  return {
    success: true,
    data: { data: "You signed in successfully" },
    error: null,
  };
}

export async function createConversation() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session) {
    return redirect("/sign-in");
  }

  const created = await prisma.conversation.create({
    data: {
      title: "New chat",
      userId: session.user.id,
    },
  });

  if (!created) {
    return { success: false, message: "Failed to create conversation" };
  }

  revalidateTag("conversations");
  return { success: true, message: "Conversation created", id: created.id };
}

export async function deleteConversation(id: string) {
  if (!id) {
    return { success: false, message: "Conversation ID is required" };
  }

  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session) {
    return { success: false, message: "Unauthorized" };
  }

  await prisma.conversation.delete({
    where: {
      id,
      userId: session.user.id,
    },
  });

  revalidateTag("conversations");

  return { success: true, message: "Conversation deleted" };
}

export async function requestPasswordReset(
  values: z.infer<typeof requestPasswordResetSchema>,
  redirect: string,
): Promise<ActionResult<{ data: string }>> {
  const validated = requestPasswordResetSchema.safeParse({
    email: values.email,
  });

  if (!validated.success) {
    return { success: false, data: null, error: validated.error.message };
  }

  try {
    await auth.api.requestPasswordReset({
      body: {
        email: validated.data.email,
        redirectTo: redirect,
      },
    });
    return {
      success: true,
      data: { data: "Password reset email sent" },
      error: null,
    };
  } catch (error) {
    if (error instanceof APIError) {
      return { error: error.message, success: false, data: null };
    }
    console.error("[BETTER_AUTH] Request password reset has not worked", error);
    return {
      error: "Could not request password reset",
      success: false,
      data: null,
    };
  }
}

export async function resetPassword(
  email: z.infer<typeof resetPasswordSchema>,
  token: string,
): Promise<ActionResult<{ data: string }>> {
  const validated = resetPasswordSchema.safeParse({
    newPassword: email.newPassword,
  });

  if (!validated.success) {
    return { success: false, data: null, error: validated.error.message };
  }
  if (!token) {
    return { success: false, data: null, error: "Can't reset password" };
  }

  try {
    await auth.api.resetPassword({
      body: {
        newPassword: validated.data.newPassword,
        token,
      },
    });
    return {
      success: true,
      data: { data: "Password reset successfully" },
      error: null,
    };
  } catch (error) {
    if (error instanceof APIError) {
      return { error: error.message, success: false, data: null };
    }
    console.error("[BETTER_AUTH] Reset password has not worked", error);
    return {
      error: "Could not reset password",
      success: false,
      data: null,
    };
  }
}
