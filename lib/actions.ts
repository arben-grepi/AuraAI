"use server";

import { APIError } from "better-auth";
import { auth } from "./auth";
import { redirect } from "next/navigation";
import prisma from "./prisma";
import { headers } from "next/headers";
import { revalidateTag } from "next/cache";

interface State {
  errorMessage: string | null;
}

export async function signUp(
  prevState: State,
  formData: FormData,
): Promise<State> {
  const rawFormData = {
    email: formData.get("email") as string,
    password: formData.get("password") as string,
    firstName: formData.get("firstName") as string,
    lastName: formData.get("lastName") as string,
  };

  const { email, password, firstName, lastName } = rawFormData;

  if (!email || !password || !firstName || !lastName) {
    return { errorMessage: "All fields are required" };
  }

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
      return { errorMessage: error.message };
    }
    console.error("sign up with email and password has not worked", error);
    return { errorMessage: "Could not sign up" };
  }

  redirect("/sign-in");
}

export async function signIn(
  prevState: State,
  formData: FormData,
): Promise<State> {
  const rawFormData = {
    email: formData.get("email") as string,
    password: formData.get("password") as string,
  };

  const { email, password } = rawFormData;

  if (!email || !password) {
    return { errorMessage: "All fields are required" };
  }

  try {
    await auth.api.signInEmail({
      body: {
        email,
        password,
      },
    });
  } catch (error) {
    if (error instanceof APIError) {
      return { errorMessage: error.message };
    }
    console.error("sign in with email and password has not worked", error);
    return { errorMessage: "Could not sign in" };
  }

  redirect("/chat");
}

export async function createConversation(formData: FormData) {
  const title = formData.get("title") as string;

  if (!title) {
    return redirect("/");
  }

  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session) {
    return redirect("/sign-in");
  }

  await prisma.conversation.create({
    data: {
      title,
      userId: session.user.id,
    },
  });

  revalidateTag("conversations");
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
