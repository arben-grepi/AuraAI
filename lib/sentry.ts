/**
 * Sentry utility functions for setting user context and other common operations
 */

import * as Sentry from "@sentry/nextjs";

/**
 * Set user context in Sentry for error tracking
 * Call this in API routes or server components after verifying authentication
 */
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

/**
 * Clear user context in Sentry (e.g., on logout)
 */
export function clearSentryUser() {
  Sentry.setUser(null);
}

/**
 * Add breadcrumb to Sentry for debugging
 */
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

