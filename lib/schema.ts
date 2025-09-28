import z from "zod";

export const signUpSchema = z.object({
  firstName: z
    .string()
    .min(1, { error: "First name is required" })
    .min(2)
    .max(50),
  lastName: z.string().min(1, { error: "Last name is required" }).min(2),
  email: z.email().min(1, { error: "Email is required" }).min(2),
  password: z.string().min(8, { error: "Password is required" }),
});

export const signInSchema = z.object({
  email: z.email().min(1, { error: "Email is required" }).min(2),
  password: z.string().min(8, { error: "Password is required" }),
});

export const requestPasswordResetSchema = z.object({
  email: z.email().min(1, { error: "Email is required" }),
});

export const resetPasswordSchema = z.object({
  newPassword: z.string().min(8, { error: "Password is required" }),
});

export const createOrganizationSchema = z.object({
  name: z.string().min(1, { error: "Name is required" }),
  logo: z.string().min(1, { error: "Logo is required" }),
  keepCurrentActiveOrganization: z.boolean().optional(),
});
