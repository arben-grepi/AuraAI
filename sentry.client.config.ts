// This file configures the initialization of Sentry on the client.
// The added config here will be used whenever a users loads a page in their browser.
// https://docs.sentry.io/platforms/javascript/guides/nextjs/

import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,

  // Adjust this value in production, or use tracesSampler for greater control
  tracesSampleRate:
    process.env.NODE_ENV === "production" ? 0.1 : 1.0,

  // Setting this option to true will print useful information to the console while you're setting up Sentry.
  debug: process.env.NODE_ENV === "development",

  // Session Replay configuration (optional - requires Sentry plan with Replay)
  // Remove or set to 0 if you don't have Session Replay enabled
  replaysOnErrorSampleRate: 1.0,
  replaysSessionSampleRate:
    process.env.NODE_ENV === "production" ? 0.1 : 1.0,

  integrations: [
    // Session Replay integration (optional - comment out if not available in your plan)
    Sentry.replayIntegration({
      maskAllText: true,
      blockAllMedia: true,
    }),
  ],

  environment: process.env.NODE_ENV || "development",

  // Set sample rate for profiling - this is relative to tracesSampleRate
  profilesSampleRate:
    process.env.NODE_ENV === "production" ? 0.1 : 1.0,

  beforeSend(event, hint) {
    // Filter out known non-critical errors
    if (event.exception) {
      const error = hint.originalException;
      // Don't send errors from browser extensions
      if (
        error instanceof Error &&
        (error.message.includes("chrome-extension://") ||
          error.message.includes("moz-extension://"))
      ) {
        return null;
      }
    }
    return event;
  },
});

