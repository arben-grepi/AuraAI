import { Resend } from "resend";
import "dotenv/config";
import PasswordResetEmail from "./templates/forgot-password-template";
import { render } from "@react-email/components";
import EmailVerificationTemplate from "./templates/email-verification-template";
import ChangeEmailVerificationTemplate from "./templates/change-email-verification";

const resend = new Resend(process.env.RESEND_API_KEY);

export async function sendPasswordResetEmail(
  userEmail: string,
  resetLink: string,
) {
  const html = await render(
    PasswordResetEmail({
      userEmail,
      resetLink,
    }),
  );

  const { data, error } = await resend.emails.send({
    from: "info@caflercovers.com",
    to: [userEmail],
    subject: "Password Reset",
    html,
  });

  if (error) {
    return console.error({ error });
  }

  return { data };
}

export async function sendEmailVerificationEmail(
  userEmail: string,
  verificationLink: string,
) {
  const html = await render(
    EmailVerificationTemplate({
      userEmail,
      verificationLink,
    }),
  );

  const { data, error } = await resend.emails.send({
    from: "info@caflercovers.com",
    to: [userEmail],
    subject: "Email Verification",
    html,
  });

  if (error) {
    return console.error({ error });
  }

  return { data };
}

export async function sendChangeEmailVerificationEmail(
  userEmail: string,
  verificationLink: string,
) {
  const html = await render(
    ChangeEmailVerificationTemplate({
      userEmail,
      verificationLink,
    }),
  );

  const { data, error } = await resend.emails.send({
    from: "info@caflercovers.com",
    to: [userEmail],
    subject: "Change Email Verification",
    html,
  });

  if (error) {
    return console.error({ error });
  }

  return { data };
}
