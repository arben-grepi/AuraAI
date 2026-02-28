import * as Sentry from "@sentry/nextjs";

export function setSentryUser(user: {
  id: string;
  email?: string | null;
  name?: string | null;
  role?: string | null;
}) {
  Sentry.setUser({
    id: user.id,
    email: user.email || undefined,
    username: user.name || undefined,
    role: user.role || undefined,
  });
}

export function clearSentryUser() {
  Sentry.setUser(null);
}

export function addBreadcrumb(
  message: string,
  category?: string,
  level?: Sentry.SeverityLevel,
  data?: Record<string, unknown>,
) {
  Sentry.addBreadcrumb({
    message,
    category: category || "default",
    level: level || "info",
    data,
  });
}

