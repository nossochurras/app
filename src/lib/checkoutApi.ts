import { supabase } from '../supabaseClient'

export type PaymentMethod = 'PIX' | 'CREDIT_CARD' | 'LOCAL'

export type CheckoutCartItem = {
  menu_item_id: string
  quantity: number
  weight_option_id?: string | null
}

export type CheckoutCustomer = {
  name: string
  email: string
  tax_id: string
  phone: string
}

export type CheckoutQuote = {
  ok: true
  subtotal_cents: number
  delivery_fee_cents: number
  discount_cents: number
  total_cents: number
  coupon?: {
    id: string
    code: string
    type: 'fixed' | 'percent' | 'free_item'
    discount_value: number
    free_item_description?: string | null
  } | null
}

export type PaymentSession = {
  orderId: string
  orderCode: string
  method: PaymentMethod
  paymentStatus: string
  orderStatus: string
  totalCents: number
  pixCopyPaste?: string | null
  pixQrImageUrl?: string | null
  pixExpiresAt?: string | null
  message?: string | null
}

type ApiErrorPayload = {
  message?: string
  error?: string
  details?: string
  code?: string
}

export class CheckoutApiError extends Error {
  retrySameRequest: boolean

  constructor(message: string, retrySameRequest: boolean) {
    super(message)
    this.name = 'CheckoutApiError'
    this.retrySameRequest = retrySameRequest
  }
}

const env = import.meta.env as Record<string, string | undefined>

// Endpoints públicos padrão do projeto. As variáveis VITE_ continuam podendo
// sobrescrever estes valores em outros ambientes, mas o checkout não deixa de
// funcionar quando um arquivo .env específico não é carregado pelo Vite.
const DEFAULT_N8N_BASE_URL = 'https://n8nwebhook.solviaoficial.com'

const QUOTE_URL =
  env.VITE_N8N_CHECKOUT_QUOTE_URL?.trim() ||
  `${DEFAULT_N8N_BASE_URL}/webhook/pagbank/checkout-quote`
const CREATE_ORDER_URL =
  env.VITE_N8N_CREATE_ORDER_URL?.trim() ||
  `${DEFAULT_N8N_BASE_URL}/webhook/pagbank/create-weighing-order`
const CREATE_PAYMENT_URL =
  env.VITE_N8N_CREATE_PAYMENT_URL?.trim() ||
  `${DEFAULT_N8N_BASE_URL}/webhook/pagbank/create-payment`
const PAGBANK_PUBLIC_KEY = env.VITE_PAGBANK_PUBLIC_KEY?.trim()

export const isPagBankCardConfigured = Boolean(PAGBANK_PUBLIC_KEY)

function requireUrl(url: string | undefined, variable: string) {
  if (!url) {
    throw new Error(`Configuração ausente: defina ${variable} no arquivo .env.`)
  }
  return url
}

async function getAccessToken() {
  const { data, error } = await supabase.auth.getSession()
  if (error || !data.session?.access_token) {
    throw new Error('Sua sessão expirou. Entre novamente para continuar.')
  }
  return data.session.access_token
}

async function postJson<T>(url: string, payload: unknown): Promise<T> {
  const accessToken = await getAccessToken()
  let response: Response

  try {
    response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
        'X-App-Client': 'praca-nosso-churras-client/2.1.0',
      },
      body: JSON.stringify(payload),
    })
  } catch {
    throw new CheckoutApiError('Não foi possível conectar ao servidor de pagamento. Verifique sua internet e tente novamente.', true)
  }

  const text = await response.text()
  let body: (T & ApiErrorPayload) | ApiErrorPayload = {}
  if (text) {
    try {
      body = JSON.parse(text)
    } catch {
      body = { message: text }
    }
  }

  if (!response.ok) {
    const message = body.message || body.error || body.details || `Erro HTTP ${response.status}`
    throw new CheckoutApiError(message, response.status >= 500)
  }

  return body as T
}

export function onlyDigits(value: string) {
  return value.replace(/\D/g, '')
}

export function isValidCpf(value: string) {
  const cpf = onlyDigits(value)
  if (cpf.length !== 11 || /^(\d)\1{10}$/.test(cpf)) return false

  const calculateDigit = (length: number) => {
    let sum = 0
    for (let i = 0; i < length; i += 1) {
      sum += Number(cpf[i]) * (length + 1 - i)
    }
    const remainder = (sum * 10) % 11
    return remainder === 10 ? 0 : remainder
  }

  return calculateDigit(9) === Number(cpf[9]) && calculateDigit(10) === Number(cpf[10])
}

export function isValidPhone(value: string) {
  const phone = onlyDigits(value)
  return phone.length === 10 || phone.length === 11
}

export function formatCpf(value: string) {
  const digits = onlyDigits(value).slice(0, 11)
  return digits
    .replace(/^(\d{3})(\d)/, '$1.$2')
    .replace(/^(\d{3})\.(\d{3})(\d)/, '$1.$2.$3')
    .replace(/\.(\d{3})(\d)/, '.$1-$2')
}

export function formatPhone(value: string) {
  const digits = onlyDigits(value).slice(0, 11)
  if (digits.length <= 10) {
    return digits
      .replace(/^(\d{2})(\d)/, '($1) $2')
      .replace(/(\d{4})(\d)/, '$1-$2')
  }
  return digits
    .replace(/^(\d{2})(\d)/, '($1) $2')
    .replace(/(\d{5})(\d)/, '$1-$2')
}

export function formatCardNumber(value: string) {
  return onlyDigits(value).slice(0, 19).replace(/(.{4})/g, '$1 ').trim()
}

export async function requestCheckoutQuote(input: {
  existing_order_id?: string | null
  location: string
  items: CheckoutCartItem[]
  coupon_code?: string | null
}): Promise<CheckoutQuote> {
  return postJson<CheckoutQuote>(
    requireUrl(QUOTE_URL, 'VITE_N8N_CHECKOUT_QUOTE_URL'),
    input,
  )
}

export async function createWeighingOrder(input: {
  location: string
  items: CheckoutCartItem[]
}): Promise<{ ok: true; order_id: string; order_code: string }> {
  return postJson(
    requireUrl(CREATE_ORDER_URL, 'VITE_N8N_CREATE_ORDER_URL'),
    { ...input, kind: 'WEIGHING' },
  )
}

export function createPaymentRequestId() {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, character => {
        const random = Math.floor(Math.random() * 16)
        const value = character === 'x' ? random : (random & 0x3) | 0x8
        return value.toString(16)
      })
}

export async function createPayment(input: {
  request_id: string
  existing_order_id?: string | null
  location: string
  items: CheckoutCartItem[]
  coupon_code?: string | null
  payment_method: PaymentMethod
  customer: CheckoutCustomer
  card?: {
    encrypted: string
    holder_name: string
    holder_tax_id: string
    installments: number
  }
}): Promise<PaymentSession> {
  const response = await postJson<any>(
    requireUrl(CREATE_PAYMENT_URL, 'VITE_N8N_CREATE_PAYMENT_URL'),
    input,
  )

  if (!response?.ok || !response.order_id || !response.order_code) {
    throw new Error(response?.message || 'O servidor retornou uma resposta de pagamento inválida.')
  }

  return {
    orderId: response.order_id,
    orderCode: response.order_code,
    method: response.payment_method || input.payment_method,
    paymentStatus: response.payment_status || 'waiting',
    orderStatus: response.order_status || 'awaiting_payment',
    totalCents: Number(response.total_cents || 0),
    pixCopyPaste: response.pix_copy_paste ?? null,
    pixQrImageUrl: response.pix_qr_image_url ?? null,
    pixExpiresAt: response.pix_expires_at ?? null,
    message: response.message ?? null,
  }
}

export function encryptPagBankCard(input: {
  holder: string
  number: string
  expMonth: string
  expYear: string
  securityCode: string
}) {
  if (!PAGBANK_PUBLIC_KEY) {
    throw new Error('Pagamento por cartão ainda não foi habilitado. Use PIX ou pagamento na retirada.')
  }

  if (!window.PagSeguro?.encryptCard) {
    throw new Error('O componente seguro do PagBank não carregou. Atualize a página e tente novamente.')
  }

  const result = window.PagSeguro.encryptCard({
    publicKey: PAGBANK_PUBLIC_KEY,
    holder: input.holder.trim(),
    number: onlyDigits(input.number),
    expMonth: onlyDigits(input.expMonth).padStart(2, '0'),
    expYear: onlyDigits(input.expYear),
    securityCode: onlyDigits(input.securityCode),
  })

  if (result.hasErrors || !result.encryptedCard) {
    const message = result.errors?.map(error => error.message).filter(Boolean).join(' ') || 'Confira os dados do cartão.'
    throw new Error(message)
  }

  return result.encryptedCard
}
