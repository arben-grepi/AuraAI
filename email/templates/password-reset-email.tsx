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
          <Container className="bg-white rounded-[8px] p-[32px] max-w-[600px] mx-auto">
            {/* Header */}
            <Section className="text-center mb-[32px]">
              <Heading className="text-[24px] font-bold text-gray-900 m-0 mb-[8px]">
                Reset Your Password
              </Heading>
              <Text className="text-[16px] text-gray-600 m-0">
                We received a request to reset your password
              </Text>
            </Section>

            {/* Main Content */}
            <Section className="mb-[32px]">
              <Text className="text-[16px] text-gray-700 mb-[16px] m-0">
                Hello, {userEmail}
              </Text>
              <Text className="text-[16px] text-gray-700 mb-[24px] m-0">
                Someone requested a password reset for your account. If this was
                you, click the button below to reset your password. If you
                didn&apos;t make this request, you can safely ignore this email.
              </Text>

              {/* Reset Button */}
              <Section className="text-center mb-[24px]">
                <Button
                  href={url}
                  className="bg-blue-600 text-white px-[32px] py-[12px] rounded-[8px] text-[16px] font-medium no-underline box-border"
                >
                  Reset Password
                </Button>
              </Section>

              <Text className="text-[14px] text-gray-600 mb-[16px] m-0">
                Or copy and paste this link in your browser:
              </Text>
              <Text className="text-[14px] text-blue-600 mb-[24px] m-0 break-all">
                <Link href={url} className="text-blue-600 no-underline">
                  {url}
                </Link>
              </Text>
            </Section>

            {/* Security Notice */}
            <Section className="bg-gray-50 p-[16px] rounded-[8px] mb-[32px]">
              <Text className="text-[14px] text-gray-700 mb-[8px] m-0 font-medium">
                Security Notice:
              </Text>
              <Text className="text-[14px] text-gray-600 m-0">
                This password reset link will expire in 24 hours for security
                reasons. If you didn&apos;t request this reset, please contact
                our support team immediately.
              </Text>
            </Section>

            {/* Footer */}
            <Section className="border-t border-gray-200 pt-[24px]">
              <Text className="text-[12px] text-gray-500 text-center mb-[8px] m-0">
                Best regards,
                <br />
                The Support Team
              </Text>
              <Text className="text-[12px] text-gray-400 text-center mb-[8px] m-0">
                123 Business Street, Suite 100
                <br />
                Business City, BC 12345
              </Text>
              <Text className="text-[12px] text-gray-400 text-center m-0">
                <Link href="#" className="text-gray-400 no-underline">
                  Unsubscribe
                </Link>{" "}
                | © {new Date().getFullYear()} Company Name. All rights
                reserved.
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
