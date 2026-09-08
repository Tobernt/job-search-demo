import Stripe from "stripe";
import { NextRequest, NextResponse } from "next/server";
import { getProductBySku } from "@/lib/monetization";
import {
  recordMonetizationEvent,
  updatePaidOrderByPaymentIntent,
  updatePaidOrderBySubscription,
  upsertPaidOrder,
  type PaidOrderStatus
} from "@/lib/monetization-store";

export const dynamic = "force-dynamic";

const stripeSecretKey = process.env.STRIPE_SECRET_KEY ?? "";
const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET ?? "";
const stripeWebhookEnabled = process.env.STRIPE_WEBHOOK_ENABLED === "true";
const stripe = stripeWebhookEnabled && stripeSecretKey
  ? new Stripe(stripeSecretKey, { apiVersion: "2026-05-27.dahlia" })
  : undefined;

export async function POST(request: NextRequest) {
  if (!stripeWebhookEnabled) {
    return NextResponse.json({ ok: false, error: "Stripe webhook is disabled." }, { status: 503 });
  }

  if (!stripe || !webhookSecret) {
    return NextResponse.json({ ok: false, error: "Stripe webhook is not configured." }, { status: 503 });
  }

  const signature = request.headers.get("stripe-signature");
  if (!signature) {
    return NextResponse.json({ ok: false, error: "Missing Stripe signature." }, { status: 400 });
  }

  const rawBody = await request.text();
  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid Stripe signature." }, { status: 400 });
  }

  await handleStripeEvent(event);
  return NextResponse.json({ ok: true });
}

async function handleStripeEvent(event: Stripe.Event) {
  switch (event.type) {
    case "checkout.session.completed":
    case "checkout.session.async_payment_succeeded":
      await upsertPaidOrderFromSession(event.data.object as Stripe.Checkout.Session, "paid_pending_review");
      break;
    case "checkout.session.async_payment_failed":
      await upsertPaidOrderFromSession(event.data.object as Stripe.Checkout.Session, "failed");
      break;
    case "customer.subscription.updated":
      await updateOrderFromSubscription(event.data.object as Stripe.Subscription);
      break;
    case "customer.subscription.deleted":
      await updatePaidOrderBySubscription((event.data.object as Stripe.Subscription).id, "canceled");
      break;
    case "charge.refunded":
      await updateOrderFromRefund(event.data.object as Stripe.Charge);
      break;
    default:
      await recordMonetizationEvent({
        eventType: "stripe_event_ignored",
        entityType: "stripe_event",
        entityId: event.id,
        source: "stripe",
        metadata: { type: event.type }
      });
  }
}

async function upsertPaidOrderFromSession(session: Stripe.Checkout.Session, status: PaidOrderStatus) {
  const paymentLinkId = idValue(session.payment_link);
  const sku = metadataText(session.metadata, "sku")
    || metadataText(session.metadata, "product_sku")
    || productSkuFromPaymentLink(paymentLinkId)
    || "unknown";
  const product = getProductBySku(sku);
  const subscriptionId = idValue(session.subscription);
  const paymentIntentId = idValue(session.payment_intent);
  const sessionStatus = session.payment_status === "paid" ? status : "pending";

  await upsertPaidOrder({
    id: session.id,
    productSku: sku,
    productType: product?.productType ?? "unknown",
    billingMode: product?.billingMode ?? "unknown",
    amountTotal: session.amount_total ?? undefined,
    currency: session.currency ?? "sek",
    status: sessionStatus,
    stripeCheckoutSessionId: session.id,
    stripePaymentIntentId: paymentIntentId,
    stripeSubscriptionId: subscriptionId,
    stripePaymentLinkId: paymentLinkId
  });

  await recordMonetizationEvent({
    eventType: "stripe_checkout_status",
    entityType: "paid_order",
    entityId: session.id,
    source: "stripe",
    metadata: {
      sku,
      status: sessionStatus,
      mode: session.mode,
      paymentStatus: session.payment_status
    }
  });
}

async function updateOrderFromSubscription(subscription: Stripe.Subscription) {
  const status: PaidOrderStatus = subscription.status === "active" || subscription.status === "trialing"
    ? "active"
    : subscription.status === "canceled" || subscription.status === "unpaid"
      ? "canceled"
      : "pending";
  const currentPeriodEnd = unixSecondsToIso((subscription as unknown as { current_period_end?: number }).current_period_end);
  await updatePaidOrderBySubscription(subscription.id, status, currentPeriodEnd);
  await recordMonetizationEvent({
    eventType: "stripe_subscription_status",
    entityType: "paid_order",
    entityId: subscription.id,
    source: "stripe",
    metadata: { status: subscription.status }
  });
}

async function updateOrderFromRefund(charge: Stripe.Charge) {
  const paymentIntentId = idValue(charge.payment_intent);
  if (paymentIntentId) await updatePaidOrderByPaymentIntent(paymentIntentId, "refunded");
  await recordMonetizationEvent({
    eventType: "stripe_refund_seen",
    entityType: "paid_order",
    entityId: paymentIntentId || charge.id,
    source: "stripe",
    metadata: { refunded: charge.refunded }
  });
}

function metadataText(metadata: Stripe.Metadata | null, key: string) {
  const value = metadata?.[key];
  return typeof value === "string" ? value.trim() : "";
}

function idValue(value: string | { id?: string } | null) {
  if (!value) return undefined;
  if (typeof value === "string") return value;
  return value.id;
}

function productSkuFromPaymentLink(paymentLinkId?: string) {
  if (!paymentLinkId) return "";
  return {
    [process.env.STRIPE_PAYMENT_LINK_ID_JOB_POST_QUALITY ?? ""]: "job-post-quality",
    [process.env.STRIPE_PAYMENT_LINK_ID_EMPLOYER_REPORT ?? ""]: "employer-report",
    [process.env.STRIPE_PAYMENT_LINK_ID_VERIFIED_PROFILE_MONTHLY ?? ""]: "verified-profile-monthly",
    [process.env.STRIPE_PAYMENT_LINK_ID_CATEGORY_SPONSOR_MONTHLY ?? ""]: "category-sponsor-monthly"
  }[paymentLinkId] ?? "";
}

function unixSecondsToIso(value?: number) {
  return typeof value === "number" && Number.isFinite(value)
    ? new Date(value * 1000).toISOString()
    : undefined;
}
