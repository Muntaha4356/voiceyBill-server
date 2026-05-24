import { Env } from "../config/env.config";
import { resend } from "../config/resend.config";

type Params = {
  to: string | string[];
  subject: string;
  text: string;
  html: string;
  from: string;
};

export const sendEmail = async ({
  to,
  from,
  subject,
  text,
  html,
}: Params) => {
  // If in development mode and Resend key is placeholder/missing, mock email delivery
  if (
    Env.NODE_ENV === "development" &&
    (!Env.RESEND_API_KEY || Env.RESEND_API_KEY === "your_resend_api_key_here")
  ) {
    console.log("-----------------------------------------");
    console.log("📨 [MOCK EMAIL SENT] (Development Mode)");
    console.log(`From:    ${from}`);
    console.log(`To:      ${to}`);
    console.log(`Subject: ${subject}`);
    console.log(`Text:    ${text}`);
    console.log("-----------------------------------------");
    return { id: "mock-email-id-" + Date.now() };
  }

  const { data, error } = await resend.emails.send({
    from,
    to: Array.isArray(to) ? to : [to],
    text,
    subject,
    html,
  });

  if (error) {
    console.error("Resend error:", error);
    throw new Error(error.message);
  }

  console.log("Email sent successfully, id:", data?.id);
  return data;
};
