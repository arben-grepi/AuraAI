import { Resend } from "resend";
import "dotenv/config";
import PasswordResetEmail from "./templates/password-reset-email";
import { render } from "@react-email/components";
import EmailVerificationTemplate from "./templates/email-verification-template";
import ChangeEmailVerificationTemplate from "./templates/change-email-verification";
import OrganizationInvitationEmail from "./templates/invitation-email";

const resend = new Resend(process.env.RESEND_API_KEY);

/** Resend “from” — must be a verified domain in production (or Resend test sender in dev). */
function resendFrom(): string {
  const from = process.env.RESEND_FROM_EMAIL?.trim();
  if (!from) {
    throw new Error(
      "RESEND_FROM_EMAIL is not set. Add it to .env (see .env.example).",
    );
  }
  return from;
}

export async function sendPasswordResetEmail(userEmail: string, url: string) {
  const html = await render(
    PasswordResetEmail({
      userEmail,
      url,
    }),
  );

  const { data, error } = await resend.emails.send({
    from: resendFrom(),
    to: [userEmail],
    subject: "Password Reset",
    html,
  });

  if (error) {
    console.error({ error });
    throw new Error(`Failed to send password reset email: ${error.message}`);
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
    from: resendFrom(),
    to: [userEmail],
    subject: "Email Verification",
    html,
  });

  if (error) {
    console.error({ error });
    throw new Error(`Failed to send email verification: ${error.message}`);
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
    from: resendFrom(),
    to: [userEmail],
    subject: "Change Email Verification",
    html,
  });

  if (error) {
    console.error({ error });
    throw new Error(
      `Failed to send change email verification: ${error.message}`,
    );
  }

  return { data };
}

export async function sendOrganizationInvitation({
  email,
  invitedByUsername,
  invitedByEmail,
  teamName,
  inviteLink,
}: {
  email: string;
  invitedByUsername: string;
  invitedByEmail: string;
  teamName: string;
  inviteLink: string;
}): Promise<{ data: unknown; devInviteLink?: string }> {
  const html = await render(
    OrganizationInvitationEmail({
      email,
      invitedByUsername,
      invitedByEmail,
      teamName,
      inviteLink,
    }),
  );

  const { data, error } = await resend.emails.send({
    from: resendFrom(),
    to: [email],
    subject: `You've been invited to join ${teamName}`,
    html,
  });

  if (error) {
    // In development, Resend may reject sends to unverified recipients or
    // unverified "from" domains. Instead of throwing, log the invite link so
    // the developer can copy/paste it and still test the full invite flow.
    if (process.env.NODE_ENV !== "production") {
      console.warn(
        `[DEV] Resend could not deliver invite to ${email}: ${error.message}`,
      );
      console.warn(`[DEV] Use this invite link manually: ${inviteLink}`);
      return { data: null, devInviteLink: inviteLink };
    }
    console.error({ error });
    throw new Error(`Failed to send organization invitation: ${error.message}`);
  }

  return { data };
}

export async function sendPasswordResetEmailEmail(
  userEmail: string,
  url: string,
) {
  const html = await render(
    PasswordResetEmail({
      url,
      userEmail,
    }),
  );

  const { data, error } = await resend.emails.send({
    from: resendFrom(),
    to: [userEmail],
    subject: "Password Reset",
    html,
  });

  if (error) {
    console.error({ error });
    throw new Error(`Failed to send password reset email: ${error.message}`);
  }

  return { data };
}
