import React, { useEffect, useMemo, useRef, useState } from 'react'
import { motion } from 'motion/react'
import { supabase } from '../supabaseClient'
import {
  AlertCircle,
  ArrowLeft,
  CreditCard,
  Loader2,
  LockKeyhole,
  QrCode,
  ShieldCheck,
  Store,
} from 'lucide-react'
import {
  CheckoutApiError,
  CheckoutCartItem,
  CheckoutCustomer,
  CheckoutQuote,
  PaymentMethod,
  PaymentSession,
  createPayment,
  createPaymentRequestId,
  encryptPagBankCard,
  formatCardNumber,
  formatCpf,
  formatPhone,
  isValidCpf,
  isValidPhone,
  isPagBankCardConfigured,
  onlyDigits,
  requestCheckoutQuote,
} from '../lib/checkoutApi'

const pageVariants = {
  initial: { opacity: 0, scale: 0.98 },
  animate: { opacity: 1, scale: 1 },
  exit: { opacity: 0, scale: 1.02 },
}

type CartItem = {
  item: { id: number | string }
  quantity: number
  weightOption?: { id: string } | null
}

type Props = {
  user: any
  location: string
  cart: CartItem[]
  existingOrderId?: string | null
  fallbackTotal: number
  fallbackDeliveryFee?: number
  onBack: () => void
  onCreated: (session: PaymentSession) => void
}

function mapCart(cart: CartItem[]): CheckoutCartItem[] {
  return cart.map(item => ({
    menu_item_id: String(item.item.id),
    quantity: item.quantity,
    weight_option_id: item.weightOption?.id ?? null,
  }))
}

function getInitialCustomer(user: any): CheckoutCustomer {
  const metadata = user?.user_metadata ?? {}
  return {
    name: metadata.full_name || '',
    email: user?.email || '',
    tax_id: metadata.tax_id || metadata.cpf || '',
    phone: metadata.phone || '',
  }
}

function money(cents: number) {
  return (cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

export default function PagBankCheckoutScreen({
  user,
  location,
  cart,
  existingOrderId,
  fallbackTotal,
  fallbackDeliveryFee = 0,
  onBack,
  onCreated,
}: Props) {
  const isDelivery = location !== '' && location !== 'Retirada no Balcão'
  const items = useMemo(() => mapCart(cart), [cart])
  const paymentRequestId = useRef(createPaymentRequestId())
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('PIX')
  const [customer, setCustomer] = useState<CheckoutCustomer>(() => getInitialCustomer(user))
  const [couponCode, setCouponCode] = useState('')
  const [appliedCouponCode, setAppliedCouponCode] = useState<string | null>(null)
  const [quote, setQuote] = useState<CheckoutQuote | null>(null)
  const [quoteLoading, setQuoteLoading] = useState(true)
  const [couponLoading, setCouponLoading] = useState(false)
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [card, setCard] = useState({
    holderName: getInitialCustomer(user).name,
    holderTaxId: getInitialCustomer(user).tax_id,
    number: '',
    expMonth: '',
    expYear: '',
    securityCode: '',
    installments: 1,
  })

  useEffect(() => {
    let active = true

    const loadProfile = async () => {
      if (!user?.id) return
      const { data } = await supabase
        .from('profiles')
        .select('full_name, tax_id, phone')
        .eq('id', user.id)
        .maybeSingle()

      if (!active || !data) return
      setCustomer(current => ({
        name: data.full_name || current.name,
        email: current.email,
        tax_id: data.tax_id || current.tax_id,
        phone: data.phone || current.phone,
      }))
      setCard(current => ({
        ...current,
        holderName: data.full_name || current.holderName,
        holderTaxId: data.tax_id || current.holderTaxId,
      }))
    }

    loadProfile()
    return () => { active = false }
  }, [user?.id])

  useEffect(() => {
    if (isDelivery && paymentMethod === 'LOCAL') setPaymentMethod('PIX')
    if (!isPagBankCardConfigured && paymentMethod === 'CREDIT_CARD') setPaymentMethod('PIX')
  }, [isDelivery, paymentMethod])

  const loadQuote = async (coupon: string | null, couponAction = false) => {
    setError('')
    couponAction ? setCouponLoading(true) : setQuoteLoading(true)
    try {
      const response = await requestCheckoutQuote({
        existing_order_id: existingOrderId ?? null,
        location,
        items,
        coupon_code: coupon,
      })
      setQuote(response)
      setAppliedCouponCode(response.coupon?.code ?? null)
      if (coupon && !response.coupon) {
        setError('Cupom inválido, expirado ou indisponível.')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível calcular o pedido.')
      if (coupon) setAppliedCouponCode(null)
    } finally {
      setQuoteLoading(false)
      setCouponLoading(false)
    }
  }

  useEffect(() => {
    loadQuote(null)
    // O carrinho e o pedido existente são imutáveis durante esta tela.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [existingOrderId, location])

  const validateCustomer = () => {
    if (customer.name.trim().split(/\s+/).length < 2) return 'Informe seu nome completo.'
    if (!customer.email.trim() || !customer.email.includes('@')) return 'Informe um e-mail válido.'
    if (!isValidCpf(customer.tax_id)) return 'Informe um CPF válido.'
    if (!isValidPhone(customer.phone)) return 'Informe um celular com DDD.'
    return null
  }

  const handleSubmit = async () => {
    if (submitting || !quote) return
    setError('')

    const customerError = validateCustomer()
    if (customerError) {
      setError(customerError)
      return
    }

    if (paymentMethod === 'CREDIT_CARD') {
      if (card.holderName.trim().split(/\s+/).length < 2) return setError('Informe o nome completo do portador.')
      if (!isValidCpf(card.holderTaxId)) return setError('Informe um CPF válido para o portador.')
      if (onlyDigits(card.number).length < 13) return setError('Informe um número de cartão válido.')
      if (!/^(0[1-9]|1[0-2])$/.test(onlyDigits(card.expMonth).padStart(2, '0'))) return setError('Informe um mês de validade válido.')
      if (onlyDigits(card.expYear).length !== 4) return setError('Informe o ano da validade com quatro dígitos.')
      if (onlyDigits(card.securityCode).length < 3) return setError('Informe o código de segurança.')
    }

    setSubmitting(true)
    try {
      let encrypted: string | undefined
      if (paymentMethod === 'CREDIT_CARD') {
        encrypted = encryptPagBankCard({
          holder: card.holderName,
          number: card.number,
          expMonth: card.expMonth,
          expYear: card.expYear,
          securityCode: card.securityCode,
        })
      }

      const session = await createPayment({
        request_id: paymentRequestId.current,
        existing_order_id: existingOrderId ?? null,
        location,
        items,
        coupon_code: appliedCouponCode,
        payment_method: paymentMethod,
        customer: {
          name: customer.name.trim(),
          email: customer.email.trim().toLowerCase(),
          tax_id: onlyDigits(customer.tax_id),
          phone: onlyDigits(customer.phone),
        },
        card: encrypted ? {
          encrypted,
          holder_name: card.holderName.trim(),
          holder_tax_id: onlyDigits(card.holderTaxId),
          installments: card.installments,
        } : undefined,
      })

      setCard(prev => ({ ...prev, number: '', securityCode: '' }))
      onCreated(session)
    } catch (err) {
      setCard(prev => ({ ...prev, securityCode: '' }))
      if (err instanceof CheckoutApiError && !err.retrySameRequest) {
        paymentRequestId.current = createPaymentRequestId()
      }
      setError(err instanceof Error ? err.message : 'Não foi possível criar o pagamento.')
    } finally {
      setSubmitting(false)
    }
  }

  const subtotalCents = quote?.subtotal_cents ?? Math.round(fallbackTotal * 100)
  const deliveryFeeCents = quote?.delivery_fee_cents ?? Math.round(fallbackDeliveryFee * 100)
  const discountCents = quote?.discount_cents ?? 0
  const totalCents = quote?.total_cents ?? Math.max(subtotalCents + deliveryFeeCents - discountCents, 0)

  return (
    <motion.div
      key="checkout-pagbank"
      variants={pageVariants}
      initial={{ opacity: 0, x: 100 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 100 }}
      className="min-h-screen bg-brand-cream pb-40 flex flex-col"
    >
      <div className="sticky top-0 z-40 bg-brand-cream/90 backdrop-blur-md px-6 py-4 flex items-center justify-between shadow-sm">
        <button onClick={onBack} disabled={submitting} className="p-2 -ml-2 rounded-full hover:bg-brand-gold/20 transition disabled:opacity-40">
          <ArrowLeft size={28} className="text-brand-dark" />
        </button>
        <h2 className="font-display text-2xl absolute left-1/2 -translate-x-1/2">Pagamento</h2>
        <ShieldCheck size={22} className="text-brand-gold" />
      </div>

      <div className="p-6 flex-1 flex flex-col gap-6">
        <div className="bg-white border border-brand-gold/20 rounded-2xl p-5 shadow-sm">
          <div className="flex items-center gap-2 mb-4">
            <LockKeyhole size={18} className="text-brand-red" />
            <h3 className="font-bold text-brand-dark">Dados do comprador</h3>
          </div>
          <div className="space-y-3">
            <input value={customer.name} onChange={e => setCustomer({ ...customer, name: e.target.value })} placeholder="Nome completo" autoComplete="name" className="checkout-input" />
            <input value={customer.email} onChange={e => setCustomer({ ...customer, email: e.target.value })} placeholder="E-mail" type="email" autoComplete="email" className="checkout-input" />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <input value={customer.tax_id} onChange={e => setCustomer({ ...customer, tax_id: formatCpf(e.target.value) })} placeholder="CPF" inputMode="numeric" autoComplete="off" className="checkout-input" />
              <input value={customer.phone} onChange={e => setCustomer({ ...customer, phone: formatPhone(e.target.value) })} placeholder="Celular com DDD" inputMode="tel" autoComplete="tel" className="checkout-input" />
            </div>
          </div>
        </div>

        <div>
          <h3 className="text-xl font-bold text-brand-dark mb-2">Escolha a forma de pagamento</h3>
          <p className="text-sm text-brand-dark/65 mb-5">
            {isDelivery ? 'Para entrega na churrasqueira, pague agora com PIX ou cartão.' : 'Pague agora ou escolha pagar no balcão.'}
          </p>

          <div className="space-y-3">
            <PaymentOption selected={paymentMethod === 'PIX'} onClick={() => setPaymentMethod('PIX')} icon={<QrCode size={22} />} title="PIX" subtitle="QR Code e copia e cola" />
            <PaymentOption
              selected={paymentMethod === 'CREDIT_CARD'}
              onClick={() => setPaymentMethod('CREDIT_CARD')}
              icon={<CreditCard size={22} />}
              title="Cartão de crédito"
              subtitle={isPagBankCardConfigured ? 'Dados criptografados pelo PagBank' : 'Disponível após cadastrar a chave pública PagBank'}
              disabled={!isPagBankCardConfigured}
            />
            {!isDelivery && (
              <PaymentOption selected={paymentMethod === 'LOCAL'} onClick={() => setPaymentMethod('LOCAL')} icon={<Store size={22} />} title="Pagar na retirada" subtitle="Pagamento confirmado pelo atendente" />
            )}
          </div>
        </div>

        {paymentMethod === 'CREDIT_CARD' && (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="bg-white border border-brand-gold/20 rounded-2xl p-5 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-brand-dark">Dados do cartão</h3>
              <span className="text-[10px] font-bold uppercase tracking-wider text-green-700 bg-green-50 px-2 py-1 rounded-full">Criptografia direta</span>
            </div>
            <div className="space-y-3">
              <input value={card.holderName} onChange={e => setCard({ ...card, holderName: e.target.value })} placeholder="Nome impresso no cartão" autoComplete="cc-name" className="checkout-input" />
              <input value={card.holderTaxId} onChange={e => setCard({ ...card, holderTaxId: formatCpf(e.target.value) })} placeholder="CPF do portador" inputMode="numeric" autoComplete="off" className="checkout-input" />
              <input value={card.number} onChange={e => setCard({ ...card, number: formatCardNumber(e.target.value) })} placeholder="Número do cartão" inputMode="numeric" autoComplete="cc-number" className="checkout-input tracking-wider" />
              <div className="grid grid-cols-3 gap-3">
                <input value={card.expMonth} onChange={e => setCard({ ...card, expMonth: onlyDigits(e.target.value).slice(0, 2) })} placeholder="Mês" inputMode="numeric" autoComplete="cc-exp-month" className="checkout-input text-center" />
                <input value={card.expYear} onChange={e => setCard({ ...card, expYear: onlyDigits(e.target.value).slice(0, 4) })} placeholder="Ano" inputMode="numeric" autoComplete="cc-exp-year" className="checkout-input text-center" />
                <input value={card.securityCode} onChange={e => setCard({ ...card, securityCode: onlyDigits(e.target.value).slice(0, 4) })} placeholder="CVV" type="password" inputMode="numeric" autoComplete="cc-csc" className="checkout-input text-center" />
              </div>
              <div className="checkout-input flex items-center justify-between bg-brand-cream/40">
                <span className="text-brand-dark/60">Parcelamento</span>
                <strong>1x de {money(totalCents)}</strong>
              </div>
              <p className="text-[11px] text-brand-dark/50 leading-relaxed">Nesta versão, o cartão é cobrado à vista. O número e o CVV são criptografados no seu dispositivo e não são gravados no aplicativo, n8n ou Supabase.</p>
            </div>
          </motion.div>
        )}

        <div className="bg-white border border-brand-gold/20 rounded-2xl p-5">
          <div className="text-xs font-bold text-brand-dark/50 uppercase tracking-wider mb-3">Cupom</div>
          {appliedCouponCode ? (
            <div className="flex items-center justify-between bg-green-50 border border-green-200 rounded-xl p-3">
              <div>
                <div className="font-bold text-green-700 text-sm">{appliedCouponCode}</div>
                <div className="text-xs text-green-600 mt-0.5">Validado pelo servidor</div>
              </div>
              <button onClick={() => { setCouponCode(''); loadQuote(null, true) }} disabled={couponLoading} className="text-red-500 text-xs font-bold">Remover</button>
            </div>
          ) : (
            <div className="flex gap-2">
              <input value={couponCode} onChange={e => setCouponCode(e.target.value.toUpperCase())} placeholder="CÓDIGO DO CUPOM" className="checkout-input flex-1 uppercase tracking-widest" />
              <button onClick={() => loadQuote(couponCode.trim().toUpperCase() || null, true)} disabled={!couponCode.trim() || couponLoading} className="px-4 py-2.5 bg-brand-dark text-brand-gold rounded-xl text-sm font-bold disabled:opacity-40">
                {couponLoading ? <Loader2 size={16} className="animate-spin" /> : 'Aplicar'}
              </button>
            </div>
          )}
        </div>

        <div className="bg-brand-dark text-brand-cream p-6 rounded-3xl shadow-xl">
          <div className="text-brand-gold text-xs font-bold uppercase tracking-widest mb-3">Resumo calculado pelo servidor</div>
          {quoteLoading ? (
            <div className="flex items-center gap-2 text-brand-cream/70 py-3"><Loader2 size={17} className="animate-spin" /> Calculando valores...</div>
          ) : (
            <>
              <SummaryLine label="Subtotal" value={money(subtotalCents)} />
              {deliveryFeeCents > 0 && <SummaryLine label="Taxa para levar até sua brasa" value={money(deliveryFeeCents)} />}
              {discountCents > 0 && <SummaryLine label="Desconto" value={`- ${money(discountCents)}`} success />}
              {quote?.coupon?.type === 'free_item' && <SummaryLine label="Item grátis" value={quote.coupon.free_item_description || 'Benefício aplicado'} success />}
              <div className="flex justify-between items-center text-2xl font-display pt-3 border-t border-white/10 mt-2">
                <span>Total</span>
                <span className="text-brand-red">{money(totalCents)}</span>
              </div>
            </>
          )}
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 rounded-2xl p-4 flex items-start gap-3 text-sm">
            <AlertCircle size={18} className="shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}
      </div>

      <div className="fixed bottom-0 left-0 right-0 p-6 bg-gradient-to-t from-brand-cream via-brand-cream to-transparent z-50">
        <div className="max-w-md mx-auto">
          <button onClick={handleSubmit} disabled={submitting || quoteLoading || !quote} className="w-full bg-brand-red text-white p-5 rounded-2xl flex items-center justify-center gap-3 font-bold text-lg shadow-2xl hover:bg-red-700 transition disabled:opacity-50 disabled:cursor-not-allowed font-display tracking-widest uppercase">
            {submitting ? <><Loader2 size={21} className="animate-spin" /> Processando com segurança</> : paymentMethod === 'PIX' ? 'Gerar PIX' : paymentMethod === 'CREDIT_CARD' ? 'Pagar com Cartão' : 'Confirmar Pedido'}
          </button>
        </div>
      </div>
    </motion.div>
  )
}

function PaymentOption({ selected, onClick, icon, title, subtitle, disabled = false }: { selected: boolean; onClick: () => void; icon: React.ReactNode; title: string; subtitle: string; disabled?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-disabled={disabled}
      className={`w-full flex items-center gap-4 p-5 rounded-2xl border-2 transition-all duration-300 ${disabled ? 'border-brand-gold/10 bg-brand-dark/[0.03] opacity-60 cursor-not-allowed' : selected ? 'border-brand-red bg-white shadow-lg' : 'border-brand-gold/20 bg-transparent hover:bg-white/50'}`}
    >
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${selected && !disabled ? 'bg-brand-red text-white' : 'bg-brand-dark/5 text-brand-dark/60'}`}>{icon}</div>
      <div className="flex-1 text-left">
        <div className="font-bold text-brand-dark">{title}</div>
        <div className="text-xs text-brand-dark/55 mt-1">{subtitle}</div>
      </div>
      <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center ${selected && !disabled ? 'border-brand-red' : 'border-brand-gold'}`}>
        {selected && !disabled && <div className="w-3 h-3 bg-brand-red rounded-full" />}
      </div>
    </button>
  )
}

function SummaryLine({ label, value, success = false }: { label: string; value: string; success?: boolean }) {
  return (
    <div className={`flex justify-between items-center mb-2 text-sm ${success ? 'text-green-400' : 'text-brand-cream/60'}`}>
      <span>{label}</span><span className="text-right ml-4">{value}</span>
    </div>
  )
}
