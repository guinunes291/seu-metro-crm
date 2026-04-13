/**
 * Módulo de Push Notifications
 * Gerencia subscriptions e envio de notificações push via Web Push API
 */

import webpush from 'web-push';
import { pushSubscriptions } from '../drizzle/schema';
import { eq } from 'drizzle-orm';
import { getDb } from './db';

// Usa o singleton compartilhado de conexão (evita criar um pool separado)

// Configurar VAPID keys (geradas uma única vez)
// Para gerar novas keys: npx web-push generate-vapid-keys
const VAPID_PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY || 'BEl62iUYgUivxIkv-69N6T5w2vYvQJLJ-oEcXywHNcF7z7RqPwUh7hUVBngN7c7A6ArVYhM0qvW1aE8aEcXR_Z8';
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY || 'UUxI4O8TWxwfqR6LZRqYoPKnH00bdSwKV4EqTJaluA0';

webpush.setVapidDetails(
  'mailto:contato@seumetroquadrado.com.br',
  VAPID_PUBLIC_KEY,
  VAPID_PRIVATE_KEY
);

/**
 * Salvar subscription do usuário
 */
export async function saveSubscription(
  userId: number,
  subscription: PushSubscriptionJSON,
  userAgent?: string
) {
  if (!subscription.endpoint || !subscription.keys) {
    throw new Error('Subscription inválida');
  }

  const db = await getDb();
  if (!db) throw new Error('Database não disponível');

  // Verificar se já existe uma subscription para este endpoint
  const existing = await db
    .select()
    .from(pushSubscriptions)
    .where(eq(pushSubscriptions.endpoint, subscription.endpoint))
    .limit(1);

  if (existing.length > 0) {
    // Atualizar lastUsedAt
    await db
      .update(pushSubscriptions)
      .set({ lastUsedAt: new Date() })
      .where(eq(pushSubscriptions.id, existing[0].id));
    return existing[0];
  }

  // Criar nova subscription
  const [newSubscription] = await db.insert(pushSubscriptions).values({
    userId,
    endpoint: subscription.endpoint,
    p256dh: subscription.keys.p256dh,
    auth: subscription.keys.auth,
    userAgent,
  });

  return newSubscription;
}

/**
 * Remover subscription do usuário
 */
export async function removeSubscription(endpoint: string) {
  const db = await getDb();
  if (!db) return;
  await db
    .delete(pushSubscriptions)
    .where(eq(pushSubscriptions.endpoint, endpoint));
}

/**
 * Enviar notificação push para um usuário específico
 */
export async function sendPushNotification(
  userId: number,
  payload: {
    title: string;
    body: string;
    icon?: string;
    badge?: string;
    url?: string;
    tag?: string;
    requireInteraction?: boolean;
    actions?: Array<{ action: string; title: string }>;
  }
) {
  const db = await getDb();
  if (!db) return { sent: 0, failed: 0 };

  // Buscar todas as subscriptions do usuário
  const subscriptions = await db
    .select()
    .from(pushSubscriptions)
    .where(eq(pushSubscriptions.userId, userId));

  if (subscriptions.length === 0) {
    console.log(`[Push] Nenhuma subscription encontrada para userId ${userId}`);
    return { sent: 0, failed: 0 };
  }

  const results = await Promise.allSettled(
    subscriptions.map(async (sub) => {
      try {
        const pushSubscription: PushSubscription = {
          endpoint: sub.endpoint,
          keys: {
            p256dh: sub.p256dh,
            auth: sub.auth,
          },
        } as any;

        await webpush.sendNotification(
          pushSubscription,
          JSON.stringify(payload)
        );

        // Atualizar lastUsedAt
        const dbInner = await getDb();
        if (dbInner) {
          await dbInner
            .update(pushSubscriptions)
            .set({ lastUsedAt: new Date() })
            .where(eq(pushSubscriptions.id, sub.id));
        }

        return { success: true };
      } catch (error: any) {
        console.error(`[Push] Erro ao enviar para ${sub.endpoint}:`, error.message);

        // Se a subscription expirou ou é inválida, remover
        if (error.statusCode === 410 || error.statusCode === 404) {
          await removeSubscription(sub.endpoint);
        }

        return { success: false, error };
      }
    })
  );

  const sent = results.filter((r) => r.status === 'fulfilled' && r.value.success).length;
  const failed = results.length - sent;

  console.log(`[Push] Enviado ${sent}/${results.length} notificações para userId ${userId}`);

  return { sent, failed };
}

/**
 * Enviar notificação push para múltiplos usuários
 */
export async function sendPushNotificationToMultiple(
  userIds: number[],
  payload: {
    title: string;
    body: string;
    icon?: string;
    badge?: string;
    url?: string;
    tag?: string;
    requireInteraction?: boolean;
    actions?: Array<{ action: string; title: string }>;
  }
) {
  const results = await Promise.all(
    userIds.map((userId) => sendPushNotification(userId, payload))
  );

  const totalSent = results.reduce((sum, r) => sum + r.sent, 0);
  const totalFailed = results.reduce((sum, r) => sum + r.failed, 0);

  return { sent: totalSent, failed: totalFailed };
}

/**
 * Obter VAPID public key (para o frontend)
 */
export function getVapidPublicKey() {
  return VAPID_PUBLIC_KEY;
}
