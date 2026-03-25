"use server";

import { APIError } from "better-auth";
import { auth, AUTH_SEND_VERIFICATION_EMAIL_ON_SIGN_UP } from "./auth";
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
  organizationSourcesSchema,
} from "./schema";
import { z } from "zod";
import { generateSlug } from "./utils";
import { UIMessage, generateText } from "ai";
import { openai } from "@ai-sdk/openai";
import { isSystemAdmin, isSuperAdmin } from "./auth-utils";

async function getMembership(organizationId: string, userId: string) {
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
  if (isSystemAdmin(sessionRole)) {
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
    return { error: "Could not create account", success: false, data: null };
  }

  return {
    success: true,
    data: {
      data: AUTH_SEND_VERIFICATION_EMAIL_ON_SIGN_UP
        ? "We sent an email to verify your account."
        : "Account created. You can sign in.",
    },
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
    data: { data: "You are signed in" },
    error: null,
  };
}

export async function createConversation(
  chatFolderId?: string | null,
): Promise<ActionResult<{ data: string; id: string }>> {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session) {
    return { success: false, data: null, error: "Unauthorized" };
  }

  const organizationId = session.session?.activeOrganizationId;

  if (!organizationId) {
    return {
      success: false,
      data: null,
      error: "No active organization selected",
    };
  }

  if (!isSystemAdmin(session.user.role)) {
    const membership = await getMembership(organizationId, session.user.id);

    if (!membership) {
      return { success: false, data: null, error: "Unauthorized" };
    }
  }

  if (chatFolderId) {
    const folder = await prisma.chatFolder.findFirst({
      where: { id: chatFolderId, organizationId },
    });
    if (!folder) {
      return { success: false, data: null, error: "Folder not found" };
    }
  }

  const created = await prisma.conversation.create({
    data: {
      title: "New chat",
      userId: session.user.id,
      organizationId,
      chatFolderId: chatFolderId || undefined,
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
    return {
      success: false,
      data: null,
      error: "No active organization selected",
    };
  }

  if (!isSystemAdmin(session.user.role)) {
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
      data: { data: "Password has been reset" },
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

  if (!isSystemAdmin(session.user.role)) {
    return { success: false, data: null, error: "Insufficient permissions" };
  }

  // Check org creation limit
  const creator = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { maxOrgs: true },
  });

  if (creator?.maxOrgs !== null && creator?.maxOrgs !== undefined) {
    const ownedOrgCount = await prisma.member.count({
      where: { userId: session.user.id, role: "owner" },
    });
    if (ownedOrgCount >= creator.maxOrgs) {
      return {
        success: false,
        data: null,
        error: `You have reached your organization limit (${creator.maxOrgs})`,
      };
    }
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
    description,
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
        description,
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

  if (!isSystemAdmin(session.user.role)) {
    return { success: false, data: null, error: "Insufficient permissions" };
  }

  // Admin can only delete orgs they own
  if (!isSuperAdmin(session.user.role)) {
    const ownership = await prisma.member.findFirst({
      where: {
        organizationId: id,
        userId: session.user.id,
        role: "owner",
      },
    });
    if (!ownership) {
      return { success: false, data: null, error: "Insufficient permissions" };
    }
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

  // Check member limit
  const org = await prisma.organization.findUnique({
    where: { id: organizationId },
    select: { maxMembers: true },
  });

  if (org?.maxMembers !== null && org?.maxMembers !== undefined) {
    const currentMemberCount = await prisma.member.count({
      where: { organizationId },
    });
    if (currentMemberCount >= org.maxMembers) {
      return {
        success: false,
        data: null,
        error: `Organization has reached its member limit (${org.maxMembers})`,
      };
    }
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

export async function deleteOrgUser({
  userId,
  organizationId,
}: {
  userId: string;
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
    await auth.api.removeUser({
      headers: await headers(),
      body: { userId },
    });

    return {
      success: true,
      data: { data: "User deleted successfully" },
      error: null,
    };
  } catch (error) {
    if (error instanceof APIError) {
      return { error: error.message, success: false, data: null };
    }
    console.error("[DELETE_USER] Failed to delete user", error);
    return {
      error: "Could not delete user",
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

    if (!member && !isSystemAdmin(session.user.role)) {
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

  // Check member limit before creating user to avoid orphaned accounts
  const orgData = await prisma.organization.findUnique({
    where: { id: organization.id },
    select: { maxMembers: true },
  });

  if (orgData?.maxMembers !== null && orgData?.maxMembers !== undefined) {
    const currentMemberCount = await prisma.member.count({
      where: { organizationId: organization.id },
    });
    if (currentMemberCount >= orgData.maxMembers) {
      return {
        success: false,
        data: null,
        error: `Organization has reached its member limit (${orgData.maxMembers})`,
      };
    }
  }

  const { email, password, firstName, lastName } = validated.data;

  try {
    const user = await auth.api.createUser({
      body: {
        email,
        password,
        name: `${firstName} ${lastName}`,
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

export async function handleUpdateOrganizationTone(
  organizationId: string,
  tone: string,
): Promise<ActionResult<{ data: string }>> {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session) {
    return { success: false, data: null, error: "Unauthorized" };
  }

  const canManageOrg = await userHasOrgAdminAccess({
    organizationId,
    userId: session.user.id,
    sessionRole: session.user.role,
  });

  if (!canManageOrg) {
    return { success: false, data: null, error: "Insufficient permissions" };
  }

  try {
    const data = await prisma.organization.update({
      where: { id: organizationId },
      data: { tone },
    });

    if (!data) {
      return {
        success: false,
        data: null,
        error: "Failed to update organization tone",
      };
    }

    return {
      success: true,
      data: { data: "Organization tone updated" },
      error: null,
    };
  } catch (error) {
    if (error instanceof APIError) {
      return { error: error.message, success: false, data: null };
    }
    console.error("[PRISMA] Update organization tone has not worked", error);
    return {
      error: "Could not update organization tone",
      success: false,
      data: null,
    };
  }
}

export async function handleUpdateOrganizationSystemPrompt({
  organizationId,
  systemPrompt,
}: {
  organizationId: string;
  systemPrompt: string;
}): Promise<ActionResult<{ data: string }>> {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session) {
    return { success: false, data: null, error: "Unauthorized" };
  }

  const canManageOrg = await userHasOrgAdminAccess({
    organizationId,
    userId: session.user.id,
    sessionRole: session.user.role,
  });

  if (!canManageOrg) {
    return { success: false, data: null, error: "Insufficient permissions" };
  }

  try {
    const data = await prisma.organization.update({
      where: { id: organizationId },
      data: { systemPrompt },
    });

    if (!data) {
      return {
        success: false,
        data: null,
        error: "Failed to update organization system prompt",
      };
    }

    return {
      success: true,
      data: { data: "Organization system prompt updated" },
      error: null,
    };
  } catch (error) {
    if (error instanceof APIError) {
      return { error: error.message, success: false, data: null };
    }
    console.error(
      "[PRISMA] Update organization system prompt has not worked",
      error,
    );
    return {
      error: "Could not update organization system prompt",
      success: false,
      data: null,
    };
  }
}

export async function createFileFolder(
  organizationId: string,
  name: string,
): Promise<ActionResult<{ data: string }>> {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session) {
    return { success: false, data: null, error: "Unauthorized" };
  }

  const canManageOrg = await userHasOrgAdminAccess({
    organizationId,
    userId: session.user.id,
    sessionRole: session.user.role,
  });

  if (!canManageOrg) {
    return { success: false, data: null, error: "Insufficient permissions" };
  }

  try {
    const data = await prisma.fileFolder.create({
      data: { name, organizationId },
    });

    if (!data) {
      return {
        success: false,
        data: null,
        error: "Failed to create file folder",
      };
    }

    return {
      success: true,
      data: { data: "File folder created" },
      error: null,
    };
  } catch (error) {
    if (error instanceof APIError) {
      return { error: error.message, success: false, data: null };
    }
    console.error("[PRISMA] Create file folder has not worked", error);
    return {
      success: false,
      data: null,
      error: "Failed to create file folder",
    };
  }
}

export async function deleteFileFolder(
  folderId: string,
): Promise<ActionResult<{ data: string }>> {
  if (!folderId) {
    return { success: false, data: null, error: "Folder ID is required" };
  }

  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    return { success: false, data: null, error: "Unauthorized" };
  }

  const folder = await prisma.fileFolder.findUnique({
    where: { id: folderId },
    select: { id: true, organizationId: true },
  });
  if (!folder) {
    return { success: false, data: null, error: "Folder not found" };
  }

  const canManageOrg = await userHasOrgAdminAccess({
    organizationId: folder.organizationId,
    userId: session.user.id,
    sessionRole: session.user.role,
  });
  if (!canManageOrg) {
    return { success: false, data: null, error: "Insufficient permissions" };
  }

  try {
    await prisma.fileFolder.delete({ where: { id: folderId } });
    return { success: true, data: { data: "Folder deleted" }, error: null };
  } catch (error) {
    console.error("[PRISMA] Delete file folder failed", error);
    return { success: false, data: null, error: "Failed to delete folder" };
  }
}

export async function createChatFolder(
  name: string,
): Promise<ActionResult<{ data: string }>> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    return { success: false, data: null, error: "Unauthorized" };
  }

  const organizationId = session.session?.activeOrganizationId;
  if (!organizationId) {
    return {
      success: false,
      data: null,
      error: "No active organization selected",
    };
  }

  if (!isSystemAdmin(session.user.role)) {
    const membership = await getMembership(organizationId, session.user.id);
    if (!membership) {
      return { success: false, data: null, error: "Unauthorized" };
    }
  }

  try {
    await prisma.chatFolder.create({
      data: { name, organizationId },
    });
    revalidateTag("conversations");
    return { success: true, data: { data: "Folder created" }, error: null };
  } catch (error) {
    console.error("[PRISMA] Create chat folder failed", error);
    return { success: false, data: null, error: "Failed to create folder" };
  }
}

export async function deleteChatFolder(
  folderId: string,
): Promise<ActionResult<{ data: string }>> {
  if (!folderId) {
    return { success: false, data: null, error: "Folder ID is required" };
  }

  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    return { success: false, data: null, error: "Unauthorized" };
  }

  const folder = await prisma.chatFolder.findUnique({
    where: { id: folderId },
    select: { id: true, organizationId: true },
  });
  if (!folder) {
    return { success: false, data: null, error: "Folder not found" };
  }

  if (!isSystemAdmin(session.user.role)) {
    const membership = await getMembership(
      folder.organizationId,
      session.user.id,
    );
    if (!membership) {
      return { success: false, data: null, error: "Unauthorized" };
    }
  }

  try {
    await prisma.chatFolder.delete({ where: { id: folderId } });
    revalidateTag("conversations");
    return { success: true, data: { data: "Folder deleted" }, error: null };
  } catch (error) {
    console.error("[PRISMA] Delete chat folder failed", error);
    return { success: false, data: null, error: "Failed to delete folder" };
  }
}

export async function handleUpdateOrganizationSources({
  organizationId,
  sources,
}: {
  organizationId: string;
  sources: string[];
}): Promise<ActionResult<{ data: string }>> {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session) {
    return { success: false, data: null, error: "Unauthorized" };
  }

  const canManageOrg = await userHasOrgAdminAccess({
    organizationId,
    userId: session.user.id,
    sessionRole: session.user.role,
  });

  if (!canManageOrg) {
    return { success: false, data: null, error: "Insufficient permissions" };
  }

  const validated = organizationSourcesSchema.safeParse({ sources });
  if (!validated.success) {
    return { success: false, data: null, error: validated.error.message };
  }

  try {
    await prisma.organization.update({
      where: { id: organizationId },
      data: { sources: validated.data.sources },
    });

    return {
      success: true,
      data: { data: "Organization sources updated" },
      error: null,
    };
  } catch (error) {
    if (error instanceof APIError) {
      return { error: error.message, success: false, data: null };
    }
    console.error(
      "[PRISMA] Update organization sources has not worked",
      error,
    );
    return {
      error: "Could not update organization sources",
      success: false,
      data: null,
    };
  }
}

export async function handleDeleteOrganizationSource({
  organizationId,
  sourceUrl,
}: {
  organizationId: string;
  sourceUrl: string;
}): Promise<ActionResult<{ data: string }>> {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session) {
    return { success: false, data: null, error: "Unauthorized" };
  }

  const canManageOrg = await userHasOrgAdminAccess({
    organizationId,
    userId: session.user.id,
    sessionRole: session.user.role,
  });

  if (!canManageOrg) {
    return { success: false, data: null, error: "Insufficient permissions" };
  }

  try {
    const parsedUrl = new URL(sourceUrl);
    const hostname = parsedUrl.hostname;

    // Delete resources (embeddings cascade-delete), source index, and remove from org sources array
    await prisma.$transaction(async (tx) => {
      // Delete resources and their embeddings for this source
      await tx.$executeRawUnsafe(
        `DELETE FROM "resources" WHERE "organization_id" = $1 AND "tags" @> ARRAY['web-scrape', $2]::text[]`,
        organizationId,
        `source:${hostname}`,
      );

      // Delete source index record
      await tx.sourceIndex.deleteMany({
        where: { organizationId, sourceUrl },
      });

      // Remove URL from the organization's sources array
      const org = await tx.organization.findUnique({
        where: { id: organizationId },
        select: { sources: true },
      });
      if (org) {
        await tx.organization.update({
          where: { id: organizationId },
          data: {
            sources: org.sources.filter((s) => s !== sourceUrl),
          },
        });
      }
    });

    return {
      success: true,
      data: { data: "Source and all its data deleted" },
      error: null,
    };
  } catch (error) {
    console.error("[PRISMA] Delete organization source failed", error);
    return {
      error: "Could not delete source",
      success: false,
      data: null,
    };
  }
}

export async function updateConversationFolder(
  conversationId: string,
  chatFolderId: string | null,
): Promise<ActionResult<{ data: string }>> {
  if (!conversationId) {
    return { success: false, data: null, error: "Conversation ID is required" };
  }

  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    return { success: false, data: null, error: "Unauthorized" };
  }

  const organizationId = session.session?.activeOrganizationId;
  if (!organizationId) {
    return {
      success: false,
      data: null,
      error: "No active organization selected",
    };
  }

  const conversation = await prisma.conversation.findUnique({
    where: { id: conversationId },
    select: { id: true, userId: true, organizationId: true },
  });
  if (!conversation || conversation.userId !== session.user.id) {
    return { success: false, data: null, error: "Conversation not found" };
  }
  if (conversation.organizationId !== organizationId) {
    return {
      success: false,
      data: null,
      error: "Conversation not in active organization",
    };
  }

  if (chatFolderId) {
    const folder = await prisma.chatFolder.findFirst({
      where: { id: chatFolderId, organizationId },
    });
    if (!folder) {
      return { success: false, data: null, error: "Folder not found" };
    }
  }

  try {
    await prisma.conversation.update({
      where: { id: conversationId },
      data: { chatFolderId },
    });
    revalidateTag("conversations");
    return { success: true, data: { data: "Conversation moved" }, error: null };
  } catch (error) {
    console.error("[PRISMA] Update conversation folder failed", error);
    return { success: false, data: null, error: "Failed to move conversation" };
  }
}
