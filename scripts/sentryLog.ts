import "dotenv/config";
import * as Sentry from "@sentry/nextjs";

// Verify DSN is loaded
const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;
if (!dsn) {
  console.error(
    "❌ NEXT_PUBLIC_SENTRY_DSN is not set in environment variables",
  );
  console.error(
    "Please make sure your .env.local or .env file contains NEXT_PUBLIC_SENTRY_DSN",
  );
  process.exit(1);
}

console.log("✅ DSN loaded:", dsn.substring(0, 20) + "...");

// Initialize Sentry for server-side usage
Sentry.init({
  dsn,
  tracesSampleRate: 1.0,
  debug: true, // Enable debug to see what's happening
  environment: process.env.NODE_ENV || "development",
  enableLogs: true,
});

async function sendSampleLogSentry() {
  // Use captureMessage for sending logs to Sentry
  const eventId = Sentry.captureMessage("User triggered test log", {
    level: "info",
    tags: {
      log_source: "sentry_test",
    },
    extra: {
      timestamp: new Date().toISOString(),
    },
  });

  console.log(`Log sent to Sentry with event ID: ${eventId}`);

  // Flush Sentry to ensure the message is sent before the script exits
  await Sentry.flush(2000); // Wait up to 2 seconds for events to be sent
  console.log("Sentry flush completed");
}

sendSampleLogSentry()
  .then(() => {
    console.log("Script completed successfully");
    process.exit(0);
  })
  .catch((error) => {
    console.error("Error sending log to Sentry:", error);
    process.exit(1);
  });
