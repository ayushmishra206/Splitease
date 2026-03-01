import { resend } from "@/lib/resend";

const FROM = process.env.EMAIL_FROM ?? "SplitEase <onboarding@resend.dev>";

export async function sendEmail(to: string, subject: string, html: string) {
  if (!process.env.RESEND_API_KEY) return;

  const { error } = await resend.emails.send({ from: FROM, to, subject, html });
  if (error) {
    console.error("Email send failed:", error);
    throw new Error(error.message);
  }
}

/** Fire-and-forget variant — logs errors but never throws. */
export function sendEmailSafe(to: string, subject: string, html: string) {
  void sendEmail(to, subject, html).catch(() => {});
}
