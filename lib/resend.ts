import { Resend } from "resend";

let client: Resend | null = null;

/**
 * Lazily construct the Resend client. Constructing it at import time throws
 * when RESEND_API_KEY is unset, which broke builds and local development
 * without email configured. Callers already no-op when the key is missing.
 */
export function getResend(): Resend | null {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return null;
  if (!client) client = new Resend(apiKey);
  return client;
}
