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
import { UIMessage, generateText } from "ai";
import { openai } from "@ai-sdk/openai";

async function getMembership(
  organizationId: string,
  userId: string,
) {
  return prisma.member.findFirst({
    where: {
      organizationId,
      userId,
    },
    select: {
      id: true,
      role: true,
    },
  });
}

function hasOrgAdminPrivileges(
  membershipRole: string | null | undefined,
): boolean {
  return membershipRole === "owner" || membershipRole === "admin";
}

async function userHasOrgAdminAccess({
  organizationId,
  userId,
  sessionRole,
}: {
  organizationId: string;
  userId: string;
  sessionRole: string | null | undefined;
}) {
  if (sessionRole === "admin") {
    return true;
  }

  const membership = await getMembership(organizationId, userId);

  if (!membership) {
    return false;
  }

  return hasOrgAdminPrivileges(membership.role ?? null);
}

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

  const organizationId = session.session?.activeOrganizationId;

  if (!organizationId) {
    return {
      success: false,
      data: null,
      error: "No active organization selected",
    };
  }

  if (session.user.role !== "admin") {
    const membership = await getMembership(organizationId, session.user.id);

    if (!membership) {
      return { success: false, data: null, error: "Unauthorized" };
    }
  }

  const created = await prisma.conversation.create({
    data: {
      title: "New chat",
      userId: session.user.id,
      organizationId,
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

  const organizationId = session.session?.activeOrganizationId;

  if (!organizationId) {
    return { success: false, data: null, error: "No active organization selected" };
  }

  if (session.user.role !== "admin") {
    const membership = await getMembership(organizationId, session.user.id);

    if (!membership) {
      return { success: false, data: null, error: "Unauthorized" };
    }
  }

  const conversation = await prisma.conversation.findFirst({
    where: {
      id,
      userId: session.user.id,
      organizationId,
    },
    select: { id: true },
  });

  if (!conversation) {
    return { success: false, data: null, error: "Conversation not found" };
  }

  await prisma.conversation.delete({
    where: { id: conversation.id },
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

  if (session.user.role !== "admin") {
    return { success: false, data: null, error: "Insufficient permissions" };
  }

  const validated = createOrganizationSchema.safeParse(values);

  if (!validated.success) {
    return { success: false, data: null, error: validated.error.message };
  }

  const {
    name,
    logo,
    keepCurrentActiveOrganization,
    backgroundColor,
    buttonColor,
    tone,
  } = validated.data;
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
      const errorMessage = error.message.toLowerCase().includes("slug is taken")
        ? "This name is taken"
        : error.message;
      return { error: errorMessage, success: false, data: null };
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
        backgroundColor,
        buttonColor,
        tone,
      },
    });
    return {
      success: true,
      data: { data: "Organization created" },
      error: null,
    };
  } catch (error) {
    if (error instanceof APIError) {
      const errorMessage = error.message.toLowerCase().includes("slug is taken")
        ? "This name is taken"
        : error.message;
      return { error: errorMessage, success: false, data: null };
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

  if (session.user.role !== "admin") {
    return { success: false, data: null, error: "Insufficient permissions" };
  }

  try {
    await auth.api.deleteOrganization({
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

export async function addMemberToOrg(
  organizationId: string,
  userId: string,
  role: "owner" | "admin" | "member",
): Promise<ActionResult<{ data: string }>> {
  const session = await auth.api.getSession({
    headers: await headers(),
  });
  if (!session) {
    return { success: false, data: null, error: "Unauthorized" };
  }

  const canManageMembers = await userHasOrgAdminAccess({
    organizationId,
    userId: session.user.id,
    sessionRole: session.user.role,
  });

  if (!canManageMembers) {
    return { success: false, data: null, error: "Insufficient permissions" };
  }

  try {
    await auth.api.addMember({
      body: {
        userId,
        role: [role],
        organizationId,
      },
    });
    return {
      success: true,
      data: { data: "Member added to organization" },
      error: null,
    };
  } catch (error) {
    if (error instanceof APIError) {
      return { error: error.message, success: false, data: null };
    }
    console.error(
      "[BETTER_AUTH] Add member to organization has not worked",
      error,
    );
    return {
      error: "Could not add member to organization",
      success: false,
      data: null,
    };
  }
}

export async function removeMemberFromOrg({
  idOrEmail,
  organizationId,
}: {
  idOrEmail: string;
  organizationId: string;
}): Promise<ActionResult<{ data: string }>> {
  const session = await auth.api.getSession({
    headers: await headers(),
  });
  if (!session) {
    return { success: false, data: null, error: "Unauthorized" };
  }

  const canManageMembers = await userHasOrgAdminAccess({
    organizationId,
    userId: session.user.id,
    sessionRole: session.user.role,
  });

  if (!canManageMembers) {
    return { success: false, data: null, error: "Insufficient permissions" };
  }

  try {
    await auth.api.removeMember({
      headers: await headers(),
      body: {
        memberIdOrEmail: idOrEmail,
        organizationId,
      },
    });
    return {
      success: true,
      data: { data: "Member removed from organization" },
      error: null,
    };
  } catch (error) {
    if (error instanceof APIError) {
      const errorMessage = error.message || "Unknown API error occurred";
      return { error: errorMessage, success: false, data: null };
    }
    console.error(
      "[BETTER_AUTH] Remove member from organization has not worked",
      error,
    );
    return {
      error: "Could not remove member from organization",
      success: false,
      data: null,
    };
  }
}

export async function updateMemberRole({
  memberId,
  organizationId,
  role,
}: {
  memberId: string;
  organizationId: string;
  role: "owner" | "admin" | "member";
}): Promise<ActionResult<{ data: string }>> {
  const session = await auth.api.getSession({
    headers: await headers(),
  });
  if (!session) {
    return { success: false, data: null, error: "Unauthorized" };
  }

  const canManageMembers = await userHasOrgAdminAccess({
    organizationId,
    userId: session.user.id,
    sessionRole: session.user.role,
  });

  if (!canManageMembers) {
    return { success: false, data: null, error: "Insufficient permissions" };
  }

  try {
    await auth.api.updateMemberRole({
      headers: await headers(),
      body: {
        memberId,
        organizationId,
        role,
      },
    });
    return {
      success: true,
      data: { data: "Member role updated successfully" },
      error: null,
    };
  } catch (error) {
    if (error instanceof APIError) {
      return { error: error.message, success: false, data: null };
    }
    console.error("[BETTER_AUTH] Update member role has not worked", error);
    return {
      error: "Could not update member role",
      success: false,
      data: null,
    };
  }
}

export async function generateTitleFromUserMessage({
  message,
}: {
  message: UIMessage;
}) {
  const { text: title } = await generateText({
    model: openai("gpt-4o-mini"),
    system: `\n
    - you will generate a short title based on the first message a user begins a conversation with
    - ensure it is not more than 80 characters long
    - the title should be a summary of the user's message
    - do not use quotes or colons`,
    prompt: JSON.stringify(message),
  });

  return title;
}

export async function deleteResource(
  id: string,
): Promise<ActionResult<{ data: string }>> {
  if (!id) {
    return { success: false, data: null, error: "Resource ID is required" };
  }

  const session = await auth.api.getSession({
    headers: await headers(),
  });
  if (!session) {
    return { success: false, data: null, error: "Unauthorized" };
  }

  const resource = await prisma.resource.findUnique({
    where: { id },
    select: { id: true, organizationId: true },
  });

  if (!resource) {
    return { success: false, data: null, error: "Resource not found" };
  }

  if (resource.organizationId) {
    const member = await prisma.member.findFirst({
      where: {
        organizationId: resource.organizationId,
        userId: session.user.id,
      },
    });

    if (!member && session.user.role !== "admin") {
      return { success: false, data: null, error: "Unauthorized" };
    }
  }

  const deleted = await prisma.resource.deleteMany({
    where: { id },
  });

  if (deleted.count === 0) {
    return { success: false, data: null, error: "Failed to delete resource" };
  }

  return { success: true, data: { data: "Resource deleted" }, error: null };
}

export async function createOrgUser({
  slug,
  values,
}: {
  slug: string;
  values: z.infer<typeof signUpSchema>;
}): Promise<ActionResult<{ data: string }>> {
  const validated = signUpSchema.safeParse(values);

  if (!validated.success) {
    return { success: false, data: null, error: validated.error.message };
  }

  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session) {
    return { success: false, data: null, error: "Unauthorized" };
  }

  const organization = await prisma.organization.findUnique({
    where: { slug },
    select: { id: true },
  });

  if (!organization) {
    return {
      success: false,
      data: null,
      error: "Organization not found",
    };
  }

  const canManageMembers = await userHasOrgAdminAccess({
    organizationId: organization.id,
    userId: session.user.id,
    sessionRole: session.user.role,
  });

  if (!canManageMembers) {
    return {
      success: false,
      data: null,
      error: "Insufficient permissions",
    };
  }

  const { email, password, firstName, lastName } = validated.data;

  try {
    const user = await auth.api.createUser({
      body: {
        email,
        password,
        name: `${firstName} ${lastName}`,
        role: "user",
      },
    });

    if (!user?.user?.id) {
      return {
        success: false,
        data: null,
        error: "Failed to create user",
      };
    }

    const addMemberResult = await addMemberToOrg(
      organization.id,
      user.user.id,
      "member",
    );

    if (!addMemberResult.success) {
      return {
        success: false,
        data: null,
        error: addMemberResult.error || "Failed to add user to organization",
      };
    }

    return {
      success: true,
      data: { data: "User created and added to organization successfully" },
      error: null,
    };
  } catch (error) {
    if (error instanceof APIError) {
      return { error: error.message, success: false, data: null };
    }
    console.error("[BETTER_AUTH] Create user has not worked", error);
    return {
      error: "Could not create user",
      success: false,
      data: null,
    };
  }
}
