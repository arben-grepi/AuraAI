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

const PasswordResetEmail = (props: {
  userEmail: string;
  resetLink: string;
}) => {
  const {
    userEmail = "ledionrestelica7@gmail.com",
    resetLink = "https://example.com/reset-password",
  } = props;

  return (
    <Html lang="en" dir="ltr">
      <Tailwind>
        <Head />
        <Preview>Reset your password - Action required</Preview>
        <Body className="bg-white font-sans py-[40px]">
          <Container className="mx-auto py-[40px] px-[20px] max-w-[600px]">
            <Section className="bg-white border border-solid border-black p-[40px]">
              <Heading className="text-[32px] font-bold text-black text-center mb-[32px] mt-0">
                Password Reset
              </Heading>

              <Text className="text-[16px] text-black mb-[24px] leading-[24px]">
                Hello,
              </Text>

              <Text className="text-[16px] text-black mb-[24px] leading-[24px]">
                We received a request to reset the password for your account
                associated with {userEmail}.
              </Text>

              <Text className="text-[16px] text-black mb-[32px] leading-[24px]">
                Click the button below to reset your password. This link will
                expire in 24 hours for security reasons.
              </Text>

              <Section className="text-center mb-[32px]">
                <Button
                  href={resetLink}
                  className="bg-black text-white px-[32px] py-[16px] text-[16px] font-semibold border-none cursor-pointer box-border"
                >
                  Reset Password
                </Button>
              </Section>

              <Text className="text-[14px] text-black mb-[24px] leading-[20px]">
                If the button doesn&apos;t work, copy and paste this link into
                your browser:
              </Text>

              <Text className="text-[14px] text-black mb-[32px] leading-[20px] break-all">
                <Link href={resetLink} className="text-black underline">
                  {resetLink}
                </Link>
              </Text>

              <Text className="text-[14px] text-black mb-[16px] leading-[20px]">
                If you didn&apos;t request this password reset, please ignore
                this email. Your password will remain unchanged.
              </Text>

              <Text className="text-[14px] text-black leading-[20px]">
                Best regards,
                <br />
                The AI Chat Team
              </Text>
            </Section>

            <Section className="mt-[32px] text-center">
              <Text className="text-[12px] text-gray-600 mb-[8px] m-0">
                © 2025 Cafler Covers. All rights reserved.
              </Text>
              <Text className="text-[12px] text-gray-600 m-0">
                Skenderbegova 10, 10000, Prishtina, Kosovo
              </Text>
              <Text className="text-[12px] text-gray-600 mt-[8px]">
                <Link href="#" className="text-gray-600 underline">
                  Unsubscribe
                </Link>
              </Text>
            </Section>
          </Container>
        </Body>
      </Tailwind>
    </Html>
  );
};

PasswordResetEmail.PreviewProps = {
  userEmail: "ledionrestelica7@gmail.com",
  resetLink: "https://example.com/reset-password?token=abc123xyz789",
};

export default PasswordResetEmail;
