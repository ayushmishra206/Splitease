"use server";

import { prisma } from "@/lib/prisma";
import { getAuthenticatedUser } from "@/lib/auth";

export async function subscribePush(subscription: {
  endpoint: string;
  p256dh: string;
  auth: string;
}) {
  const user = await getAuthenticatedUser();

  await prisma.pushSubscription.upsert({
    where: {
      userId_endpoint: { userId: user.id, endpoint: subscription.endpoint },
    },
    create: {
      userId: user.id,
      endpoint: subscription.endpoint,
      p256dh: subscription.p256dh,
      auth: subscription.auth,
    },
    update: {
      p256dh: subscription.p256dh,
      auth: subscription.auth,
    },
  });
}

export async function unsubscribePush(endpoint: string) {
  const user = await getAuthenticatedUser();

  await prisma.pushSubscription.deleteMany({
    where: { userId: user.id, endpoint },
  });
}
