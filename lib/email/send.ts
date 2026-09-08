import { getResend } from "@/lib/resend";

const FROM = process.env.EMAIL_FROM ?? "SplitEase <hello@ayushmishra.com>";

export async function sendEmail(to: string, subject: string, html: string) {
  const resend = getResend();
  if (!resend) return;

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
