import Stripe from 'stripe';

const getEnv = (key: string): string => {
  const value = process.env[key];
  if (!value) throw new Error(`${key} is not configured`);
  return value;
};

export type StripeEnv = 'sandbox' | 'live';

const GATEWAY_STRIPE_BASE = 'https://connector-gateway.lovable.dev/stripe';

export function getConnectionApiKey(env: StripeEnv): string {
  return env === 'sandbox'
    ? getEnv('STRIPE_SANDBOX_API_KEY')
    : getEnv('STRIPE_LIVE_API_KEY');
}

export function createStripeClient(env: StripeEnv): Stripe {
  const connectionApiKey = getConnectionApiKey(env);
  const lovableApiKey = getEnv('LOVABLE_API_KEY');

  return new Stripe(connectionApiKey, {
    apiVersion: '2026-03-25.dahlia',
    httpClient: Stripe.createFetchHttpClient((input, init) => {
      const stripeUrl = input instanceof Request ? input.url : input.toString();
      const gatewayUrl = stripeUrl.replace('https://api.stripe.com', GATEWAY_STRIPE_BASE);
      return fetch(gatewayUrl, {
        ...init,
        headers: {
          ...Object.fromEntries(
            new Headers(init?.headers ?? (input instanceof Request ? input.headers : undefined)).entries(),
          ),
          'X-Connection-Api-Key': connectionApiKey,
          'Lovable-API-Key': lovableApiKey,
        },
      });
    }),
  });
}

export function getStripeErrorMessage(error: unknown): string {
  if (error && typeof error === 'object') {
    const stripeError = error as {
      message?: string;
      type?: string;
      code?: string;
      decline_code?: string;
      param?: string;
      requestId?: string;
      raw?: {
        message?: string;
        type?: string;
        code?: string;
        decline_code?: string;
        param?: string;
        requestId?: string;
      };
    };

    const message = stripeError.raw?.message ?? stripeError.message;
    if (message) {
      const details = [
        stripeError.raw?.type ?? stripeError.type,
        stripeError.raw?.code ?? stripeError.code,
        stripeError.raw?.decline_code ?? stripeError.decline_code,
        stripeError.raw?.param ?? stripeError.param,
        stripeError.raw?.requestId ?? stripeError.requestId,
      ].filter(Boolean);
      return details.length ? `${message} (${details.join(', ')})` : message;
    }
  }

  return 'Stripe request failed';
}

export class WebhookVerificationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'WebhookVerificationError';
  }
}

const MAX_WEBHOOK_BODY_BYTES = 1_000_000;
const TIMESTAMP_TOLERANCE_SECONDS = 300;

function timingSafeEqualHex(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export async function verifyWebhook(
  req: Request,
  env: StripeEnv,
): Promise<{ id?: string; type: string; data: { object: any } }> {
  if (req.method !== 'POST') throw new WebhookVerificationError('Invalid method');

  const signature = req.headers.get('stripe-signature');
  if (!signature) throw new WebhookVerificationError('Missing stripe-signature header');

  const body = await req.text();
  if (!body) throw new WebhookVerificationError('Missing body');
  if (body.length > MAX_WEBHOOK_BODY_BYTES) throw new WebhookVerificationError('Body too large');

  const secret =
    env === 'sandbox'
      ? getEnv('PAYMENTS_SANDBOX_WEBHOOK_SECRET')
      : getEnv('PAYMENTS_LIVE_WEBHOOK_SECRET');

  let timestamp: string | undefined;
  const v1Signatures: string[] = [];
  for (const part of signature.split(',')) {
    const idx = part.indexOf('=');
    if (idx === -1) continue;
    const key = part.slice(0, idx).trim();
    const value = part.slice(idx + 1).trim();
    if (!value) continue;
    if (key === 't') timestamp = value;
    // Multiple v1 values can be present during secret rotation.
    if (key === 'v1' && /^[0-9a-f]+$/i.test(value)) v1Signatures.push(value.toLowerCase());
  }

  if (!timestamp || !/^\d+$/.test(timestamp)) {
    throw new WebhookVerificationError('Invalid signature format: missing timestamp');
  }
  if (v1Signatures.length === 0) {
    throw new WebhookVerificationError('Invalid signature format: no v1 signature');
  }

  const nowSeconds = Date.now() / 1000;
  const age = nowSeconds - Number(timestamp);
  if (age > TIMESTAMP_TOLERANCE_SECONDS) {
    throw new WebhookVerificationError('Webhook timestamp too old');
  }
  if (age < -TIMESTAMP_TOLERANCE_SECONDS) {
    throw new WebhookVerificationError('Webhook timestamp in the future');
  }

  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const signed = await crypto.subtle.sign(
    'HMAC',
    key,
    new TextEncoder().encode(`${timestamp}.${body}`),
  );
  const expected = Buffer.from(new Uint8Array(signed)).toString('hex');

  const matches = v1Signatures.some((candidate) => timingSafeEqualHex(candidate, expected));
  if (!matches) throw new WebhookVerificationError('Invalid webhook signature');

  let event: { id?: string; type?: unknown; data?: { object?: unknown } };
  try {
    event = JSON.parse(body);
  } catch {
    throw new WebhookVerificationError('Malformed JSON payload');
  }

  if (typeof event?.type !== 'string' || typeof event?.data?.object !== 'object' || !event.data.object) {
    throw new WebhookVerificationError('Malformed event payload');
  }

  return event as { id?: string; type: string; data: { object: any } };
}
