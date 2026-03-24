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

const EmailVerificationTemplate = (props: {
  userEmail: string;
  verificationLink: string;
}) => {
  const { userEmail, verificationLink } = props;

  return (
    <Html lang="en" dir="ltr">
      <Tailwind>
        <Head />
        <Preview>
          Please verify your email address to complete your registration
        </Preview>
        <Body className="bg-gray-100 font-sans py-[40px]">
          <Container className="bg-white rounded-[8px] shadow-sm max-w-[600px] mx-auto p-[40px]">
            <Section className="text-center mb-[32px]">
              <Heading className="text-[28px] font-bold text-gray-900 m-0 mb-[16px]">
                Verify Your Email
              </Heading>
              <Text className="text-[16px] text-gray-600 m-0">
                Complete your registration by verifying your email address
              </Text>
            </Section>

            <Section className="mb-[32px]">
              <Text className="text-[16px] text-gray-700 m-0 mb-[16px]">
                Hi there,
              </Text>
              <Text className="text-[16px] text-gray-700 m-0 mb-[16px]">
                Welcome! Thank you for signing up. To complete your registration
                and secure your account, please verify your email address{" "}
                <strong>{userEmail}</strong>.
              </Text>
              <Text className="text-[16px] text-gray-700 m-0 mb-[24px]">
                Click the button below to verify your email address:
              </Text>
              <Section className="text-center mb-[24px]">
                <Button
                  href={verificationLink}
                  className="bg-blue-600 text-white px-[32px] py-[12px] rounded-[6px] text-[16px] font-semibold no-underline box-border"
                >
                  Verify Email Address
                </Button>
              </Section>
              <Text className="text-[14px] text-gray-600 m-0 mb-[16px]">
                If the button doesn&apos;t work, you can copy and paste this
                link into your browser:
              </Text>
              <Text className="text-[14px] text-blue-600 m-0 mb-[24px] break-all">
                <Link
                  href={verificationLink}
                  className="text-blue-600 underline"
                >
                  {verificationLink}
                </Link>
              </Text>

              <Text className="text-[14px] text-gray-600 m-0 mb-[16px]">
                This verification link will expire in 48 hours for security
                reasons.
              </Text>

              <Text className="text-[14px] text-gray-600 m-0">
                If you didn&apos;t create an account with us, you can safely
                ignore this email.
              </Text>
            </Section>

            <Section className="border-t border-gray-200 pt-[24px] mt-[40px]">
              <Text className="text-[12px] text-gray-500 text-center m-0 mb-[8px]">
                Welcome aboard!
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

EmailVerificationTemplate.PreviewProps = {
  userEmail: "ledionrestelica7@gmail.com",
  verificationLink: "https://example.com/verify-email?token=abc123xyz789",
};

export default EmailVerificationTemplate;
