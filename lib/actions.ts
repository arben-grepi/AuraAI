"use server";

import { APIError } from "better-auth";
import { auth } from "./auth";
import { redirect } from "next/navigation";

interface State {
  errorMessage?: string | null;
}

export async function signUp(prevState: State | null, formData: FormData) {
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
  }
  return { errorMessage: "We have sent you an email to verify your account" };
}

export async function signIn(prevState: State | null, formData: FormData) {
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
  redirect("/");
  return { errorMessage: "Signed in successfully" };
}
