import { resend } from "@/lib/resend";

const FROM = "SplitEase <onboarding@resend.dev>";

export function sendEmail(to: string, subject: string, html: string) {
  if (!process.env.RESEND_API_KEY) return;

  resend.emails
    .send({ from: FROM, to, subject, html })
    .catch((err) => {
      console.error("Email send failed:", err);
    });
}
