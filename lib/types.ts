export type SignUpForm = {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
};

export type Theme = "light" | "dark" | "system";

export type ActionResult<TData = unknown, TError = string> = {
  success: boolean;
  data: TData | null;
  error: TError | null;
};
