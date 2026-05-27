import { supabase } from './supabaseClient'
import React, { useState, useEffect, useRef, useCallback } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import {
  LayoutDashboard, ShoppingBag, UtensilsCrossed, Ticket, BarChart2,
  LogOut, Bell, CheckCircle, Clock, Flame, ChevronRight, X,
  Plus, Minus, Edit2, Trash2, Upload, Save, Toggle, Scale,
  Camera, AlertCircle, TrendingUp, Users, DollarSign, Package,
  ArrowLeft, Eye, RefreshCw, Search, Filter, ChevronDown,
  Beef, Beer, Sandwich, ToggleLeft, ToggleRight, Image, Weight
} from 'lucide-react'

// ─── TYPES ───────────────────────────────────────────────────

type Profile = { id: string; full_name: string; role: string }

type WeightOption = {
  id?: string
  menu_item_id?: string
  label: string
  max_grams: number
  price: number
  sort_order: number
}

type MenuItem = {
  id: string
  name: string
  category: 'Carnes' | 'Acompanhamentos' | 'Bebidas'
  description: string
  price: number
  image_url: string
  available: boolean
  weight_mode: boolean
  sort_order: number
  weight_options?: WeightOption[]
}

type OrderItem = {
  id: string
  name: string
  quantity: number
  unit_price: number
  final_price: number | null
  chosen_label: string | null
  chosen_max_grams: number | null
  real_grams: number | null
  scale_photo_url: string | null
  weight_option_id: string | null
}

type Order = {
  id: string
  order_code: string
  location: string
  status: string
  payment_type: string
  payment_status: string
  total: number
  created_at: string
  user_id: string
  items: any[]
  order_items?: OrderItem[]
  profiles?: { full_name: string }
}

// ─── STATUS CONFIG ────────────────────────────────────────────

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; next: string | null }> = {
  pending:           { label: 'Recebido',         color: '#f59e0b', bg: '#fef3c7', next: 'preparing' },
  awaiting_weighing: { label: 'Aguard. Pesagem',  color: '#8b5cf6', bg: '#ede9fe', next: 'weighing_done' },
  weighing_done:     { label: 'Pesagem OK',       color: '#06b6d4', bg: '#cffafe', next: 'preparing' },
  preparing:         { label: 'Preparando',       color: '#3b82f6', bg: '#dbeafe', next: 'ready' },
  ready:             { label: 'Pronto',           color: '#10b981', bg: '#d1fae5', next: 'delivered' },
  delivered:         { label: 'Entregue',         color: '#6b7280', bg: '#f3f4f6', next: null },
  cancelled:         { label: 'Cancelado',        color: '#ef4444', bg: '#fee2e2', next: null },
}

// ─── SOUND ───────────────────────────────────────────────────

function playNotificationSound() {
  try {
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)()
    const times = [0, 0.15, 0.3]
    times.forEach(t => {
      const o = ctx.createOscillator()
      const g = ctx.createGain()
      o.connect(g); g.connect(ctx.destination)
      o.frequency.value = 880
      o.type = 'sine'
      g.gain.setValueAtTime(0, ctx.currentTime + t)
      g.gain.linearRampToValueAtTime(0.3, ctx.currentTime + t + 0.05)
      g.gain.linearRampToValueAtTime(0, ctx.currentTime + t + 0.15)
      o.start(ctx.currentTime + t)
      o.stop(ctx.currentTime + t + 0.2)
    })
    if (navigator.vibrate) navigator.vibrate([100, 50, 100, 50, 200])
  } catch (e) {}
}

// ─── MAIN ADMIN PANEL ────────────────────────────────────────

export default function AdminPanel() {
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'dashboard' | 'orders' | 'menu' | 'coupons' | 'reports'>('dashboard')
  const [newOrderCount, setNewOrderCount] = useState(0)

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) { window.location.href = '/'; return }
      const { data } = await supabase.from('profiles').select('*').eq('id', user.id).single()
      if (!data || data.role !== 'admin') { window.location.href = '/'; return }
      setProfile(data)
      setLoading(false)
    })
  }, [])

  // Realtime: novo pedido
  useEffect(() => {
    const channel = supabase
      .channel('admin-orders')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'orders' }, () => {
        setNewOrderCount(c => c + 1)
        playNotificationSound()
      })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [])

  if (loading) return (
    <div className="min-h-screen bg-[#0f0f0f] flex items-center justify-center">
      <div className="flex flex-col items-center gap-4">
        <Flame size={48} className="text-[#e85d26] animate-pulse" />
        <p className="text-white/50 text-sm font-mono">carregando painel...</p>
      </div>
    </div>
  )

  return (
    <div className="min-h-screen bg-[#0f0f0f] text-white flex" style={{ fontFamily: "'DM Sans', sans-serif" }}>
      <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600;700&family=DM+Mono:wght@400;500&display=swap" rel="stylesheet" />

      {/* SIDEBAR */}
      <aside className="w-64 bg-[#161616] border-r border-white/5 flex flex-col shrink-0 sticky top-0 h-screen">
        {/* Logo */}
        <div className="p-6 border-b border-white/5">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-[#e85d26] rounded-xl flex items-center justify-center">
              <Flame size={18} className="text-white" />
            </div>
            <div>
              <div className="font-semibold text-sm leading-none">Praça Admin</div>
              <div className="text-[11px] text-white/30 mt-0.5">Painel de Controle</div>
            </div>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 p-3 space-y-1">
          {[
            { id: 'dashboard', icon: LayoutDashboard, label: 'Dashboard' },
            { id: 'orders',    icon: ShoppingBag,     label: 'Pedidos', badge: newOrderCount > 0 ? newOrderCount : null },
            { id: 'menu',      icon: UtensilsCrossed, label: 'Cardápio' },
            { id: 'coupons',   icon: Ticket,          label: 'Cupons' },
            { id: 'reports',   icon: BarChart2,       label: 'Relatórios' },
          ].map(item => {
            const Icon = item.icon
            const active = activeTab === item.id
            return (
              <button
                key={item.id}
                onClick={() => { setActiveTab(item.id as any); if (item.id === 'orders') setNewOrderCount(0) }}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
                  active ? 'bg-[#e85d26] text-white' : 'text-white/40 hover:text-white hover:bg-white/5'
                }`}
              >
                <Icon size={18} />
                <span className="flex-1 text-left">{item.label}</span>
                {item.badge && (
                  <span className="bg-white text-[#e85d26] text-[10px] font-bold w-5 h-5 rounded-full flex items-center justify-center">
                    {item.badge}
                  </span>
                )}
              </button>
            )
          })}
        </nav>

        {/* User */}
        <div className="p-4 border-t border-white/5">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-8 h-8 bg-[#e85d26]/20 rounded-full flex items-center justify-center text-xs font-bold text-[#e85d26]">
              {profile?.full_name?.[0]?.toUpperCase() ?? 'A'}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-xs font-medium truncate">{profile?.full_name ?? 'Admin'}</div>
              <div className="text-[10px] text-white/30">Administrador</div>
            </div>
          </div>
          <button
            onClick={() => supabase.auth.signOut().then(() => window.location.href = '/')}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs text-white/30 hover:text-red-400 hover:bg-red-400/5 transition"
          >
            <LogOut size={14} /> Sair
          </button>
        </div>
      </aside>

      {/* MAIN */}
      <main className="flex-1 overflow-y-auto">
        <AnimatePresence mode="wait">
          {activeTab === 'dashboard' && <DashboardTab key="dashboard" onNavigate={setActiveTab} />}
          {activeTab === 'orders'    && <OrdersTab    key="orders" />}
          {activeTab === 'menu'      && <MenuTab      key="menu" />}
          {activeTab === 'coupons'   && <CouponsTab   key="coupons" />}
          {activeTab === 'reports'   && <ReportsTab   key="reports" />}
        </AnimatePresence>
      </main>
    </div>
  )
}

// ─── PAGE WRAPPER ─────────────────────────────────────────────

function Page({ title, subtitle, children, action }: any) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.2 }}
      className="p-8"
    >
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-semibold">{title}</h1>
          {subtitle && <p className="text-white/40 text-sm mt-1">{subtitle}</p>}
        </div>
        {action}
      </div>
      {children}
    </motion.div>
  )
}

// ─── STAT CARD ────────────────────────────────────────────────

function StatCard({ icon: Icon, label, value, sub, color = '#e85d26' }: any) {
  return (
    <div className="bg-[#161616] border border-white/5 rounded-2xl p-5">
      <div className="flex items-start justify-between mb-4">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: color + '20' }}>
          <Icon size={20} style={{ color }} />
        </div>
      </div>
      <div className="text-2xl font-semibold mb-1">{value}</div>
      <div className="text-xs text-white/40">{label}</div>
      {sub && <div className="text-xs text-white/25 mt-0.5">{sub}</div>}
    </div>
  )
}

// ─── DASHBOARD TAB ────────────────────────────────────────────

function DashboardTab({ onNavigate }: { onNavigate: (tab: any) => void }) {
  const [stats, setStats] = useState({ orders: 0, revenue: 0, pending: 0, customers: 0 })
  const [recentOrders, setRecentOrders] = useState<Order[]>([])

  useEffect(() => {
    const today = new Date(); today.setHours(0,0,0,0)
    Promise.all([
      supabase.from('orders').select('total, status, user_id').gte('created_at', today.toISOString()),
      supabase.from('orders').select('*').order('created_at', { ascending: false }).limit(5),
    ]).then(([{ data: todayOrders }, { data: recent }]) => {
      const orders = todayOrders ?? []
      setStats({
        orders: orders.length,
        revenue: orders.reduce((s, o) => s + Number(o.total), 0),
        pending: orders.filter(o => ['pending','awaiting_weighing','preparing'].includes(o.status)).length,
        customers: new Set(orders.map(o => o.user_id)).size,
      })
      setRecentOrders(recent ?? [])
    })
  }, [])

  return (
    <Page title="Dashboard" subtitle={`Hoje, ${new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })}`}>
      <div className="grid grid-cols-4 gap-4 mb-8">
        <StatCard icon={ShoppingBag}  label="Pedidos hoje"     value={stats.orders}                                      color="#e85d26" />
        <StatCard icon={DollarSign}   label="Faturamento hoje" value={`R$ ${stats.revenue.toFixed(2).replace('.',',')}`} color="#10b981" />
        <StatCard icon={Clock}        label="Em andamento"     value={stats.pending}                                     color="#f59e0b" />
        <StatCard icon={Users}        label="Clientes hoje"    value={stats.customers}                                   color="#8b5cf6" />
      </div>

      <div className="bg-[#161616] border border-white/5 rounded-2xl overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/5">
          <h2 className="font-medium text-sm">Pedidos Recentes</h2>
          <button onClick={() => onNavigate('orders')} className="text-[#e85d26] text-xs font-medium hover:underline flex items-center gap-1">
            Ver todos <ChevronRight size={14} />
          </button>
        </div>
        <div className="divide-y divide-white/5">
          {recentOrders.length === 0 && (
            <div className="py-12 text-center text-white/25 text-sm">Nenhum pedido ainda hoje</div>
          )}
          {recentOrders.map(order => {
            const cfg = STATUS_CONFIG[order.status] ?? STATUS_CONFIG.pending
            return (
              <div key={order.id} className="flex items-center gap-4 px-6 py-4">
                <div className="font-mono text-sm text-white/50">#{order.order_code}</div>
                <div className="flex-1">
                  <div className="text-sm font-medium">{order.location}</div>
                  <div className="text-xs text-white/30">
                    {new Date(order.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                  </div>
                </div>
                <div className="text-sm font-medium">R$ {Number(order.total).toFixed(2).replace('.',',')}</div>
                <div className="text-xs font-medium px-2.5 py-1 rounded-full" style={{ color: cfg.color, background: cfg.bg + '33' }}>
                  {cfg.label}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </Page>
  )
}

// ─── ORDERS TAB ───────────────────────────────────────────────

function OrdersTab() {
  const [orders, setOrders] = useState<Order[]>([])
  const [selected, setSelected] = useState<Order | null>(null)
  const [filterStatus, setFilterStatus] = useState('all')
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)

  const fetchOrders = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase
      .from('orders')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(100)
    setOrders(data ?? [])
    setLoading(false)
  }, [])

  useEffect(() => { fetchOrders() }, [fetchOrders])

  // Realtime
  useEffect(() => {
    const channel = supabase
      .channel('orders-list')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, fetchOrders)
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [fetchOrders])

  const filtered = orders.filter(o => {
    const matchStatus = filterStatus === 'all' || o.status === filterStatus
    const matchSearch = !search || o.order_code.includes(search) || o.location.toLowerCase().includes(search.toLowerCase())
    return matchStatus && matchSearch
  })

  const advanceStatus = async (order: Order) => {
    const next = STATUS_CONFIG[order.status]?.next
    if (!next) return
    await supabase.from('orders').update({ status: next }).eq('id', order.id)
    fetchOrders()
    if (selected?.id === order.id) setSelected({ ...order, status: next })
  }

  return (
    <Page title="Pedidos" subtitle="Gerencie e acompanhe todos os pedidos em tempo real"
      action={
        <button onClick={fetchOrders} className="flex items-center gap-2 px-4 py-2 bg-white/5 rounded-xl text-sm hover:bg-white/10 transition">
          <RefreshCw size={14} /> Atualizar
        </button>
      }
    >
      {/* Filters */}
      <div className="flex gap-3 mb-6 flex-wrap">
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Buscar pedido..."
            className="bg-[#161616] border border-white/10 rounded-xl pl-9 pr-4 py-2 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-[#e85d26]/50 w-48"
          />
        </div>
        <div className="flex gap-2 flex-wrap">
          {[['all','Todos'], ...Object.entries(STATUS_CONFIG).map(([k,v]) => [k, v.label])].map(([key, label]) => (
            <button
              key={key}
              onClick={() => setFilterStatus(key)}
              className={`px-3 py-2 rounded-xl text-xs font-medium transition ${
                filterStatus === key ? 'bg-[#e85d26] text-white' : 'bg-[#161616] text-white/40 border border-white/5 hover:text-white'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-5 gap-6">
        {/* List */}
        <div className="col-span-3 space-y-2">
          {loading && <div className="text-center py-12 text-white/30 text-sm">Carregando...</div>}
          {!loading && filtered.length === 0 && <div className="text-center py-12 text-white/30 text-sm">Nenhum pedido encontrado</div>}
          {filtered.map(order => {
            const cfg = STATUS_CONFIG[order.status] ?? STATUS_CONFIG.pending
            const isSelected = selected?.id === order.id
            // Check if has weight items in JSONB items array
            const hasWeightItems = Array.isArray(order.items) && order.items.some((i: any) => i.weight_option_id || i.chosen_label)
            return (
              <motion.div
                key={order.id}
                layout
                onClick={() => setSelected(isSelected ? null : order)}
                className={`bg-[#161616] border rounded-2xl p-4 cursor-pointer transition-all ${
                  isSelected ? 'border-[#e85d26]/50 bg-[#e85d26]/5' : 'border-white/5 hover:border-white/10'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className="font-mono text-sm text-white/50 w-16">#{order.order_code}</div>
                  <div className="flex-1">
                    <div className="text-sm font-medium flex items-center gap-2">
                      {order.location}
                      {hasWeightItems && <Scale size={12} className="text-purple-400" />}
                    </div>
                    <div className="text-xs text-white/30 mt-0.5">
                      {new Date(order.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })} •{' '}
                      {order.payment_type === 'app' ? 'App' : 'Local'}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-semibold">R$ {Number(order.total).toFixed(2).replace('.',',')}</div>
                    <div className="text-[10px] font-medium px-2 py-0.5 rounded-full mt-1 inline-block" style={{ color: cfg.color, background: cfg.bg + '33' }}>
                      {cfg.label}
                    </div>
                  </div>
                </div>
              </motion.div>
            )
          })}
        </div>

        {/* Detail Panel */}
        <div className="col-span-2">
          <AnimatePresence>
            {selected ? (
              <OrderDetail key={selected.id} order={selected} onAdvance={advanceStatus} onClose={() => setSelected(null)} onRefresh={fetchOrders} />
            ) : (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="bg-[#161616] border border-white/5 rounded-2xl h-64 flex flex-col items-center justify-center text-white/20 text-sm gap-3"
              >
                <Eye size={32} className="opacity-30" />
                Selecione um pedido para ver detalhes
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </Page>
  )
}

// ─── ORDER DETAIL ─────────────────────────────────────────────

function OrderDetail({ order, onAdvance, onClose, onRefresh }: { order: Order; onAdvance: (o: Order) => void; onClose: () => void; onRefresh: () => void }) {
  const cfg = STATUS_CONFIG[order.status] ?? STATUS_CONFIG.pending
  const nextCfg = cfg.next ? STATUS_CONFIG[cfg.next] : null
  const [weighingItem, setWeighingItem] = useState<any | null>(null)

  // items may come from JSONB column
  const items: any[] = Array.isArray(order.items) ? order.items : []
  const hasWeightItems = items.some(i => i.weight_mode || i.chosen_label)

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 20 }}
      className="bg-[#161616] border border-white/5 rounded-2xl overflow-hidden sticky top-8"
    >
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-white/5">
        <div>
          <div className="font-mono text-sm text-white/50">#{order.order_code}</div>
          <div className="font-medium">{order.location}</div>
        </div>
        <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-white/5 text-white/30 hover:text-white transition">
          <X size={16} />
        </button>
      </div>

      {/* Status */}
      <div className="px-5 py-4 border-b border-white/5">
        <div className="flex items-center gap-2 mb-3">
          <div className="w-2 h-2 rounded-full" style={{ background: cfg.color }}></div>
          <span className="text-sm font-medium" style={{ color: cfg.color }}>{cfg.label}</span>
        </div>
        {nextCfg && (
          <button
            onClick={() => onAdvance(order)}
            className="w-full py-2.5 rounded-xl text-sm font-medium transition"
            style={{ background: cfg.color + '20', color: cfg.color, border: `1px solid ${cfg.color}40` }}
          >
            Avançar → {nextCfg.label}
          </button>
        )}
      </div>

      {/* Items */}
      <div className="px-5 py-4 border-b border-white/5 space-y-3 max-h-56 overflow-y-auto">
        {items.map((item: any, i: number) => (
          <div key={i} className="flex items-start justify-between gap-2">
            <div className="flex-1">
              <div className="text-sm font-medium">{item.name}</div>
              {item.chosen_label && (
                <div className="text-xs text-purple-400 mt-0.5 flex items-center gap-1">
                  <Scale size={10} /> {item.chosen_label}
                  {item.real_grams && <span className="text-green-400 ml-1">→ {item.real_grams}g</span>}
                </div>
              )}
              <div className="text-xs text-white/30">x{item.quantity}</div>
            </div>
            <div className="text-sm font-medium">
              R$ {(Number(item.final_price ?? item.price) * item.quantity).toFixed(2).replace('.',',')}
            </div>
          </div>
        ))}
      </div>

      {/* Weighing section */}
      {hasWeightItems && order.status === 'awaiting_weighing' && (
        <div className="px-5 py-4 border-b border-white/5">
          <div className="text-xs font-semibold text-purple-400 uppercase tracking-wider mb-3 flex items-center gap-2">
            <Scale size={12} /> Pesagem Pendente
          </div>
          {items.filter(i => i.chosen_label).map((item: any, idx: number) => (
            <WeighingForm key={idx} orderId={order.id} item={item} onDone={onRefresh} />
          ))}
        </div>
      )}

      {/* Total */}
      <div className="px-5 py-4 flex items-center justify-between">
        <span className="text-sm text-white/50">Total</span>
        <span className="font-semibold text-lg">R$ {Number(order.total).toFixed(2).replace('.',',')}</span>
      </div>
    </motion.div>
  )
}

// ─── WEIGHING FORM ────────────────────────────────────────────

function WeighingForm({ orderId, item, onDone }: { orderId: string; item: any; onDone: () => void }) {
  const [realGrams, setRealGrams] = useState('')
  const [photo, setPhoto] = useState<File | null>(null)
  const [photoPreview, setPhotoPreview] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  const maxGrams = item.chosen_max_grams ?? item.max_grams ?? 1000
  const unitPrice = item.unit_price ?? item.price ?? 0

  const calcFinal = () => {
    const g = parseInt(realGrams)
    if (!g || g >= maxGrams) return unitPrice
    return Math.round((unitPrice / maxGrams) * g * 100) / 100
  }

  const discount = unitPrice - calcFinal()

  const handlePhoto = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    if (!f) return
    setPhoto(f)
    setPhotoPreview(URL.createObjectURL(f))
  }

  const handleSave = async () => {
    if (!realGrams) return
    setSaving(true)
    let photoUrl: string | null = null
  
    if (photo) {
      const ext = photo.name.split('.').pop()
      const path = `balanca/${orderId}_${Date.now()}.${ext}`
      const { data: uploadData } = await supabase.storage
        .from('churras-media')
        .upload(path, photo, { upsert: true })
      if (uploadData) {
        const { data: urlData } = supabase.storage
          .from('churras-media')
          .getPublicUrl(path)
        photoUrl = urlData.publicUrl
      }
    }
  
    const finalPrice = calcFinal()
  
    // Busca pedido completo para recalcular total
    const { data: orderData } = await supabase
      .from('orders')
      .select('items, total')
      .eq('id', orderId)
      .single()
  
    // Recalcula total: itens sem pesagem + valor real da carne
    const allItems: any[] = orderData?.items ?? []
    const otherItemsTotal = allItems
      .filter((i: any) => !i.chosen_label)
      .reduce((s: number, i: any) => s + (Number(i.price) * (i.quantity ?? 1)), 0)
    const newTotal = otherItemsTotal + finalPrice
  
    // Atualiza total e status do pedido
    await supabase
      .from('orders')
      .update({
        total: newTotal,
        status: 'weighing_done',
      })
      .eq('id', orderId)
  
    // Envia notificação para o cliente com foto, peso e total atualizado
    await supabase.from('order_notifications').insert({
      order_id: orderId,
      type: 'weight_update',
      message: `Seu ${item.name} pesou ${realGrams}g.${discount > 0 ? ` Desconto de R$ ${discount.toFixed(2).replace('.', ',')} aplicado!` : ''}`,
      photo_url: photoUrl,
      real_grams: parseInt(realGrams),
      final_price: finalPrice,
      order_total: newTotal,
    })
  
    setSaving(false)
    onDone()
  }

  return (
    <div className="bg-purple-950/30 border border-purple-500/20 rounded-xl p-4 mb-3">
      <div className="text-sm font-medium mb-1">{item.name}</div>
      <div className="text-xs text-white/40 mb-3">Faixa: {item.chosen_label} (até {maxGrams}g) • R$ {Number(unitPrice).toFixed(2).replace('.',',')}</div>

      <div className="flex gap-2 mb-3">
        <div className="flex-1">
          <label className="text-[10px] text-white/40 uppercase tracking-wider block mb-1">Peso real (g)</label>
          <input
            type="number"
            value={realGrams}
            onChange={e => setRealGrams(e.target.value)}
            placeholder="ex: 1050"
            className="w-full bg-black/30 border border-white/10 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-purple-400/50 text-white placeholder:text-white/20"
          />
        </div>
        {realGrams && (
          <div className="text-right">
            <div className="text-[10px] text-white/40 uppercase tracking-wider mb-1">Valor final</div>
            <div className="text-sm font-semibold text-green-400">R$ {calcFinal().toFixed(2).replace('.',',')}</div>
            {discount > 0 && <div className="text-[10px] text-red-400">-R$ {discount.toFixed(2).replace('.',',')}</div>}
          </div>
        )}
      </div>

      {/* Photo upload */}
      <div
        onClick={() => fileRef.current?.click()}
        className="border border-dashed border-white/10 rounded-lg p-3 flex items-center gap-3 cursor-pointer hover:border-purple-400/40 transition mb-3"
      >
        {photoPreview ? (
          <img src={photoPreview} className="w-14 h-14 rounded-lg object-cover" />
        ) : (
          <div className="w-14 h-14 bg-white/5 rounded-lg flex items-center justify-center">
            <Camera size={20} className="text-white/20" />
          </div>
        )}
        <div>
          <div className="text-xs font-medium text-white/60">Foto da balança</div>
          <div className="text-[10px] text-white/30">Clique para adicionar</div>
        </div>
        <input ref={fileRef} type="file" accept="image/*" capture="environment" onChange={handlePhoto} className="hidden" />
      </div>

      <button
        onClick={handleSave}
        disabled={!realGrams || saving}
        className="w-full py-2 bg-purple-600 hover:bg-purple-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-medium rounded-lg transition flex items-center justify-center gap-2"
      >
        {saving ? <RefreshCw size={14} className="animate-spin" /> : <Save size={14} />}
        {saving ? 'Salvando...' : 'Confirmar Pesagem'}
      </button>
    </div>
  )
}

// ─── MENU TAB ─────────────────────────────────────────────────

function MenuTab() {
  const [items, setItems] = useState<MenuItem[]>([])
  const [editing, setEditing] = useState<MenuItem | null>(null)
  const [isNew, setIsNew] = useState(false)
  const [loading, setLoading] = useState(true)
  const [filterCat, setFilterCat] = useState('Todos')

  const fetch = async () => {
    setLoading(true)
    const { data } = await supabase
      .from('menu_items')
      .select('*, weight_options(*)')
      .order('sort_order')
    setItems(data ?? [])
    setLoading(false)
  }

  useEffect(() => { fetch() }, [])

  const handleDelete = async (id: string) => {
    if (!confirm('Tem certeza que deseja excluir este item?')) return
    await supabase.from('menu_items').delete().eq('id', id)
    fetch()
  }

  const handleToggleAvailable = async (item: MenuItem) => {
    await supabase.from('menu_items').update({ available: !item.available }).eq('id', item.id)
    fetch()
  }

  const handleNew = () => {
    setEditing({
      id: '', name: '', category: 'Carnes', description: '', price: 0,
      image_url: '', available: true, weight_mode: false, sort_order: 0,
      weight_options: []
    })
    setIsNew(true)
  }

  const filtered = filterCat === 'Todos' ? items : items.filter(i => i.category === filterCat)

  const CATS = ['Todos', 'Carnes', 'Acompanhamentos', 'Bebidas']

  return (
    <Page
      title="Cardápio"
      subtitle="Gerencie itens, preços, faixas de peso e disponibilidade"
      action={
        <button onClick={handleNew} className="flex items-center gap-2 px-4 py-2 bg-[#e85d26] rounded-xl text-sm font-medium hover:bg-[#d44f1e] transition">
          <Plus size={16} /> Novo Item
        </button>
      }
    >
      {/* Category filter */}
      <div className="flex gap-2 mb-6">
        {CATS.map(c => (
          <button key={c} onClick={() => setFilterCat(c)}
            className={`px-4 py-2 rounded-xl text-sm font-medium transition ${filterCat === c ? 'bg-[#e85d26] text-white' : 'bg-[#161616] text-white/40 border border-white/5 hover:text-white'}`}>
            {c}
          </button>
        ))}
      </div>

      {loading && <div className="text-center py-12 text-white/30">Carregando...</div>}

      <div className="grid grid-cols-2 gap-4">
        {filtered.map(item => (
          <div key={item.id} className={`bg-[#161616] border rounded-2xl overflow-hidden transition ${item.available ? 'border-white/5' : 'border-white/5 opacity-50'}`}>
            <div className="h-36 relative bg-[#1a1a1a]">
              {item.image_url ? (
                <img src={item.image_url} alt={item.name} className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-white/10">
                  <Image size={32} />
                </div>
              )}
              <div className="absolute top-2 right-2 flex gap-1">
                {item.weight_mode && (
                  <div className="bg-purple-600/90 text-white text-[10px] font-bold px-2 py-1 rounded-full flex items-center gap-1">
                    <Scale size={10} /> Pesagem
                  </div>
                )}
                <div className={`text-[10px] font-bold px-2 py-1 rounded-full ${item.available ? 'bg-green-500/90 text-white' : 'bg-red-500/90 text-white'}`}>
                  {item.available ? 'Disponível' : 'Indisponível'}
                </div>
              </div>
            </div>
            <div className="p-4">
              <div className="flex items-start justify-between gap-2 mb-1">
                <h3 className="font-semibold text-sm leading-tight">{item.name}</h3>
                <div className="text-sm font-semibold text-[#e85d26] whitespace-nowrap">
                  R$ {Number(item.price).toFixed(2).replace('.',',')}
                </div>
              </div>
              <div className="text-xs text-white/30 mb-1">{item.category}</div>
              {item.weight_mode && item.weight_options && item.weight_options.length > 0 && (
                <div className="text-xs text-purple-400 mb-2">
                  {item.weight_options.length} faixa{item.weight_options.length > 1 ? 's' : ''} de peso
                </div>
              )}
              <div className="flex gap-2 mt-3">
                <button onClick={() => { setEditing(item); setIsNew(false) }}
                  className="flex-1 py-1.5 bg-white/5 hover:bg-white/10 rounded-lg text-xs text-white/60 hover:text-white transition flex items-center justify-center gap-1">
                  <Edit2 size={12} /> Editar
                </button>
                <button onClick={() => handleToggleAvailable(item)}
                  className="flex-1 py-1.5 bg-white/5 hover:bg-white/10 rounded-lg text-xs text-white/60 hover:text-white transition flex items-center justify-center gap-1">
                  {item.available ? <ToggleRight size={12} className="text-green-400" /> : <ToggleLeft size={12} className="text-red-400" />}
                  {item.available ? 'Desativar' : 'Ativar'}
                </button>
                <button onClick={() => handleDelete(item.id)}
                  className="py-1.5 px-3 bg-red-500/10 hover:bg-red-500/20 rounded-lg text-xs text-red-400 transition">
                  <Trash2 size={12} />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Edit Modal */}
      <AnimatePresence>
        {editing && (
          <MenuItemModal item={editing} isNew={isNew} onClose={() => setEditing(null)} onSave={fetch} />
        )}
      </AnimatePresence>
    </Page>
  )
}

// ─── MENU ITEM MODAL ──────────────────────────────────────────

function MenuItemModal({ item, isNew, onClose, onSave }: { item: MenuItem; isNew: boolean; onClose: () => void; onSave: () => void }) {
  const [form, setForm] = useState<MenuItem>({ ...item, weight_options: item.weight_options ?? [] })
  const [saving, setSaving] = useState(false)
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [imagePreview, setImagePreview] = useState<string | null>(item.image_url || null)
  const fileRef = useRef<HTMLInputElement>(null)

  const set = (key: keyof MenuItem, val: any) => setForm(f => ({ ...f, [key]: val }))

  const handleImage = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]; if (!f) return
    setImageFile(f)
    setImagePreview(URL.createObjectURL(f))
  }

  const addWeightOption = () => {
    setForm(f => ({
      ...f,
      weight_options: [...(f.weight_options ?? []), { label: '', max_grams: 0, price: 0, sort_order: (f.weight_options?.length ?? 0) + 1 }]
    }))
  }

  const updateWeightOption = (i: number, key: keyof WeightOption, val: any) => {
    setForm(f => ({
      ...f,
      weight_options: f.weight_options?.map((o, idx) => idx === i ? { ...o, [key]: val } : o)
    }))
  }

  const removeWeightOption = (i: number) => {
    setForm(f => ({ ...f, weight_options: f.weight_options?.filter((_, idx) => idx !== i) }))
  }

  const handleSave = async () => {
    setSaving(true)
    let imageUrl = form.image_url

    if (imageFile) {
      const ext = imageFile.name.split('.').pop()
      const path = `menu/${Date.now()}.${ext}`
      await supabase.storage.from('churras-media').upload(path, imageFile, { upsert: true })
      const { data } = supabase.storage.from('churras-media').getPublicUrl(path)
      imageUrl = data.publicUrl
    }

    const payload = {
      name: form.name, category: form.category, description: form.description,
      price: Number(form.price), image_url: imageUrl, available: form.available,
      weight_mode: form.weight_mode, sort_order: form.sort_order,
    }

    let itemId = form.id

    if (isNew) {
      const { data } = await supabase.from('menu_items').insert(payload).select().single()
      itemId = data?.id
    } else {
      await supabase.from('menu_items').update(payload).eq('id', form.id)
    }

    // Save weight options
    if (form.weight_mode && itemId && form.weight_options) {
      // Delete existing
      await supabase.from('weight_options').delete().eq('menu_item_id', itemId)
      // Insert new
      if (form.weight_options.length > 0) {
        await supabase.from('weight_options').insert(
          form.weight_options.map((o, i) => ({ ...o, menu_item_id: itemId, sort_order: i + 1, price: Number(o.price), max_grams: Number(o.max_grams) }))
        )
      }
    }

    setSaving(false)
    onSave()
    onClose()
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-6 backdrop-blur-sm"
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <motion.div
        initial={{ scale: 0.95, y: 20 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.95, y: 20 }}
        className="bg-[#1a1a1a] border border-white/10 rounded-3xl w-full max-w-2xl max-h-[90vh] overflow-y-auto"
      >
        <div className="flex items-center justify-between px-6 py-5 border-b border-white/5">
          <h2 className="font-semibold">{isNew ? 'Novo Item' : 'Editar Item'}</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-white/5 text-white/40 hover:text-white transition"><X size={18} /></button>
        </div>

        <div className="p-6 space-y-5">
          {/* Image */}
          <div
            onClick={() => fileRef.current?.click()}
            className="h-40 bg-[#111] border border-dashed border-white/10 rounded-2xl flex items-center justify-center cursor-pointer hover:border-[#e85d26]/40 transition overflow-hidden relative"
          >
            {imagePreview ? (
              <img src={imagePreview} className="w-full h-full object-cover" />
            ) : (
              <div className="flex flex-col items-center gap-2 text-white/20">
                <Upload size={28} />
                <span className="text-sm">Clique para adicionar foto</span>
              </div>
            )}
            <input ref={fileRef} type="file" accept="image/*" onChange={handleImage} className="hidden" />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="text-[11px] text-white/40 uppercase tracking-wider block mb-1.5">Nome</label>
              <input value={form.name} onChange={e => set('name', e.target.value)}
                className="w-full bg-[#111] border border-white/10 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-[#e85d26]/50 text-white placeholder:text-white/20"
                placeholder="Nome do item" />
            </div>
            <div>
              <label className="text-[11px] text-white/40 uppercase tracking-wider block mb-1.5">Categoria</label>
              <select value={form.category} onChange={e => set('category', e.target.value)}
                className="w-full bg-[#111] border border-white/10 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-[#e85d26]/50 text-white">
                <option>Carnes</option>
                <option>Acompanhamentos</option>
                <option>Bebidas</option>
              </select>
            </div>
            <div>
              <label className="text-[11px] text-white/40 uppercase tracking-wider block mb-1.5">Preço base (R$)</label>
              <input type="number" step="0.01" value={form.price} onChange={e => set('price', e.target.value)}
                className="w-full bg-[#111] border border-white/10 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-[#e85d26]/50 text-white"
                placeholder="0,00" />
            </div>
            <div className="col-span-2">
              <label className="text-[11px] text-white/40 uppercase tracking-wider block mb-1.5">Descrição</label>
              <textarea value={form.description} onChange={e => set('description', e.target.value)} rows={2}
                className="w-full bg-[#111] border border-white/10 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-[#e85d26]/50 text-white placeholder:text-white/20 resize-none"
                placeholder="Descrição do item" />
            </div>
          </div>

          {/* Weight mode toggle */}
          {form.category === 'Carnes' && (
            <div className="bg-purple-950/30 border border-purple-500/20 rounded-2xl p-5">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <div className="font-medium text-sm flex items-center gap-2"><Scale size={16} className="text-purple-400" /> Modo Pesagem</div>
                  <div className="text-xs text-white/40 mt-0.5">Ativa seleção de faixa de peso e pesagem pelo admin</div>
                </div>
                <button
                  onClick={() => set('weight_mode', !form.weight_mode)}
                  className={`w-12 h-6 rounded-full transition-colors relative ${form.weight_mode ? 'bg-purple-600' : 'bg-white/10'}`}
                >
                  <div className={`w-5 h-5 bg-white rounded-full absolute top-0.5 transition-all ${form.weight_mode ? 'left-6' : 'left-0.5'}`}></div>
                </button>
              </div>

              {form.weight_mode && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-white/50 font-medium">Faixas de Peso</span>
                    <button onClick={addWeightOption} className="text-xs text-purple-400 hover:text-purple-300 flex items-center gap-1 transition">
                      <Plus size={12} /> Adicionar faixa
                    </button>
                  </div>
                  {form.weight_options?.map((opt, i) => (
                    <div key={i} className="bg-black/20 rounded-xl p-3 grid grid-cols-3 gap-2 items-end">
                      <div>
                        <label className="text-[10px] text-white/30 block mb-1">Label</label>
                        <input value={opt.label} onChange={e => updateWeightOption(i, 'label', e.target.value)}
                          placeholder="ex: Até 800g"
                          className="w-full bg-black/30 border border-white/10 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:border-purple-400/50 text-white placeholder:text-white/20" />
                      </div>
                      <div>
                        <label className="text-[10px] text-white/30 block mb-1">Máx. (g)</label>
                        <input type="number" value={opt.max_grams} onChange={e => updateWeightOption(i, 'max_grams', e.target.value)}
                          placeholder="800"
                          className="w-full bg-black/30 border border-white/10 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:border-purple-400/50 text-white placeholder:text-white/20" />
                      </div>
                      <div className="flex gap-2">
                        <div className="flex-1">
                          <label className="text-[10px] text-white/30 block mb-1">Preço (R$)</label>
                          <input type="number" step="0.01" value={opt.price} onChange={e => updateWeightOption(i, 'price', e.target.value)}
                            placeholder="149,90"
                            className="w-full bg-black/30 border border-white/10 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:border-purple-400/50 text-white placeholder:text-white/20" />
                        </div>
                        <button onClick={() => removeWeightOption(i)} className="pb-0 pt-4 text-red-400 hover:text-red-300 transition">
                          <X size={14} />
                        </button>
                      </div>
                    </div>
                  ))}
                  {form.weight_options?.length === 0 && (
                    <div className="text-center py-4 text-xs text-white/25">Nenhuma faixa adicionada ainda</div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        <div className="px-6 py-4 border-t border-white/5 flex gap-3">
          <button onClick={onClose} className="flex-1 py-2.5 rounded-xl text-sm text-white/50 hover:text-white bg-white/5 hover:bg-white/10 transition">
            Cancelar
          </button>
          <button onClick={handleSave} disabled={saving || !form.name}
            className="flex-1 py-2.5 rounded-xl text-sm font-medium bg-[#e85d26] hover:bg-[#d44f1e] disabled:opacity-40 disabled:cursor-not-allowed transition flex items-center justify-center gap-2">
            {saving ? <RefreshCw size={14} className="animate-spin" /> : <Save size={14} />}
            {saving ? 'Salvando...' : 'Salvar'}
          </button>
        </div>
      </motion.div>
    </motion.div>
  )
}

// ─── COUPONS TAB ──────────────────────────────────────────────

function CouponsTab() {
  const [coupons, setCoupons] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  const fetch = async () => {
    setLoading(true)
    const { data } = await supabase
      .from('fidelity_coupons')
      .select('*, profiles(full_name)')
      .order('created_at', { ascending: false })
    setCoupons(data ?? [])
    setLoading(false)
  }

  useEffect(() => { fetch() }, [])

  const handleRedeem = async (id: string) => {
    await supabase.from('fidelity_coupons').update({ redeemed: true, redeemed_at: new Date().toISOString() }).eq('id', id)
    fetch()
  }

  const handleRevoke = async (id: string) => {
    if (!confirm('Revogar este cupom?')) return
    await supabase.from('fidelity_coupons').delete().eq('id', id)
    fetch()
  }

  return (
    <Page title="Cupons" subtitle="Gerencie cupons de fidelidade dos clientes">
      <div className="grid grid-cols-3 gap-4 mb-8">
        <StatCard icon={Ticket} label="Total gerados" value={coupons.length} color="#e85d26" />
        <StatCard icon={CheckCircle} label="Resgatados" value={coupons.filter(c => c.redeemed).length} color="#10b981" />
        <StatCard icon={Clock} label="Disponíveis" value={coupons.filter(c => !c.redeemed).length} color="#f59e0b" />
      </div>

      {loading && <div className="text-center py-12 text-white/30">Carregando...</div>}

      <div className="space-y-3">
        {coupons.map(coupon => (
          <div key={coupon.id} className="bg-[#161616] border border-white/5 rounded-2xl p-5 flex items-center gap-4">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${coupon.redeemed ? 'bg-green-500/20' : 'bg-[#e85d26]/20'}`}>
              <Ticket size={18} className={coupon.redeemed ? 'text-green-400' : 'text-[#e85d26]'} />
            </div>
            <div className="flex-1">
              <div className="font-mono text-sm font-semibold">{coupon.code}</div>
              <div className="text-xs text-white/30 mt-0.5">
                {coupon.profiles?.full_name ?? 'Cliente'} •{' '}
                {new Date(coupon.created_at).toLocaleDateString('pt-BR')}
                {coupon.redeemed && coupon.redeemed_at && ` • Resgatado em ${new Date(coupon.redeemed_at).toLocaleDateString('pt-BR')}`}
              </div>
            </div>
            <div className={`text-xs font-medium px-3 py-1 rounded-full ${coupon.redeemed ? 'bg-green-500/20 text-green-400' : 'bg-[#e85d26]/20 text-[#e85d26]'}`}>
              {coupon.redeemed ? 'Resgatado' : 'Disponível'}
            </div>
            {!coupon.redeemed && (
              <div className="flex gap-2">
                <button onClick={() => handleRedeem(coupon.id)}
                  className="px-3 py-1.5 bg-green-500/20 text-green-400 hover:bg-green-500/30 rounded-lg text-xs font-medium transition">
                  Resgatar
                </button>
                <button onClick={() => handleRevoke(coupon.id)}
                  className="px-3 py-1.5 bg-red-500/10 text-red-400 hover:bg-red-500/20 rounded-lg text-xs font-medium transition">
                  Revogar
                </button>
              </div>
            )}
          </div>
        ))}
        {!loading && coupons.length === 0 && (
          <div className="text-center py-16 text-white/25 text-sm">Nenhum cupom gerado ainda</div>
        )}
      </div>
    </Page>
  )
}

// ─── REPORTS TAB ──────────────────────────────────────────────

function ReportsTab() {
  const [range, setRange] = useState<'today' | 'week' | 'month'>('week')
  const [data, setData] = useState<any>({ revenue: 0, orders: 0, avgTicket: 0, byCategory: [], topItems: [], byDay: [] })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const now = new Date()
    let from = new Date()
    if (range === 'today') from.setHours(0,0,0,0)
    else if (range === 'week') from.setDate(now.getDate() - 7)
    else from.setDate(now.getDate() - 30)

    setLoading(true)
    supabase.from('orders').select('*').gte('created_at', from.toISOString()).then(({ data: orders }) => {
      const list = orders ?? []
      const revenue = list.reduce((s, o) => s + Number(o.total), 0)
      const avgTicket = list.length ? revenue / list.length : 0

      // Items from JSONB
      const allItems: any[] = list.flatMap(o => Array.isArray(o.items) ? o.items : [])
      const itemCount: Record<string, { name: string; count: number; revenue: number }> = {}
      allItems.forEach(item => {
        if (!itemCount[item.name]) itemCount[item.name] = { name: item.name, count: 0, revenue: 0 }
        itemCount[item.name].count += item.quantity ?? 1
        itemCount[item.name].revenue += Number(item.price ?? 0) * (item.quantity ?? 1)
      })
      const topItems = Object.values(itemCount).sort((a, b) => b.count - a.count).slice(0, 5)

      // By day
      const byDay: Record<string, number> = {}
      list.forEach(o => {
        const day = new Date(o.created_at).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
        byDay[day] = (byDay[day] ?? 0) + Number(o.total)
      })

      setData({ revenue, orders: list.length, avgTicket, topItems, byDay: Object.entries(byDay).slice(-7) })
      setLoading(false)
    })
  }, [range])

  const maxRevenue = Math.max(...data.byDay.map(([,v]: any) => v), 1)

  return (
    <Page title="Relatórios" subtitle="Análise de faturamento e desempenho"
      action={
        <div className="flex gap-2">
          {[['today','Hoje'],['week','7 dias'],['month','30 dias']].map(([k,l]) => (
            <button key={k} onClick={() => setRange(k as any)}
              className={`px-3 py-2 rounded-xl text-xs font-medium transition ${range === k ? 'bg-[#e85d26] text-white' : 'bg-[#161616] text-white/40 border border-white/5 hover:text-white'}`}>
              {l}
            </button>
          ))}
        </div>
      }
    >
      <div className="grid grid-cols-3 gap-4 mb-8">
        <StatCard icon={DollarSign}  label="Faturamento" value={`R$ ${data.revenue.toFixed(2).replace('.',',')}`} color="#10b981" />
        <StatCard icon={ShoppingBag} label="Pedidos"     value={data.orders}                                       color="#e85d26" />
        <StatCard icon={TrendingUp}  label="Ticket médio" value={`R$ ${data.avgTicket.toFixed(2).replace('.',',')}`} color="#8b5cf6" />
      </div>

      <div className="grid grid-cols-2 gap-6">
        {/* Bar chart by day */}
        <div className="bg-[#161616] border border-white/5 rounded-2xl p-5">
          <h3 className="text-sm font-medium mb-5">Faturamento por dia</h3>
          {loading ? (
            <div className="text-center py-8 text-white/30 text-sm">Carregando...</div>
          ) : data.byDay.length === 0 ? (
            <div className="text-center py-8 text-white/25 text-sm">Sem dados no período</div>
          ) : (
            <div className="flex items-end gap-2 h-36">
              {data.byDay.map(([day, val]: any) => (
                <div key={day} className="flex-1 flex flex-col items-center gap-1">
                  <div className="text-[9px] text-white/30 font-mono">
                    R${(val/100).toFixed(0)}
                  </div>
                  <div
                    className="w-full bg-[#e85d26]/80 rounded-t-md transition-all"
                    style={{ height: `${Math.max((val / maxRevenue) * 100, 4)}%` }}
                  />
                  <div className="text-[9px] text-white/30">{day}</div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Top items */}
        <div className="bg-[#161616] border border-white/5 rounded-2xl p-5">
          <h3 className="text-sm font-medium mb-5">Itens mais pedidos</h3>
          {loading ? (
            <div className="text-center py-8 text-white/30 text-sm">Carregando...</div>
          ) : data.topItems.length === 0 ? (
            <div className="text-center py-8 text-white/25 text-sm">Sem dados no período</div>
          ) : (
            <div className="space-y-3">
              {data.topItems.map((item: any, i: number) => (
                <div key={item.name} className="flex items-center gap-3">
                  <div className="w-5 h-5 rounded-full bg-[#e85d26]/20 text-[#e85d26] text-[10px] font-bold flex items-center justify-center shrink-0">
                    {i + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-medium truncate">{item.name}</div>
                    <div className="w-full bg-white/5 rounded-full h-1 mt-1">
                      <div className="bg-[#e85d26] h-1 rounded-full" style={{ width: `${(item.count / (data.topItems[0]?.count ?? 1)) * 100}%` }} />
                    </div>
                  </div>
                  <div className="text-xs text-white/40 shrink-0">{item.count}x</div>
                  <div className="text-xs font-medium shrink-0">R$ {item.revenue.toFixed(0)}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </Page>
  )
}
