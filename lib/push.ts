import webPush from "web-push";
import { prisma } from "@/lib/prisma";

let vapidConfigured = false;

function ensureVapid() {
  if (vapidConfigured) return;
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  if (!publicKey || !privateKey) {
    console.warn("Push: VAPID keys not configured — notifications disabled");
    return;
  }
  webPush.setVapidDetails(
    `mailto:${process.env.EMAIL_FROM?.match(/<(.+)>/)?.[1] ?? `noreply@${new URL(process.env.NEXT_PUBLIC_APP_URL!).hostname}`}`,
    publicKey,
    privateKey
  );
  vapidConfigured = true;
}

/**
 * Send push notifications to all group members except the excluded user.
 * Fetches subscriptions from DB and fires notifications in parallel (fire-and-forget).
 */
export async function notifyGroupMembers(
  excludeUserId: string,
  memberIds: string[],
  payload: { title: string; body: string; url?: string }
) {
  const recipientIds = memberIds.filter((id) => id !== excludeUserId);
  if (recipientIds.length === 0) return;
  const subs = await prisma.pushSubscription.findMany({
    where: { userId: { in: recipientIds } },
  });
  for (const sub of subs) {
    void sendPushNotification(sub, payload);
  }
}

export async function sendPushNotification(
  subscription: { id?: string; endpoint: string; p256dh: string; auth: string },
  payload: { title: string; body: string; url?: string }
) {
  try {
    ensureVapid();
    if (!vapidConfigured) return;
    await webPush.sendNotification(
      {
        endpoint: subscription.endpoint,
        keys: { p256dh: subscription.p256dh, auth: subscription.auth },
      },
      JSON.stringify(payload)
    );
  } catch (error: unknown) {
    const statusCode = (error as { statusCode?: number }).statusCode;
    // 404 or 410 = subscription expired/invalid — remove from DB
    if (statusCode === 404 || statusCode === 410) {
      console.warn("Push: subscription expired, removing:", subscription.endpoint.substring(0, 60));
      await prisma.pushSubscription
        .deleteMany({ where: { endpoint: subscription.endpoint } })
        .catch(() => {});
    } else {
      console.error("Push: failed to send notification:", error);
    }
  }
}
