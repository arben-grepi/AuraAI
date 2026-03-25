import "dotenv/config";
import { Resend } from "resend";

// Usage:
// 1) Set RESEND_API_KEY and RESEND_FROM_EMAIL in .env (do not commit them)
// 2) Set RESEND_TEST_TO_EMAIL to the address you want to receive the test
//
// Run:
//   npx tsx scripts/send-test-email.ts

async function main() {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) throw new Error("Missing RESEND_API_KEY in .env");

  const resendFrom = process.env.RESEND_FROM_EMAIL ?? "onboarding@resend.dev";
  const testTo = process.env.RESEND_TEST_TO_EMAIL;
  if (!testTo)
    throw new Error("Missing RESEND_TEST_TO_EMAIL in .env (test recipient)");

  const resend = new Resend(apiKey);

  const { data, error } = await resend.emails.send({
    from: resendFrom,
    to: testTo,
    subject: "AuraAI - Resend test email",
    html: "<p>Congrats on sending your <strong>first email</strong>!</p>",
  });

  if (error) {
    // Resend returns the error object in `error` for this SDK method.
    throw new Error(error.message ?? "Failed to send test email");
  }

  console.log("Test email sent:", data?.id ?? data);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

