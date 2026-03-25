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

const ResetPasswordEmail = ({
  url,
  userEmail,
}: {
  url: string;
  userEmail: string;
}) => {
  return (
    <Html lang="en" dir="ltr">
      <Tailwind>
        <Head />
        <Preview>Reset your password - Action required</Preview>
        <Body className="bg-gray-100 font-sans py-[40px]">
          <Container className="bg-white rounded-[8px] shadow-sm max-w-[600px] mx-auto p-[40px]">
            <Section className="text-center mb-[32px]">
              <Heading className="text-[28px] font-bold text-gray-900 m-0 mb-[16px]">
                Reset Your Password
              </Heading>
              <Text className="text-[16px] text-gray-600 m-0">
                We received a request to reset your password
              </Text>
            </Section>

            <Section className="mb-[32px]">
              <Text className="text-[16px] text-gray-700 m-0 mb-[16px]">
                Hi there,
              </Text>
              <Text className="text-[16px] text-gray-700 m-0 mb-[16px]">
                Someone requested a password reset for your account associated
                with <strong>{userEmail}</strong>. If this was you, click the
                button below to reset your password.
              </Text>
              <Text className="text-[16px] text-gray-700 m-0 mb-[24px]">
                Click the button below to reset your password:
              </Text>
              <Section className="text-center mb-[24px]">
                <Button
                  href={url}
                  className="bg-blue-600 text-white px-[32px] py-[12px] rounded-[6px] text-[16px] font-semibold no-underline box-border"
                >
                  Reset Password
                </Button>
              </Section>
              <Text className="text-[14px] text-gray-600 m-0 mb-[16px]">
                If the button doesn&apos;t work, you can copy and paste this
                link into your browser:
              </Text>
              <Text className="text-[14px] text-blue-600 m-0 mb-[24px] break-all">
                <Link href={url} className="text-blue-600 underline">
                  {url}
                </Link>
              </Text>

              <Text className="text-[14px] text-gray-600 m-0 mb-[16px]">
                This reset link will expire in 24 hours for security reasons.
              </Text>

              <Text className="text-[14px] text-gray-600 m-0">
                If you didn&apos;t request this reset, you can safely ignore
                this email. Your password will remain unchanged.
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

ResetPasswordEmail.PreviewProps = {
  url: "https://example.com/reset-password?token=abc123xyz789",
};

export default ResetPasswordEmail;
