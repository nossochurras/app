import type { PaymentMethod, PaymentSession } from './checkoutApi'

type OrderLike = Record<string, any>

const STORAGE_PREFIX = 'nosso-churras:payment-session:'

function firstNonEmptyString(...values: unknown[]) {
  for (const value of values) {
    if (typeof value === 'string' && value.trim()) return value.trim()
  }
  return null
}

function normalizedValue(value: unknown) {
  return typeof value === 'string'
    ? value.trim().toUpperCase().replace(/[\s-]+/g, '_')
    : ''
}

export function getOrderPaymentMethod(order: OrderLike): PaymentSession['method'] | null {
  const rawMethod = normalizedValue(order.payment_method)
  const rawType = normalizedValue(order.payment_type)
  const value = rawMethod || rawType

  if (value === 'PIX') return 'PIX'
  if (['CREDIT_CARD', 'CREDITCARD', 'CARD', 'CARTAO', 'CARTÃO'].includes(value)) return 'CREDIT_CARD'
  if (['LOCAL', 'PAGAR_NO_LOCAL', 'PAGAMENTO_LOCAL'].includes(value)) return 'LOCAL'

  const hasPixPayload = Boolean(firstNonEmptyString(
    order.pix_copy_paste,
    order.pix_qr_code,
    order.pix_code,
    order.pix_qr_image_url,
    order.pix_qr_code_image,
  ))

  if (hasPixPayload) return 'PIX'
  return null
}

function hasProviderPaymentReference(order: OrderLike) {
  return Boolean(firstNonEmptyString(
    order.pagbank_order_id,
    order.pagbank_charge_id,
    order.payment_provider_id,
    order.payment_request_id,
    order.charge_id,
  ))
}

function toTotalCents(order: OrderLike) {
  const explicitCents = Number(order.total_cents)
  if (Number.isFinite(explicitCents) && explicitCents >= 0) return Math.round(explicitCents)

  const total = Number(order.total)
  return Number.isFinite(total) && total >= 0 ? Math.round(total * 100) : 0
}

/**
 * Retorna uma sessão somente quando há evidência de que o cliente já escolheu
 * um meio de pagamento ou que o provedor já criou uma cobrança.
 *
 * Um pedido apenas pesado também pode estar em `awaiting_payment`; nesse caso
 * não há método/referência e esta função retorna null para abrir o checkout.
 */
export function buildPaymentSessionFromOrder(order: OrderLike): PaymentSession | null {
  const recognizedMethod = getOrderPaymentMethod(order)
  const providerReferenceExists = hasProviderPaymentReference(order)

  if (!recognizedMethod && !providerReferenceExists) return null

  return {
    orderId: String(order.id),
    orderCode: String(order.order_code ?? ''),
    method: recognizedMethod ?? 'UNKNOWN',
    paymentStatus: firstNonEmptyString(order.payment_status) ?? 'waiting',
    orderStatus: firstNonEmptyString(order.status) ?? 'awaiting_payment',
    totalCents: toTotalCents(order),
    pixCopyPaste: firstNonEmptyString(
      order.pix_copy_paste,
      order.pix_qr_code,
      order.pix_code,
    ),
    pixQrImageUrl: firstNonEmptyString(
      order.pix_qr_image_url,
      order.pix_qr_code_image,
      order.qr_code_image_url,
    ),
    pixExpiresAt: firstNonEmptyString(
      order.pix_expires_at,
      order.pix_expiration_date,
      order.payment_expires_at,
    ),
    message: firstNonEmptyString(order.payment_error_message, order.payment_message),
  }
}

export function storePaymentSession(session: PaymentSession) {
  try {
    window.localStorage.setItem(`${STORAGE_PREFIX}${session.orderId}`, JSON.stringify(session))
  } catch {
    // O app continua funcionando mesmo se o navegador bloquear localStorage.
  }
}

export function readStoredPaymentSession(orderId: string): PaymentSession | null {
  try {
    const raw = window.localStorage.getItem(`${STORAGE_PREFIX}${orderId}`)
    if (!raw) return null

    const parsed = JSON.parse(raw) as Partial<PaymentSession>
    if (
      parsed.orderId !== orderId ||
      typeof parsed.orderCode !== 'string' ||
      typeof parsed.method !== 'string' ||
      typeof parsed.totalCents !== 'number'
    ) {
      return null
    }

    return {
      orderId: parsed.orderId,
      orderCode: parsed.orderCode,
      method: parsed.method as PaymentMethod | 'UNKNOWN',
      paymentStatus: parsed.paymentStatus || 'waiting',
      orderStatus: parsed.orderStatus || 'awaiting_payment',
      totalCents: parsed.totalCents,
      pixCopyPaste: parsed.pixCopyPaste ?? null,
      pixQrImageUrl: parsed.pixQrImageUrl ?? null,
      pixExpiresAt: parsed.pixExpiresAt ?? null,
      message: parsed.message ?? null,
    }
  } catch {
    return null
  }
}

export function removeStoredPaymentSession(orderId: string) {
  try {
    window.localStorage.removeItem(`${STORAGE_PREFIX}${orderId}`)
  } catch {
    // Sem impacto no fluxo principal.
  }
}
