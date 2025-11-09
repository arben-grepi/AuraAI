// This file configures the initialization of Sentry on the server.
// The config you add here will be used whenever the server handles a request.
// https://docs.sentry.io/platforms/javascript/guides/nextjs/

import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.SENTRY_DSN || process.env.NEXT_PUBLIC_SENTRY_DSN,

  // Adjust this value in production, or use tracesSampler for greater control
  tracesSampleRate: process.env.NODE_ENV === "production" ? 0.1 : 1.0,

  // Setting this option to true will print useful information to the console while you're setting up Sentry.
  debug: false,

  environment: process.env.NODE_ENV || process.env.VERCEL_ENV || "development",

  // Set sample rate for profiling - this is relative to tracesSampleRate
  profilesSampleRate: process.env.NODE_ENV === "production" ? 0.1 : 1.0,

  // Enable automatic instrumentation for database queries, HTTP requests, etc.
  integrations: [
    // Add any server-specific integrations here
  ],

  beforeSend(event, hint) {
    // Filter out known non-critical errors
    if (event.exception) {
      const error = hint.originalException;
      // Don't send validation errors or expected errors
      if (
        error instanceof Error &&
        (error.message.includes("Validation error") ||
          error.message.includes("Unauthorized"))
      ) {
        // You can still log these but not send to Sentry
        return null;
      }
    }
    return event;
  },
});
