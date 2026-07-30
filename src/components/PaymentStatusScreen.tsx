import React, { useEffect, useRef, useState } from 'react'
import { motion } from 'motion/react'
import { AlertCircle, Check, CheckCircle, Clock, Copy, CreditCard, Loader2, QrCode, RefreshCw, ShieldCheck, Store } from 'lucide-react'
import { supabase } from '../supabaseClient'
import { PaymentSession } from '../lib/checkoutApi'

type Props = {
  session: PaymentSession
  onPaid: (couponCode?: string | null) => void
  onRetry: () => void
  onOrders: () => void
}

function money(cents: number) {
  return (cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function normalizeStatus(value?: string | null) {
  return (value || 'waiting').toLowerCase()
}

export default function PaymentStatusScreen({ session, onPaid, onRetry, onOrders }: Props) {
  const [paymentStatus, setPaymentStatus] = useState(normalizeStatus(session.paymentStatus))
  const [orderStatus, setOrderStatus] = useState(session.orderStatus)
  const [couponCode, setCouponCode] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [checking, setChecking] = useState(false)
  const paidHandled = useRef(false)

  const applyOrder = (order: any) => {
    if (!order) return
    setPaymentStatus(normalizeStatus(order.payment_status))
    setOrderStatus(order.status || '')
    setCouponCode(order.fidelity_coupon_code || null)
  }

  const refresh = async () => {
    setChecking(true)
    const { data } = await supabase
      .from('orders')
      .select('payment_status, status, fidelity_coupon_code')
      .eq('id', session.orderId)
      .maybeSingle()
    applyOrder(data)
    setChecking(false)
  }

  useEffect(() => {
    paidHandled.current = false
    setPaymentStatus(normalizeStatus(session.paymentStatus))
    setOrderStatus(session.orderStatus)
    refresh()
    const channel = supabase
      .channel(`payment-${session.orderId}`)
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'orders',
        filter: `id=eq.${session.orderId}`,
      }, payload => applyOrder(payload.new))
      .subscribe()

    return () => { supabase.removeChannel(channel) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session.orderId])

  useEffect(() => {
    if (paymentStatus === 'paid' && !paidHandled.current) {
      paidHandled.current = true
      const timeout = window.setTimeout(() => onPaid(couponCode), 600)
      return () => window.clearTimeout(timeout)
    }
  }, [paymentStatus, couponCode, onPaid])

  const copyPix = async () => {
    if (!session.pixCopyPaste) return
    await navigator.clipboard.writeText(session.pixCopyPaste)
    setCopied(true)
    window.setTimeout(() => setCopied(false), 1800)
  }

  const failed = ['declined', 'canceled', 'cancelled', 'expired', 'failed'].includes(paymentStatus)
  const analyzing = ['in_analysis', 'in-analysis', 'authorized', 'processing'].includes(paymentStatus)

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="min-h-screen bg-brand-cream p-6 flex flex-col">
      <div className="flex items-center justify-between mt-3 mb-8">
        <div>
          <div className="text-xs uppercase tracking-[0.2em] font-bold text-brand-gold">Pedido #{session.orderCode}</div>
          <h1 className="font-display text-3xl text-brand-dark mt-1">Pagamento</h1>
        </div>
        <ShieldCheck size={30} className="text-brand-red" />
      </div>

      <div className="flex-1 flex flex-col gap-5">
        {session.method === 'PIX' && !failed && paymentStatus !== 'paid' && (
          <div className="bg-white rounded-3xl p-6 border border-brand-gold/20 shadow-sm text-center">
            <div className="w-14 h-14 bg-brand-red/10 text-brand-red rounded-2xl flex items-center justify-center mx-auto mb-4"><QrCode size={30} /></div>
            <h2 className="font-display text-2xl text-brand-dark">{session.pixQrImageUrl || session.pixCopyPaste ? 'Escaneie o PIX' : 'Aguardando pagamento PIX'}</h2>
            <p className="text-sm text-brand-dark/60 mt-2 mb-5">O pedido será liberado somente após a confirmação automática do PagBank.</p>
            {session.pixQrImageUrl ? (
              <img src={session.pixQrImageUrl} alt="QR Code PIX" className="w-64 h-64 object-contain mx-auto bg-white rounded-2xl border border-brand-gold/20 p-2" />
            ) : session.pixCopyPaste ? (
              <div className="w-full rounded-2xl bg-brand-cream flex items-center justify-center text-brand-dark/60 text-sm p-6">Use o código copia e cola abaixo.</div>
            ) : (
              <div className="w-full rounded-2xl bg-brand-cream flex items-center justify-center text-brand-dark/60 text-sm p-6">
                A cobrança já foi criada. Esta tela continuará verificando automaticamente a confirmação do pagamento.
              </div>
            )}
            {session.pixCopyPaste && (
              <button onClick={copyPix} className="w-full mt-5 bg-brand-dark text-brand-gold py-4 px-4 rounded-2xl font-bold flex items-center justify-center gap-2">
                {copied ? <Check size={18} /> : <Copy size={18} />}{copied ? 'Código copiado' : 'Copiar código PIX'}
              </button>
            )}
            {session.pixExpiresAt && <p className="text-xs text-brand-dark/45 mt-3">Válido até {new Date(session.pixExpiresAt).toLocaleString('pt-BR')}</p>}
          </div>
        )}

        {session.method === 'LOCAL' && !failed && paymentStatus !== 'paid' && (
          <div className="bg-white rounded-3xl p-8 border border-brand-gold/20 shadow-sm text-center">
            <div className="w-16 h-16 bg-brand-red/10 text-brand-red rounded-full flex items-center justify-center mx-auto mb-5"><Store size={30} /></div>
            <h2 className="font-display text-3xl text-brand-dark">Aguardando pagamento na retirada</h2>
            <p className="text-sm text-brand-dark/60 mt-3">O pedido será liberado para preparo quando o atendente confirmar o pagamento no balcão.</p>
          </div>
        )}

        {session.method === 'UNKNOWN' && !failed && paymentStatus !== 'paid' && (
          <div className="bg-white rounded-3xl p-8 border border-brand-gold/20 shadow-sm text-center">
            <div className="w-16 h-16 bg-brand-red/10 text-brand-red rounded-full flex items-center justify-center mx-auto mb-5"><Clock size={30} /></div>
            <h2 className="font-display text-3xl text-brand-dark">Aguardando confirmação</h2>
            <p className="text-sm text-brand-dark/60 mt-3">A cobrança já foi criada e o status está sendo acompanhado automaticamente.</p>
          </div>
        )}

        {session.method === 'CREDIT_CARD' && !failed && paymentStatus !== 'paid' && (
          <div className="bg-white rounded-3xl p-8 border border-brand-gold/20 shadow-sm text-center">
            <div className="w-16 h-16 bg-brand-red/10 text-brand-red rounded-full flex items-center justify-center mx-auto mb-5"><CreditCard size={30} /></div>
            <h2 className="font-display text-3xl text-brand-dark">{analyzing ? 'Pagamento em análise' : 'Confirmando pagamento'}</h2>
            <p className="text-sm text-brand-dark/60 mt-3">A confirmação definitiva vem do webhook autenticado do PagBank. Não feche o pedido como pago manualmente.</p>
          </div>
        )}

        {!failed && paymentStatus !== 'paid' && (
          <div className="bg-brand-dark text-brand-cream rounded-3xl p-6 shadow-xl">
            <div className="flex items-center gap-3">
              {analyzing ? <Clock size={24} className="text-brand-gold" /> : <Loader2 size={24} className="text-brand-gold animate-spin" />}
              <div>
                <div className="font-bold">
                  {session.method === 'LOCAL'
                    ? 'Aguardando confirmação do atendente'
                    : analyzing
                      ? 'Aguardando análise do PagBank'
                      : 'Aguardando confirmação'}
                </div>
                <div className="text-xs text-brand-cream/55 mt-1">Total: {money(session.totalCents)} • status interno: {orderStatus}</div>
              </div>
            </div>
          </div>
        )}

        {failed && (
          <div className="bg-white rounded-3xl p-8 border border-red-200 shadow-sm text-center">
            <div className="w-16 h-16 bg-red-50 text-red-600 rounded-full flex items-center justify-center mx-auto mb-5"><AlertCircle size={31} /></div>
            <h2 className="font-display text-3xl text-brand-dark">Pagamento não concluído</h2>
            <p className="text-sm text-brand-dark/60 mt-3">Nenhum benefício foi concedido. Você pode tentar novamente com PIX ou outro cartão.</p>
            <button onClick={onRetry} className="w-full mt-6 bg-brand-red text-white py-4 rounded-2xl font-bold">Tentar novamente</button>
          </div>
        )}

        {paymentStatus === 'paid' && (
          <div className="bg-white rounded-3xl p-8 border border-green-200 shadow-sm text-center">
            <CheckCircle size={68} className="text-green-600 mx-auto mb-5" />
            <h2 className="font-display text-3xl text-brand-dark">Pagamento confirmado</h2>
          </div>
        )}
      </div>

      {!failed && paymentStatus !== 'paid' && (
        <div className="mt-6 grid grid-cols-2 gap-3">
          <button onClick={refresh} disabled={checking} className="bg-white border border-brand-gold/30 text-brand-dark py-4 rounded-2xl font-bold flex items-center justify-center gap-2 disabled:opacity-50">
            <RefreshCw size={17} className={checking ? 'animate-spin' : ''} /> Atualizar
          </button>
          <button onClick={onOrders} className="bg-brand-dark text-brand-gold py-4 rounded-2xl font-bold">Ver pedidos</button>
        </div>
      )}
    </motion.div>
  )
}
