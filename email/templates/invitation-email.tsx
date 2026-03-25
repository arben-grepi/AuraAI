import * as React from "react";
import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Html,
  Link,
  Preview,
  Section,
  Text,
  Tailwind,
} from "@react-email/components";

const OrganizationInvitationEmail = (props: {
  email: string;
  invitedByUsername: string;
  invitedByEmail: string;
  teamName: string;
  inviteLink: string;
}) => {
  const { email, invitedByUsername, invitedByEmail, teamName, inviteLink } =
    props;

  return (
    <Html lang="en" dir="ltr">
      <Tailwind>
        <Head />
        <Preview>
          {invitedByUsername} invited you to join {teamName}
        </Preview>
        <Body className="bg-gray-100 font-sans py-[40px]">
          <Container className="bg-white rounded-[8px] shadow-sm max-w-[600px] mx-auto p-[40px]">
            <Section className="text-center mb-[32px]">
              <Heading className="text-[28px] font-bold text-gray-900 m-0 mb-[16px]">
                You&apos;ve Been Invited
              </Heading>
              <Text className="text-[16px] text-gray-600 m-0">
                Join <strong>{teamName}</strong> on AuraAI
              </Text>
            </Section>

            <Section className="mb-[32px]">
              <Text className="text-[16px] text-gray-700 m-0 mb-[16px]">
                Hi there,
              </Text>
              <Text className="text-[16px] text-gray-700 m-0 mb-[16px]">
                <strong>{invitedByUsername}</strong> ({invitedByEmail}) has
                invited you to join the <strong>{teamName}</strong>{" "}
                organization.
              </Text>
              <Text className="text-[16px] text-gray-700 m-0 mb-[24px]">
                Click the button below to accept the invitation and get started:
              </Text>
              <Section className="text-center mb-[24px]">
                <Button
                  href={inviteLink}
                  className="bg-blue-600 text-white px-[32px] py-[12px] rounded-[6px] text-[16px] font-semibold no-underline box-border"
                >
                  Accept Invitation
                </Button>
              </Section>
              <Text className="text-[14px] text-gray-600 m-0 mb-[16px]">
                If the button doesn&apos;t work, you can copy and paste this
                link into your browser:
              </Text>
              <Text className="text-[14px] text-blue-600 m-0 mb-[24px] break-all">
                <Link
                  href={inviteLink}
                  className="text-blue-600 underline"
                >
                  {inviteLink}
                </Link>
              </Text>

              <Text className="text-[14px] text-gray-600 m-0 mb-[16px]">
                This invitation will expire in 48 hours for security reasons.
              </Text>

              <Text className="text-[14px] text-gray-600 m-0">
                If you weren&apos;t expecting this invitation, you can safely
                ignore this email.
              </Text>
            </Section>

            <Section className="border-t border-gray-200 pt-[24px] mt-[40px]">
              <Text className="text-[12px] text-gray-500 text-center m-0 mb-[8px]">
                Best regards,
                <br />
                The AuraAI Team
              </Text>
              <Text className="text-[12px] text-gray-400 text-center m-0">
                <Link href="#" className="text-gray-400 underline">
                  Unsubscribe
                </Link>{" "}
                | &copy; {new Date().getFullYear()} AuraAI. All rights reserved.
              </Text>
            </Section>
          </Container>
        </Body>
      </Tailwind>
    </Html>
  );
};

OrganizationInvitationEmail.PreviewProps = {
  email: "user@example.com",
  invitedByUsername: "John Doe",
  invitedByEmail: "john@example.com",
  teamName: "Acme Corp",
  inviteLink: "https://example.com/accept-invitation/abc123",
};

export default OrganizationInvitationEmail;
