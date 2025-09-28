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
  createOrganizationSchema,
} from "./schema";
import { z } from "zod";
import { generateSlug } from "./utils";

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

export async function createConversation(): Promise<
  ActionResult<{ data: string; id: string }>
> {
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
    return {
      success: false,
      data: null,
      error: "Failed to create conversation",
    };
  }

  revalidateTag("conversations");
  return {
    success: true,
    data: { data: "Conversation created", id: created.id },
    error: null,
  };
}

export async function deleteConversation(
  id: string,
): Promise<ActionResult<{ data: string }>> {
  if (!id) {
    return { success: false, data: null, error: "Conversation ID is required" };
  }

  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session) {
    return { success: false, data: null, error: "Unauthorized" };
  }

  await prisma.conversation.delete({
    where: {
      id,
      userId: session.user.id,
    },
  });

  revalidateTag("conversations");

  return { success: true, data: { data: "Conversation deleted" }, error: null };
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

export async function createOrganization(
  values: z.infer<typeof createOrganizationSchema>,
): Promise<ActionResult<{ data: string }>> {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session) {
    return { success: false, data: null, error: "Unauthorized" };
  }

  const validated = createOrganizationSchema.safeParse(values);

  if (!validated.success) {
    return { success: false, data: null, error: validated.error.message };
  }

  const { name, logo, keepCurrentActiveOrganization } = validated.data;
  const slug = generateSlug(name);
  try {
    const doesOrganizationExist = await auth.api.checkOrganizationSlug({
      body: {
        slug,
      },
    });
    if (!doesOrganizationExist.status) {
      return {
        success: false,
        data: null,
        error: "Organization already exists",
      };
    }
  } catch (error) {
    if (error instanceof APIError) {
      return { error: error.message, success: false, data: null };
    }
    console.error(
      "[BETTER_AUTH] Check organization slug has not worked",
      error,
    );
    return {
      error: "Could not check organization slug",
      success: false,
      data: null,
    };
  }

  const metadata = { key: "someValue" };
  try {
    await auth.api.createOrganization({
      body: {
        name,
        slug,
        logo,
        userId: session.user.id,
        keepCurrentActiveOrganization,
        metadata,
      },
    });
    return {
      success: true,
      data: { data: "Organization created" },
      error: null,
    };
  } catch (error) {
    if (error instanceof APIError) {
      return { error: error.message, success: false, data: null };
    }
    console.error("[BETTER_AUTH] Create organization has not worked", error);
    return {
      error: "Could not create organization",
      success: false,
      data: null,
    };
  }
}

export async function deleteOrg(
  id: string,
): Promise<ActionResult<{ data: string }>> {
  const session = await auth.api.getSession({
    headers: await headers(),
  });
  if (!session) {
    return { success: false, data: null, error: "Unauthorized" };
  }

  try {
    const data = await auth.api.deleteOrganization({
      body: {
        organizationId: id,
      },
      headers: await headers(),
    });
    return {
      success: true,
      data: { data: "Organization deleted" },
      error: null,
    };
  } catch (error) {
    if (error instanceof APIError) {
      return { error: error.message, success: false, data: null };
    }
    return {
      error: "Failed to delete organization",
      success: false,
      data: null,
    };
  }
}
