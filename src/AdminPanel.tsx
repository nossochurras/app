import { supabase } from './supabaseClient'
import React, { useState, useEffect, useRef, useCallback } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import {
  LayoutDashboard, ShoppingBag, UtensilsCrossed, Ticket, BarChart2,
  LogOut, CheckCircle, Clock, ChevronRight, X,
  Plus, Edit2, Trash2, Upload, Save,
  Camera, TrendingUp, Users, DollarSign,
  ArrowRight, Eye, RefreshCw, Search,
  Scale, ToggleLeft, ToggleRight, Image, Flame,
  MessageCircle, Send, Check, CheckCheck
} from 'lucide-react'

// ─── BRAND TOKENS ────────────────────────────────────────────
// Cores extraídas do Manual de Marca 2026
// #b73527 — Vermelho principal (40% uso)
// #1a0905 — Marrom escuro/quase preto (40% uso)
// #c7ad70 — Dourado/Mostarda (10% uso)
// #fff0de — Creme/Off-white (25% uso)

// ─── TYPES ───────────────────────────────────────────────────

type AdminPermissions = {
  view_dashboard?: boolean
  view_orders?: boolean
  manage_orders?: boolean
  view_menu?: boolean
  manage_menu?: boolean
  view_coupons?: boolean
  manage_coupons?: boolean
  view_reports?: boolean
  manage_admins?: boolean
  view_chat?: boolean
  manage_chat?: boolean
}

type Profile = {
  id: string
  full_name: string
  role: 'super_admin' | 'admin' | 'user'
  permissions: AdminPermissions
}

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

// ─── CSV IMPORT TYPES ─────────────────────────────────────────

type CsvProduct = {
  codigo: string
  nome: string
  valor: number
  disponivel: boolean
  categoria: string
  estoqueMin: number
  estoqueMax: number
}

function parseBrazilianNumber(raw: string): number {
  if (!raw || raw.trim() === '') return 0
  // Remove pontos de milhar, substitui vírgula decimal por ponto
  const clean = raw.replace(/\./g, '').replace(',', '.')
  const n = parseFloat(clean)
  return isNaN(n) ? 0 : n
}

function parseCsvProducts(csvText: string): CsvProduct[] {
  const lines = csvText.split('\n').filter(l => l.trim())
  // Primeira linha é o cabeçalho — pula
  const results: CsvProduct[] = []
  for (let i = 1; i < lines.length; i++) {
    // Parser robusto para CSV com campos entre aspas contendo vírgulas
    const cols = parseCsvLine(lines[i])
    if (cols.length < 18) continue
    const codigo       = cols[0]?.trim() ?? ''
    const nome         = cols[1]?.replace(/^"|"$/g, '').trim() ?? ''
    const valorRaw     = cols[3]?.replace(/^"|"$/g, '').trim() ?? '0'
    const dispRaw      = cols[6]?.replace(/^"|"$/g, '').trim() ?? 'Não'
    const catNome      = cols[17]?.replace(/^"|"$/g, '').trim() ?? ''
    const estoqueMin   = parseBrazilianNumber(cols[10]?.replace(/^"|"$/g, '').trim() ?? '0')
    const estoqueMax   = parseBrazilianNumber(cols[11]?.replace(/^"|"$/g, '').trim() ?? '0')
    if (!nome || !codigo) continue
    results.push({
      codigo,
      nome,
      valor: parseBrazilianNumber(valorRaw),
      disponivel: dispRaw === 'Sim',
      categoria: catNome,
      estoqueMin,
      estoqueMax,
    })
  }
  return results
}

function parseCsvLine(line: string): string[] {
  const result: string[] = []
  let cur = ''
  let inQuotes = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') { cur += '"'; i++ }
      else inQuotes = !inQuotes
    } else if (ch === ',' && !inQuotes) {
      result.push(cur)
      cur = ''
    } else {
      cur += ch
    }
  }
  result.push(cur)
  return result
}

// Mapeia categoria do ERP para categoria do menu_items
function mapCategoria(cat: string): 'Carnes' | 'Acompanhamentos' | 'Bebidas' {
  const c = (cat ?? '').toLowerCase()
  if (
    c.includes('bovi') || c.includes('picanha') || c.includes('bife') ||
    c.includes('fralda') || c.includes('maminha') || c.includes('costela') ||
    c.includes('linguiça') || c.includes('linguica') || c.includes('frango') ||
    c.includes('suino') || c.includes('suíno') || c.includes('carne') ||
    c.includes('hambur') || c.includes('cupim') || c.includes('entrecote') ||
    c.includes('salm') || c.includes('camarão') || c.includes('peixe')
  ) return 'Carnes'
  if (
    c.includes('cerve') || c.includes('vinho') || c.includes('viinho') ||
    c.includes('destil') || c.includes('energé') || c.includes('energeti') ||
    c.includes('refrigei') || c.includes('agua') || c.includes('água') ||
    c.includes('whisky') || c.includes('licor') || c.includes('dose') ||
    c.includes('suco') || c.includes('gin') || c.includes('vodka')
  ) return 'Bebidas'
  return 'Acompanhamentos'
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
  pending:           { label: 'Recebido',          color: '#c7ad70', bg: '#c7ad7022', next: 'preparing' },
  awaiting_weighing: { label: 'Aguard. Pesagem',    color: '#b73527', bg: '#b7352722', next: 'weighing_done' },
  weighing_done:     { label: 'Pesagem OK',         color: '#c7ad70', bg: '#c7ad7022', next: 'preparing' },
  awaiting_payment:  { label: 'Aguard. Pagamento',  color: '#b73527', bg: '#b7352722', next: null },
  preparing:         { label: 'Preparando',         color: '#fff0de', bg: '#fff0de22', next: 'ready' },
  ready:             { label: 'Pronto!',            color: '#c7ad70', bg: '#c7ad7044', next: 'delivered' },
  delivered:         { label: 'Entregue',           color: '#6b6b5e', bg: '#6b6b5e22', next: null },
  cancelled:         { label: 'Cancelado',          color: '#b73527', bg: '#b7352722', next: null },
  paid: { label: 'Pago', color: '#10b981', bg: '#d1fae5', next: 'preparing' },
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

// ─── MOBILE HOOK ──────────────────────────────────────────────

function useIsMobile() {
  const [isMobile, setIsMobile] = React.useState(() => window.innerWidth < 768)
  React.useEffect(() => {
    const handler = () => setIsMobile(window.innerWidth < 768)
    window.addEventListener('resize', handler)
    return () => window.removeEventListener('resize', handler)
  }, [])
  return isMobile
}

// ─── GLOBAL STYLES ────────────────────────────────────────────

const globalStyle = `
  @import url('https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@400;600;700;800&family=Barlow:wght@300;400;500;600&display=swap');

  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

  :root {
    --brand-red: #b73527;
    --brand-dark: #1a0905;
    --brand-gold: #c7ad70;
    --brand-cream: #fff0de;
    --surface-1: #1f0e07;
    --surface-2: #271208;
    --surface-3: #311508;
    --border-subtle: rgba(199,173,112,0.12);
    --border-medium: rgba(199,173,112,0.22);
    --text-primary: #fff0de;
    --text-muted: rgba(255,240,222,0.5);
    --text-dim: rgba(255,240,222,0.3);
    --font-display: 'Barlow Condensed', sans-serif;
    --font-body: 'Barlow', sans-serif;
  }

  body { background: var(--surface-1); color: var(--text-primary); font-family: var(--font-body); }

  /* Scrollbar */
  ::-webkit-scrollbar { width: 4px; }
  ::-webkit-scrollbar-track { background: transparent; }
  ::-webkit-scrollbar-thumb { background: var(--border-medium); border-radius: 4px; }

  /* Input reset */
  input, textarea, select {
    background: rgba(255,240,222,0.05);
    border: 1px solid var(--border-subtle);
    border-radius: 8px;
    color: var(--text-primary);
    font-family: var(--font-body);
    font-size: 13px;
    outline: none;
    transition: border-color 0.15s;
  }
  input:focus, textarea:focus, select:focus {
    border-color: var(--brand-gold);
  }
  input::placeholder, textarea::placeholder {
    color: var(--text-dim);
  }
  select option { background: var(--surface-2); }
`

// ─── MAIN ADMIN PANEL ────────────────────────────────────────

export default function AdminPanel() {
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'dashboard' | 'orders' | 'menu' | 'coupons' | 'reports' | 'estoque' | 'team' | 'chat'>('dashboard')
  const [newOrderCount, setNewOrderCount] = useState(0)
  const [newChatCount, setNewChatCount] = useState(0)

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) { window.location.href = '/'; return }
      const { data } = await supabase.from('profiles').select('*').eq('id', user.id).single()
      if (!data || (data.role !== 'admin' && data.role !== 'super_admin')) { window.location.href = '/'; return }
      setProfile(data)
      setLoading(false)
    })
  }, [])

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

  useEffect(() => {
    // Busca contagem inicial de mensagens não lidas
    supabase
      .from('chat_messages')
      .select('id', { count: 'exact', head: true })
      .eq('sender', 'user')
      .eq('read_by_admin', false)
      .then(({ count }) => setNewChatCount(count ?? 0))

    const channel = supabase
      .channel('admin-chat')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'chat_messages' }, (payload) => {
        if (payload.new.sender === 'user') {
          setNewChatCount(c => c + 1)
          playNotificationSound()
        }
      })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [])

  const isMobile = useIsMobile()
  const [drawerOpen, setDrawerOpen] = React.useState(false)

  // Fecha drawer ao trocar de aba
  const handleTabChange = (tab: any) => {
    setActiveTab(tab)
    if (tab === 'orders') setNewOrderCount(0)
    if (tab === 'chat') setNewChatCount(0)
    setDrawerOpen(false)
  }

  if (loading) return (
    <>
      <style>{globalStyle}</style>
      <div style={{
        minHeight: '100vh', background: 'var(--surface-1)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        flexDirection: 'column', gap: '20px'
      }}>
        <LogoMark size={56} />
        <p style={{ color: 'var(--text-dim)', fontSize: '12px', fontFamily: 'var(--font-display)', letterSpacing: '3px', textTransform: 'uppercase' }}>
          carregando painel...
        </p>
      </div>
    </>
  )

  // Conteúdo da sidebar (reutilizado em desktop e drawer mobile)
  const sidebarContent = (
    <>
      {/* Logo */}
      <div style={{ padding: '24px 20px 20px', borderBottom: '1px solid var(--border-subtle)' }}>
        <BrandLogo />
        <p style={{
          fontSize: '10px', letterSpacing: '3px', textTransform: 'uppercase',
          color: 'var(--brand-gold)', fontFamily: 'var(--font-display)',
          fontWeight: 600, marginTop: '8px', opacity: 0.8
        }}>
          Painel Admin
        </p>
      </div>

      {/* Nav */}
      <nav style={{ flex: 1, padding: '12px 10px', display: 'flex', flexDirection: 'column', gap: '2px' }}>
        {[
          { id: 'dashboard', icon: LayoutDashboard, label: 'Dashboard',   perm: 'view_dashboard' as keyof AdminPermissions },
          { id: 'orders',    icon: ShoppingBag,     label: 'Pedidos',     perm: 'view_orders' as keyof AdminPermissions,    badge: newOrderCount > 0 ? newOrderCount : null },
          { id: 'chat',      icon: MessageCircle,   label: 'Chat',        perm: 'view_chat' as keyof AdminPermissions,      badge: newChatCount > 0 ? newChatCount : null },
          { id: 'menu',      icon: UtensilsCrossed, label: 'Cardápio',    perm: 'view_menu' as keyof AdminPermissions },
          { id: 'coupons',   icon: Ticket,          label: 'Cupons',      perm: 'view_coupons' as keyof AdminPermissions },
          { id: 'reports',   icon: BarChart2,       label: 'Relatórios',  perm: 'view_reports' as keyof AdminPermissions },
          { id: 'estoque',   icon: Upload,          label: 'Estoque',     perm: 'manage_menu' as keyof AdminPermissions },
          ...(profile?.role === 'super_admin' ? [{ id: 'team', icon: Users, label: 'Equipe', perm: 'manage_admins' as keyof AdminPermissions }] : []),
        ].filter(item => profile?.role === 'super_admin' || profile?.permissions?.[item.perm])
        .map(item => {
          const Icon = item.icon
          const active = activeTab === item.id
          return (
            <button
              key={item.id}
              onClick={() => handleTabChange(item.id as any)}
              style={{
                display: 'flex', alignItems: 'center', gap: '10px',
                padding: '10px 12px', borderRadius: '8px',
                border: active ? '1px solid rgba(183,53,39,0.4)' : '1px solid transparent',
                background: active ? 'rgba(183,53,39,0.15)' : 'transparent',
                color: active ? 'var(--brand-cream)' : 'var(--text-muted)',
                cursor: 'pointer', transition: 'all 0.15s',
                fontFamily: 'var(--font-display)', fontWeight: 600,
                fontSize: '14px', letterSpacing: '0.5px',
                textAlign: 'left', width: '100%',
              }}
              onMouseEnter={e => { if (!active) (e.currentTarget as HTMLButtonElement).style.color = 'var(--brand-cream)' }}
              onMouseLeave={e => { if (!active) (e.currentTarget as HTMLButtonElement).style.color = 'var(--text-muted)' }}
            >
              <Icon size={16} style={{ color: active ? 'var(--brand-red)' : 'inherit', flexShrink: 0 }} />
              <span style={{ flex: 1 }}>{item.label}</span>
              {item.badge && (
                <span style={{
                  background: 'var(--brand-red)', color: 'var(--brand-cream)',
                  fontSize: '10px', fontWeight: 700,
                  width: '18px', height: '18px', borderRadius: '50%',
                  display: 'flex', alignItems: 'center', justifyContent: 'center'
                }}>
                  {item.badge}
                </span>
              )}
            </button>
          )
        })}
      </nav>

      {/* Decorative divider */}
      <div style={{
        margin: '0 16px', height: '1px',
        background: 'linear-gradient(90deg, transparent, var(--brand-gold), transparent)',
        opacity: 0.3
      }} />

      {/* User */}
      <div style={{ padding: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px' }}>
          <div style={{
            width: '32px', height: '32px', borderRadius: '50%',
            background: 'rgba(183,53,39,0.2)', border: '1px solid rgba(183,53,39,0.4)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '12px', fontWeight: 700, color: 'var(--brand-red)',
            fontFamily: 'var(--font-display)'
          }}>
            {profile?.full_name?.[0]?.toUpperCase() ?? 'A'}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {profile?.full_name ?? 'Admin'}
            </div>
            <div style={{ fontSize: '10px', color: 'var(--text-dim)', letterSpacing: '1px', textTransform: 'uppercase' }}>Administrador</div>
          </div>
        </div>
        <button
          onClick={() => supabase.auth.signOut().then(() => window.location.href = '/')}
          style={{
            width: '100%', display: 'flex', alignItems: 'center', gap: '8px',
            padding: '8px 10px', borderRadius: '6px', border: '1px solid transparent',
            background: 'transparent', color: 'var(--text-dim)', cursor: 'pointer',
            fontSize: '12px', fontFamily: 'var(--font-body)', transition: 'all 0.15s'
          }}
          onMouseEnter={e => { const b = e.currentTarget as HTMLButtonElement; b.style.color = 'var(--brand-red)'; b.style.background = 'rgba(183,53,39,0.08)' }}
          onMouseLeave={e => { const b = e.currentTarget as HTMLButtonElement; b.style.color = 'var(--text-dim)'; b.style.background = 'transparent' }}
        >
          <LogOut size={13} /> Sair
        </button>
      </div>
    </>
  )

  return (
    <>
      <style>{globalStyle}</style>
      <div style={{ minHeight: '100vh', background: 'var(--surface-1)', display: 'flex', flexDirection: 'column' }}>

        {/* ── TOPBAR MOBILE ── */}
        {isMobile && (
          <header style={{
            position: 'sticky', top: 0, zIndex: 40,
            background: 'var(--surface-2)',
            borderBottom: '1px solid var(--border-subtle)',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '0 16px', height: '56px', flexShrink: 0
          }}>
            <BrandLogo />
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              {newOrderCount > 0 && (
                <span style={{
                  background: 'var(--brand-red)', color: 'var(--brand-cream)',
                  fontSize: '11px', fontWeight: 700,
                  minWidth: '20px', height: '20px', borderRadius: '10px',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  padding: '0 4px'
                }}>
                  {newOrderCount}
                </span>
              )}
              <button
                onClick={() => setDrawerOpen(v => !v)}
                style={{
                  background: 'transparent', border: '1px solid var(--border-medium)',
                  borderRadius: '8px', padding: '8px', cursor: 'pointer',
                  color: 'var(--text-primary)', display: 'flex', alignItems: 'center'
                }}
              >
                {drawerOpen ? <X size={20} /> : (
                  <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                    <rect x="2" y="4" width="16" height="2" rx="1" fill="currentColor"/>
                    <rect x="2" y="9" width="16" height="2" rx="1" fill="currentColor"/>
                    <rect x="2" y="14" width="16" height="2" rx="1" fill="currentColor"/>
                  </svg>
                )}
              </button>
            </div>
          </header>
        )}

        <div style={{ display: 'flex', flex: 1, position: 'relative' }}>
          {/* ── OVERLAY MOBILE ── */}
          {isMobile && drawerOpen && (
            <div
              onClick={() => setDrawerOpen(false)}
              style={{
                position: 'fixed', inset: 0, zIndex: 30,
                background: 'rgba(26,9,5,0.7)', backdropFilter: 'blur(2px)'
              }}
            />
          )}

          {/* ── SIDEBAR (desktop: sticky | mobile: drawer) ── */}
          <aside style={{
            width: '220px',
            background: 'var(--surface-2)',
            borderRight: '1px solid var(--border-subtle)',
            display: 'flex', flexDirection: 'column',
            ...(isMobile ? {
              position: 'fixed',
              top: '56px',
              left: 0,
              bottom: 0,
              zIndex: 35,
              transform: drawerOpen ? 'translateX(0)' : 'translateX(-100%)',
              transition: 'transform 0.25s cubic-bezier(0.4,0,0.2,1)',
              overflowY: 'auto',
            } : {
              position: 'sticky',
              top: 0,
              height: '100vh',
              flexShrink: 0,
            })
          }}>
          {sidebarContent}
          </aside>

          {/* MAIN */}
          <main style={{ flex: 1, overflowY: 'auto', minWidth: 0 }}>
            <AnimatePresence mode="wait">
              {activeTab === 'dashboard' && <DashboardTab key="dashboard" onNavigate={handleTabChange} />}
              {activeTab === 'orders'    && <OrdersTab    key="orders" profile={profile!} />}
              {activeTab === 'chat'      && <ChatTab      key="chat"   profile={profile!} />}
              {activeTab === 'menu'      && <MenuTab      key="menu"   profile={profile!} />}
              {activeTab === 'coupons'   && <CouponsTab   key="coupons" profile={profile!} />}
              {activeTab === 'reports'   && <ReportsTab   key="reports" />}
              {activeTab === 'estoque'   && <EstoqueTab   key="estoque" />}
              {activeTab === 'team'      && profile?.role === 'super_admin' && <TeamTab key="team" />}
            </AnimatePresence>
          </main>
        </div>
      </div>
    </>
  )
}

// ─── BRAND COMPONENTS ─────────────────────────────────────────

function LogoMark({ size = 40 }: { size?: number }) {
  return (
    <div style={{
      width: size, height: size,
      background: 'var(--brand-red)',
      borderRadius: '10px',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      position: 'relative', overflow: 'hidden'
    }}>
      <Flame size={size * 0.45} color="var(--brand-cream)" />
      <div style={{
        position: 'absolute', bottom: 0, left: 0, right: 0,
        height: '3px', background: 'var(--brand-gold)'
      }} />
    </div>
  )
}

function BrandLogo() {
  return (
    <div>
      <div style={{ fontSize: '9px', fontFamily: 'var(--font-display)', fontWeight: 700, letterSpacing: '4px', color: 'var(--brand-gold)', textTransform: 'uppercase' }}>
        Praça
      </div>
      <div style={{ fontSize: '22px', fontFamily: 'var(--font-display)', fontWeight: 800, color: 'var(--brand-red)', lineHeight: 1, textTransform: 'uppercase', letterSpacing: '-0.5px' }}>
        Nosso<br />Churras
      </div>
      <div style={{
        display: 'inline-block', marginTop: '3px',
        background: 'var(--brand-red)', padding: '1px 6px',
        fontSize: '8px', fontFamily: 'var(--font-display)', fontWeight: 700,
        letterSpacing: '3px', color: 'var(--brand-cream)', textTransform: 'uppercase'
      }}>
        Gastrobar
      </div>
    </div>
  )
}

// Divisor com estrelas (elemento gráfico do manual)
function StarDivider() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', margin: '4px 0' }}>
      <div style={{ flex: 1, height: '1px', background: 'var(--border-subtle)' }} />
      {'★★★★★'.split('').map((s, i) => (
        <span key={i} style={{ color: 'var(--brand-gold)', fontSize: '8px', opacity: i < 3 ? 1 : 0.35 }}>{s}</span>
      ))}
      <div style={{ flex: 1, height: '1px', background: 'var(--border-subtle)' }} />
    </div>
  )
}

// ─── PAGE WRAPPER ─────────────────────────────────────────────

function Page({ title, subtitle, children, action }: any) {
  const isMobile = useIsMobile()
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.2 }}
      style={{ padding: isMobile ? '16px' : '32px' }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: isMobile ? '16px' : '28px', gap: '12px', flexWrap: 'wrap' }}>
        <div>
          <h1 style={{
            fontFamily: 'var(--font-display)', fontWeight: 800,
            fontSize: isMobile ? '24px' : '32px', textTransform: 'uppercase', letterSpacing: '1px',
            color: 'var(--text-primary)', lineHeight: 1
          }}>
            {title}
          </h1>
          {subtitle && (
            <p style={{ color: 'var(--text-muted)', fontSize: '13px', marginTop: '6px', fontFamily: 'var(--font-body)' }}>
              {subtitle}
            </p>
          )}
          <StarDivider />
        </div>
        {action}
      </div>
      {children}
    </motion.div>
  )
}

// ─── STAT CARD ────────────────────────────────────────────────

function StatCard({ icon: Icon, label, value, color = 'var(--brand-red)' }: any) {
  return (
    <div style={{
      background: 'var(--surface-2)',
      border: '1px solid var(--border-subtle)',
      borderRadius: '12px', padding: '20px',
      borderTop: `3px solid ${color}`,
      position: 'relative', overflow: 'hidden'
    }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '12px' }}>
        <div style={{
          width: '36px', height: '36px', borderRadius: '8px',
          background: `${color}18`,
          display: 'flex', alignItems: 'center', justifyContent: 'center'
        }}>
          <Icon size={18} style={{ color }} />
        </div>
      </div>
      <div style={{
        fontSize: '26px', fontWeight: 800, fontFamily: 'var(--font-display)',
        color: 'var(--text-primary)', letterSpacing: '-0.5px'
      }}>
        {value}
      </div>
      <div style={{ fontSize: '11px', color: 'var(--text-dim)', marginTop: '2px', textTransform: 'uppercase', letterSpacing: '1px', fontWeight: 600 }}>
        {label}
      </div>
      {/* decorative corner element */}
      <div style={{
        position: 'absolute', bottom: '-8px', right: '-8px',
        width: '48px', height: '48px', borderRadius: '50%',
        background: `${color}08`
      }} />
    </div>
  )
}

// ─── GOLD BUTTON ─────────────────────────────────────────────

function GoldButton({ children, onClick, disabled, small }: { children: any; onClick?: () => void; disabled?: boolean; small?: boolean }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        display: 'flex', alignItems: 'center', gap: '6px',
        padding: small ? '8px 16px' : '10px 20px',
        background: disabled ? 'rgba(183,53,39,0.2)' : 'var(--brand-red)',
        border: '1px solid',
        borderColor: disabled ? 'rgba(183,53,39,0.2)' : 'var(--brand-red)',
        borderRadius: '8px', color: 'var(--brand-cream)',
        fontFamily: 'var(--font-display)', fontWeight: 700,
        fontSize: small ? '12px' : '13px', letterSpacing: '1px', textTransform: 'uppercase',
        cursor: disabled ? 'not-allowed' : 'pointer', opacity: disabled ? 0.5 : 1,
        transition: 'all 0.15s'
      }}
    >
      {children}
    </button>
  )
}

// ─── GHOST BUTTON ────────────────────────────────────────────

function GhostButton({ children, onClick, small }: { children: any; onClick?: () => void; small?: boolean }) {
  return (
    <button
      onClick={onClick}
      style={{
        display: 'flex', alignItems: 'center', gap: '6px',
        padding: small ? '7px 14px' : '9px 18px',
        background: 'transparent',
        border: '1px solid var(--border-medium)',
        borderRadius: '8px', color: 'var(--text-muted)',
        fontFamily: 'var(--font-display)', fontWeight: 600,
        fontSize: small ? '12px' : '13px', letterSpacing: '0.5px',
        cursor: 'pointer', transition: 'all 0.15s'
      }}
      onMouseEnter={e => { const b = e.currentTarget as HTMLButtonElement; b.style.color = 'var(--text-primary)'; b.style.borderColor = 'var(--brand-gold)' }}
      onMouseLeave={e => { const b = e.currentTarget as HTMLButtonElement; b.style.color = 'var(--text-muted)'; b.style.borderColor = 'var(--border-medium)' }}
    >
      {children}
    </button>
  )
}

// ─── STATUS BADGE ─────────────────────────────────────────────

function StatusBadge({ status }: { status: string }) {
  const cfg = STATUS_CONFIG[status] ?? STATUS_CONFIG.pending
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: '5px',
      padding: '3px 10px', borderRadius: '20px', fontSize: '10px',
      fontWeight: 700, fontFamily: 'var(--font-display)', letterSpacing: '0.5px', textTransform: 'uppercase',
      color: cfg.color, background: cfg.bg,
      border: `1px solid ${cfg.color}30`
    }}>
      <span style={{ width: '5px', height: '5px', borderRadius: '50%', background: cfg.color, flexShrink: 0 }} />
      {cfg.label}
    </span>
  )
}

// ─── SECTION CARD ────────────────────────────────────────────

function SectionCard({ children, style: extraStyle }: { children: any; style?: React.CSSProperties }) {
  return (
    <div style={{
      background: 'var(--surface-2)',
      border: '1px solid var(--border-subtle)',
      borderRadius: '14px', overflow: 'hidden',
      ...extraStyle
    }}>
      {children}
    </div>
  )
}

function DashboardStats({ stats }: { stats: any }) {
  const isMobile = useIsMobile()
  return (
    <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : 'repeat(4, 1fr)', gap: '12px', marginBottom: isMobile ? '16px' : '28px' }}>
      <StatCard icon={ShoppingBag}  label="Pedidos hoje"     value={stats.orders}                                           color="var(--brand-red)" />
      <StatCard icon={DollarSign}   label="Faturamento"      value={`R$ ${stats.revenue.toFixed(2).replace('.',',')}`}      color="var(--brand-gold)" />
      <StatCard icon={Clock}        label="Em andamento"     value={stats.pending}                                          color="#c7ad70" />
      <StatCard icon={Users}        label="Clientes hoje"    value={stats.customers}                                        color="var(--brand-red)" />
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
    <Page
      title="Dashboard"
      subtitle={`NOSSO churrasco • ${new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })}`}
    >
      <DashboardStats stats={stats} />

      <SectionCard>
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '16px 20px',
          borderBottom: '1px solid var(--border-subtle)'
        }}>
          <h2 style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '16px', textTransform: 'uppercase', letterSpacing: '1px', color: 'var(--text-primary)' }}>
            Pedidos Recentes
          </h2>
          <button
            onClick={() => onNavigate('orders')}
            style={{
              display: 'flex', alignItems: 'center', gap: '4px',
              background: 'transparent', border: 'none',
              color: 'var(--brand-gold)', fontSize: '11px', fontWeight: 700,
              fontFamily: 'var(--font-display)', letterSpacing: '1px', textTransform: 'uppercase',
              cursor: 'pointer', opacity: 0.8, transition: 'opacity 0.15s'
            }}
          >
            Ver todos <ChevronRight size={13} />
          </button>
        </div>
        <div>
          {recentOrders.length === 0 && (
            <div style={{ padding: '48px', textAlign: 'center', color: 'var(--text-dim)', fontSize: '13px' }}>
              A brasa ainda está acendendo... nenhum pedido hoje.
            </div>
          )}
          {recentOrders.map((order, i) => (
            <div
              key={order.id}
              style={{
                display: 'flex', alignItems: 'center', gap: '16px',
                padding: '14px 20px',
                borderBottom: i < recentOrders.length - 1 ? '1px solid var(--border-subtle)' : 'none',
              }}
            >
              <div style={{ fontFamily: 'var(--font-display)', fontSize: '13px', color: 'var(--brand-gold)', fontWeight: 700, width: '56px' }}>
                #{order.order_code}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>{order.location}</div>
                <div style={{ fontSize: '11px', color: 'var(--text-dim)', marginTop: '1px' }}>
                  {new Date(order.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                </div>
              </div>
              <div style={{ fontSize: '14px', fontWeight: 700, fontFamily: 'var(--font-display)', color: 'var(--brand-gold)' }}>
                R$ {Number(order.total).toFixed(2).replace('.',',')}
              </div>
              <StatusBadge status={order.status} />
            </div>
          ))}
        </div>
      </SectionCard>
    </Page>
  )
}

function OrdersGrid({ profile, orders, selected, setSelected, advanceStatus, fetchOrders }: any) {
  const isMobile = useIsMobile()

  // Mobile: bloqueia scroll do body quando o detalhe estiver aberto
  React.useEffect(() => {
    if (isMobile && selected) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => { document.body.style.overflow = '' }
  }, [isMobile, selected])

  return (
    <>
      {/* ── LISTA (igual em desktop e mobile) ── */}
      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 380px', gap: '20px' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {orders.length === 0 && (
            <div style={{ textAlign: 'center', padding: '48px', color: 'var(--text-dim)', fontSize: '13px' }}>
              Nenhum pedido encontrado.
            </div>
          )}
          {orders.map((order: any) => {
            const isSelected = selected?.id === order.id
            const hasWeightItems = Array.isArray(order.items) && order.items.some((i: any) => i.weight_option_id || i.chosen_label)
            return (
              <motion.div
                key={order.id}
                layout
                onClick={() => setSelected(isSelected ? null : order)}
                style={{
                  background: isSelected ? 'rgba(183,53,39,0.08)' : 'var(--surface-2)',
                  border: `1px solid ${isSelected ? 'rgba(183,53,39,0.4)' : 'var(--border-subtle)'}`,
                  borderRadius: '12px', padding: '14px 18px',
                  cursor: 'pointer', transition: 'all 0.15s',
                  display: 'flex', alignItems: 'center', gap: '14px'
                }}
              >
                <div style={{ fontFamily: 'var(--font-display)', fontSize: '13px', color: 'var(--brand-gold)', fontWeight: 700, width: '56px', flexShrink: 0 }}>
                  #{order.order_code}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    {order.location}
                    {hasWeightItems && <Scale size={11} style={{ color: 'var(--brand-gold)' }} />}
                  </div>
                  <div style={{ fontSize: '11px', color: 'var(--text-dim)', marginTop: '2px' }}>
                    {new Date(order.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })} •{' '}
                    {order.payment_type === 'app' ? 'Pago no App' : 'Pagamento Local'}
                  </div>
                </div>
                <div style={{ textAlign: 'right', flexShrink: 0 }}>
                  <div style={{ fontSize: '15px', fontWeight: 800, fontFamily: 'var(--font-display)', color: 'var(--brand-gold)' }}>
                    R$ {Number(order.total).toFixed(2).replace('.',',')}
                  </div>
                  <div style={{ marginTop: '4px' }}>
                    <StatusBadge status={order.status} />
                  </div>
                </div>
              </motion.div>
            )
          })}
        </div>

        {/* ── PAINEL DESKTOP (coluna direita, igual antes) ── */}
        {!isMobile && (
          <div>
            <AnimatePresence>
              {selected ? (
                <OrderDetail key={selected.id} order={selected} onAdvance={advanceStatus} onClose={() => setSelected(null)} onRefresh={fetchOrders} profile={profile} />
              ) : (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  style={{
                    background: 'var(--surface-2)', border: '1px solid var(--border-subtle)',
                    borderRadius: '14px', height: '200px',
                    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                    gap: '10px', color: 'var(--text-dim)'
                  }}
                >
                  <Eye size={28} style={{ opacity: 0.3 }} />
                  <span style={{ fontSize: '12px', textTransform: 'uppercase', letterSpacing: '1px', fontFamily: 'var(--font-display)' }}>
                    Selecione um pedido
                  </span>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}
      </div>

      {/* ── MODAL MOBILE (position: fixed, cobre tudo, slide-up) ── */}
      {isMobile && (
        <AnimatePresence>
          {selected && (
            <>
              {/* Backdrop */}
              <motion.div
                key="backdrop"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setSelected(null)}
                style={{
                  position: 'fixed', inset: 0, zIndex: 60,
                  background: 'rgba(26,9,5,0.75)', backdropFilter: 'blur(2px)'
                }}
              />
              {/* Sheet */}
              <motion.div
                key="sheet"
                initial={{ y: '100%' }}
                animate={{ y: 0 }}
                exit={{ y: '100%' }}
                transition={{ type: 'spring', damping: 30, stiffness: 300 }}
                style={{
                  position: 'fixed', left: 0, right: 0, bottom: 0, zIndex: 61,
                  maxHeight: '92vh',
                  background: 'var(--surface-2)',
                  borderTop: '1px solid var(--border-medium)',
                  borderRadius: '20px 20px 0 0',
                  overflowY: 'auto',
                  WebkitOverflowScrolling: 'touch',
                  boxShadow: '0 -8px 40px rgba(26,9,5,0.6)'
                }}
              >
                {/* Drag handle visual */}
                <div style={{
                  display: 'flex', justifyContent: 'center', paddingTop: '12px', paddingBottom: '4px'
                }}>
                  <div style={{
                    width: '36px', height: '4px', borderRadius: '2px',
                    background: 'var(--border-medium)'
                  }} />
                </div>
                <OrderDetail
                  key={selected.id}
                  order={selected}
                  onAdvance={advanceStatus}
                  onClose={() => setSelected(null)}
                  onRefresh={fetchOrders}
                  profile={profile}
                />
              </motion.div>
            </>
          )}
        </AnimatePresence>
      )}
    </>
  )
}

// ─── ORDERS TAB ───────────────────────────────────────────────

function OrdersTab({ profile }: { profile: Profile }) {
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
    return data ?? []
  }, [])

  // Atualiza a lista E o pedido aberto no painel (selected), pois eles
  // vivem em states separados. Sem isso, depois de pesar um item o painel
  // fica com dados antigos até o admin fechar e reabrir o pedido.
  const refreshOrdersAndSelected = useCallback(async () => {
    const fresh = await fetchOrders()
    setSelected(prevSelected => {
      if (!prevSelected) return prevSelected
      const updated = fresh.find((o: Order) => o.id === prevSelected.id)
      return updated ?? prevSelected
    })
  }, [fetchOrders])

  useEffect(() => { fetchOrders() }, [fetchOrders])

  useEffect(() => {
    const channel = supabase
      .channel('orders-list')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, refreshOrdersAndSelected)
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [refreshOrdersAndSelected])

  const filtered = orders.filter(o => {
    const matchStatus = filterStatus === 'all' || o.status === filterStatus
    const matchSearch = !search || o.order_code.includes(search) || o.location.toLowerCase().includes(search.toLowerCase())
    return matchStatus && matchSearch
  })

  const advanceStatus = async (order: Order, forceStatus?: string) => {
    const next = forceStatus ?? STATUS_CONFIG[order.status]?.next
    if (!next) return
    await supabase.from('orders').update({ status: next, payment_status: next === 'preparing' && order.status === 'awaiting_payment' ? 'paid' : undefined }).eq('id', order.id)
    await refreshOrdersAndSelected()
  }

  return (
    <Page
      title="Pedidos"
      subtitle="A vida acontece ao redor do fogo — acompanhe em tempo real"
      action={
        <GhostButton onClick={fetchOrders} small>
          <RefreshCw size={13} /> Atualizar
        </GhostButton>
      }
    >
      {/* Filters */}
      <div style={{ display: 'flex', gap: '10px', marginBottom: '20px', flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ position: 'relative' }}>
          <Search size={13} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-dim)' }} />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Buscar pedido..."
            style={{ padding: '8px 12px 8px 30px', width: '180px', fontSize: '12px' }}
          />
        </div>
        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
          {[['all','Todos'], ...Object.entries(STATUS_CONFIG).map(([k,v]) => [k, v.label])].map(([key, label]) => (
            <button
              key={key}
              onClick={() => setFilterStatus(key)}
              style={{
                padding: '7px 14px', borderRadius: '20px', fontSize: '11px',
                fontWeight: 700, fontFamily: 'var(--font-display)', letterSpacing: '0.5px',
                cursor: 'pointer', transition: 'all 0.15s', textTransform: 'uppercase',
                background: filterStatus === key ? 'var(--brand-red)' : 'var(--surface-2)',
                border: filterStatus === key ? '1px solid var(--brand-red)' : '1px solid var(--border-subtle)',
                color: filterStatus === key ? 'var(--brand-cream)' : 'var(--text-muted)'
              }}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <OrdersGrid profile={profile} orders={filtered} selected={selected} setSelected={setSelected} advanceStatus={advanceStatus} fetchOrders={refreshOrdersAndSelected} />
    </Page>
  )
}

// ─── ORDER DETAIL ─────────────────────────────────────────────

function OrderDetail({ order, onAdvance, onClose, onRefresh, profile }: {
  order: Order; onAdvance: (o: Order, forceStatus?: string) => void; onClose: () => void; onRefresh: () => void; profile: Profile
}) {
  const cfg = STATUS_CONFIG[order.status] ?? STATUS_CONFIG.pending
  const nextCfg = cfg.next ? STATUS_CONFIG[cfg.next] : null
  const items: any[] = Array.isArray(order.items) ? order.items : []
  const hasWeightItems = items.some(i => i.weight_mode || i.chosen_label)
  const pendingWeighing = order.status === 'awaiting_weighing' &&
    items.filter(i => i.chosen_label).some(i => !i.real_grams)

  return (
    <motion.div
      initial={{ opacity: 0, x: 16 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 16 }}
      style={{
        background: 'var(--surface-2)', border: '1px solid var(--border-subtle)',
        borderRadius: '14px', overflow: 'hidden', position: 'sticky', top: '20px'
      }}
    >
      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '16px 18px', borderBottom: '1px solid var(--border-subtle)',
        background: 'rgba(183,53,39,0.06)'
      }}>
        <div>
          <div style={{ fontFamily: 'var(--font-display)', fontSize: '12px', color: 'var(--brand-gold)', fontWeight: 700, letterSpacing: '2px' }}>
            #{order.order_code}
          </div>
          <div style={{ fontFamily: 'var(--font-display)', fontSize: '18px', fontWeight: 700, color: 'var(--text-primary)', textTransform: 'uppercase' }}>
            {order.location}
          </div>
        </div>
        <button
          onClick={onClose}
          style={{
            background: 'transparent', border: '1px solid var(--border-subtle)',
            borderRadius: '6px', padding: '4px', cursor: 'pointer',
            color: 'var(--text-dim)', display: 'flex', alignItems: 'center', transition: 'all 0.15s'
          }}
        >
          <X size={14} />
        </button>
      </div>

      {/* Status */}
      <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--border-subtle)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
          <span style={{ fontSize: '11px', color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '1px' }}>Status:</span>
          <StatusBadge status={order.status} />
        </div>

        {order.status === 'awaiting_payment' && order.location?.includes('Retirada') && profile.permissions?.manage_orders && (
          <>
            <div style={{
              display: 'flex', alignItems: 'center', gap: '6px',
              padding: '8px 10px', marginBottom: '8px', borderRadius: '6px',
              background: 'rgba(183,53,39,0.08)', border: '1px solid rgba(183,53,39,0.25)',
              fontSize: '11px', color: 'var(--brand-red)', fontWeight: 600
            }}>
              <Clock size={13} style={{ flexShrink: 0 }} />
              Confirme o pagamento para liberar o preparo do pedido.
            </div>
            <button
              onClick={() => onAdvance(order, 'preparing')}
              style={{
                width: '100%', padding: '10px', borderRadius: '8px',
                background: 'rgba(16,185,129,0.15)', border: '1px solid rgba(16,185,129,0.4)',
                color: '#10b981', cursor: 'pointer',
                fontFamily: 'var(--font-display)', fontWeight: 700,
                fontSize: '13px', letterSpacing: '0.5px', textTransform: 'uppercase',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
                transition: 'all 0.15s'
              }}
            >
              <CheckCircle size={14} /> Confirmar Pagamento
            </button>
          </>
        )}

        {order.status !== 'awaiting_payment' && nextCfg && profile.permissions?.manage_orders && (
          <>
            {pendingWeighing && (
              <div style={{
                display: 'flex', alignItems: 'center', gap: '6px',
                padding: '8px 10px', marginBottom: '8px', borderRadius: '6px',
                background: 'rgba(183,53,39,0.08)', border: '1px solid rgba(183,53,39,0.25)',
                fontSize: '11px', color: 'var(--brand-red)', fontWeight: 600
              }}>
                <Scale size={13} style={{ flexShrink: 0 }} />
                Existem itens por peso ainda não pesados. Pese todos os itens para liberar o avanço.
              </div>
            )}
            <button
              onClick={() => onAdvance(order)}
              disabled={pendingWeighing}
              style={{
                width: '100%', padding: '10px', borderRadius: '8px',
                background: pendingWeighing ? 'rgba(199,173,112,0.15)' : `${cfg.color}15`,
                border: pendingWeighing ? '1px solid rgba(199,173,112,0.3)' : `1px solid ${cfg.color}40`,
                color: pendingWeighing ? 'var(--text-dim)' : cfg.color,
                cursor: pendingWeighing ? 'not-allowed' : 'pointer',
                fontFamily: 'var(--font-display)', fontWeight: 700,
                fontSize: '13px', letterSpacing: '0.5px', textTransform: 'uppercase',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
                opacity: pendingWeighing ? 0.6 : 1,
                transition: 'all 0.15s'
              }}
            >
              Avançar <ArrowRight size={14} /> {nextCfg.label}
            </button>
          </>
        )}
      </div>

      {/* Items */}
      <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--border-subtle)', maxHeight: '220px', overflowY: 'auto' }}>
        <div style={{ fontSize: '10px', fontFamily: 'var(--font-display)', fontWeight: 700, letterSpacing: '2px', textTransform: 'uppercase', color: 'var(--brand-gold)', marginBottom: '10px' }}>
          Itens do Pedido
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {items.map((item: any, i: number) => (
            <div key={i} style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '8px' }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: '13px', fontWeight: 500, color: 'var(--text-primary)' }}>{item.name}</div>
                {item.chosen_label && (
                  <div style={{ fontSize: '11px', color: 'var(--brand-gold)', marginTop: '2px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <Scale size={9} /> {item.chosen_label}
                    {item.real_grams && <span style={{ color: '#5dba75' }}>→ {item.real_grams}g</span>}
                  </div>
                )}
                <div style={{ fontSize: '11px', color: 'var(--text-dim)' }}>x{item.quantity}</div>
              </div>
              <div style={{ fontSize: '13px', fontWeight: 700, fontFamily: 'var(--font-display)', color: 'var(--brand-gold)', flexShrink: 0 }}>
                R$ {(Number(item.final_price ?? item.price) * item.quantity).toFixed(2).replace('.',',')}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Weighing section */}
      {hasWeightItems && order.status === 'awaiting_weighing' && (
        <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--border-subtle)', background: 'rgba(183,53,39,0.05)' }}>
          <div style={{ fontSize: '10px', fontFamily: 'var(--font-display)', fontWeight: 700, letterSpacing: '2px', textTransform: 'uppercase', color: 'var(--brand-red)', marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Scale size={12} /> Pesagem Pendente
          </div>
          {items.filter(i => i.chosen_label && !i.real_grams).map((item: any, idx: number) => (
            <WeighingForm key={idx} orderId={order.id} item={item} onDone={onRefresh} />
          ))}
        </div>
      )}

      {/* Total */}
      <div style={{
        padding: '14px 18px', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        background: 'rgba(199,173,112,0.06)'
      }}>
        <span style={{ fontSize: '11px', color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '1px' }}>Total</span>
        <span style={{ fontFamily: 'var(--font-display)', fontSize: '22px', fontWeight: 800, color: 'var(--brand-gold)' }}>
          R$ {Number(order.total).toFixed(2).replace('.',',')}
        </span>
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
    const f = e.target.files?.[0]; if (!f) return
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
        const { data: urlData } = supabase.storage.from('churras-media').getPublicUrl(path)
        photoUrl = urlData.publicUrl
      }
    }

    const finalPrice = calcFinal()

    const { data: orderData } = await supabase
      .from('orders')
      .select('items, total')
      .eq('id', orderId)
      .single()

    const allItems: any[] = orderData?.items ?? []
    const otherItemsTotal = allItems
      .filter((i: any) => !(i.name === item.name && i.chosen_label === item.chosen_label))
      .reduce((s: number, i: any) => {
        const itemPrice = i.final_price !== null && i.final_price !== undefined
          ? Number(i.final_price)
          : Number(i.unit_price ?? i.price ?? 0)
        return s + (itemPrice * (i.quantity ?? 1))
      }, 0)
    const newTotal = Math.round((otherItemsTotal + finalPrice) * 100) / 100

    const updatedItems = allItems.map((i: any) => 
      (i.name === item.name && i.chosen_label === item.chosen_label)
        ? { ...i, real_grams: parseInt(realGrams), final_price: finalPrice }
        : i
    )
    const allWeighed = updatedItems.filter((i: any) => i.chosen_label).every((i: any) => i.real_grams)
    const newStatus = allWeighed ? 'awaiting_payment' : 'awaiting_weighing'
    
    await supabase.from('orders').update({ 
      total: newTotal, 
      status: newStatus,
      items: updatedItems
    }).eq('id', orderId)
    
    await supabase.from('order_notifications').insert({
      order_id: orderId,
      type: 'weight_update',
      message: `Seu ${item.name} pesou ${realGrams}g.${discount > 0 ? ` Desconto de R$ ${discount.toFixed(2).replace('.', ',')} aplicado!` : ''} Total do pedido: R$ ${newTotal.toFixed(2).replace('.', ',')}`,
      photo_url: photoUrl,
      real_grams: parseInt(realGrams),
      final_price: finalPrice,
      order_total: newTotal,
    })

    setSaving(false)
    onDone()
  }

  return (
    <div style={{
      background: 'rgba(183,53,39,0.08)', border: '1px solid rgba(183,53,39,0.25)',
      borderRadius: '10px', padding: '14px', marginBottom: '10px'
    }}>
      <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '2px' }}>{item.name}</div>
      <div style={{ fontSize: '11px', color: 'var(--text-dim)', marginBottom: '10px' }}>
        Faixa: {item.chosen_label} (até {maxGrams}g) • R$ {Number(unitPrice).toFixed(2).replace('.',',')}
      </div>
      <div style={{ display: 'flex', gap: '10px', marginBottom: '10px', alignItems: 'flex-end' }}>
        <div style={{ flex: 1 }}>
          <label style={{ fontSize: '10px', color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '1px', display: 'block', marginBottom: '4px' }}>
            Peso real (g)
          </label>
          <input
            type="number"
            value={realGrams}
            onChange={e => setRealGrams(e.target.value)}
            placeholder="ex: 1050"
            style={{ width: '100%', padding: '8px 10px' }}
          />
        </div>
        {realGrams && (
          <div style={{ textAlign: 'right', paddingBottom: '2px' }}>
            <div style={{ fontSize: '10px', color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '2px' }}>Final</div>
            <div style={{ fontSize: '15px', fontWeight: 800, fontFamily: 'var(--font-display)', color: 'var(--brand-gold)' }}>
              R$ {calcFinal().toFixed(2).replace('.',',')}
            </div>
            {discount > 0 && (
              <div style={{ fontSize: '10px', color: '#e05050' }}>-R$ {discount.toFixed(2).replace('.',',')}</div>
            )}
          </div>
        )}
      </div>

      <div
        onClick={() => fileRef.current?.click()}
        style={{
          border: '1px dashed var(--border-medium)', borderRadius: '8px',
          padding: '10px', display: 'flex', alignItems: 'center', gap: '10px',
          cursor: 'pointer', marginBottom: '10px', transition: 'border-color 0.15s'
        }}
      >
        {photoPreview ? (
          <img src={photoPreview} style={{ width: '48px', height: '48px', borderRadius: '6px', objectFit: 'cover', flexShrink: 0 }} />
        ) : (
          <div style={{
            width: '48px', height: '48px', background: 'rgba(255,240,222,0.05)',
            borderRadius: '6px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0
          }}>
            <Camera size={18} style={{ color: 'var(--text-dim)' }} />
          </div>
        )}
        <div>
          <div style={{ fontSize: '12px', fontWeight: 500, color: 'var(--text-muted)' }}>Foto da balança</div>
          <div style={{ fontSize: '10px', color: 'var(--text-dim)' }}>Clique para adicionar</div>
        </div>
        <input ref={fileRef} type="file" accept="image/*" capture="environment" onChange={handlePhoto} style={{ display: 'none' }} />
      </div>

      <button
        onClick={handleSave}
        disabled={!realGrams || saving}
        style={{
          width: '100%', padding: '9px',
          background: !realGrams || saving ? 'rgba(183,53,39,0.2)' : 'var(--brand-red)',
          border: '1px solid rgba(183,53,39,0.5)',
          borderRadius: '8px', color: 'var(--brand-cream)',
          fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '12px',
          letterSpacing: '1px', textTransform: 'uppercase',
          cursor: !realGrams || saving ? 'not-allowed' : 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
          opacity: !realGrams || saving ? 0.5 : 1, transition: 'all 0.15s'
        }}
      >
        {saving ? <RefreshCw size={13} style={{ animation: 'spin 1s linear infinite' }} /> : <Save size={13} />}
        {saving ? 'Salvando...' : 'Confirmar Pesagem'}
      </button>
    </div>
  )
}

// ─── MENU TAB ─────────────────────────────────────────────────

function MenuTab({ profile }: { profile: Profile }) {
  const [items, setItems] = useState<MenuItem[]>([])
  const [editing, setEditing] = useState<MenuItem | null>(null)
  const [isNew, setIsNew] = useState(false)
  const [loading, setLoading] = useState(true)
  const [filterCat, setFilterCat] = useState('Todos')

  const fetchMenu = async () => {
    setLoading(true)
    const { data } = await supabase.from('menu_items').select('*, weight_options(*)').order('sort_order')
    setItems(data ?? [])
    setLoading(false)
  }

  useEffect(() => { fetchMenu() }, [])

  const handleDelete = async (id: string) => {
    if (!confirm('Remover este item do cardápio?')) return
    await supabase.from('menu_items').delete().eq('id', id)
    fetchMenu()
  }

  const handleToggleAvailable = async (item: MenuItem) => {
    await supabase.from('menu_items').update({ available: !item.available }).eq('id', item.id)
    fetchMenu()
  }

  const handleNew = () => {
    setEditing({
      id: '', name: '', category: 'Carnes', description: '', price: 0,
      image_url: '', available: true, weight_mode: false, sort_order: 0,
      weight_options: []
    })
    setIsNew(true)
  }

  const CATS = ['Todos', 'Carnes', 'Acompanhamentos', 'Bebidas']
  const filtered = filterCat === 'Todos' ? items : items.filter(i => i.category === filterCat)

  return (
    <Page
      title="Cardápio"
      subtitle="NOSSO sabor, SEU ponto de encontro"
      action={
        profile.permissions?.manage_menu ? (
          <GoldButton onClick={handleNew}>
            <Plus size={14} /> Novo Item
          </GoldButton>
        ) : undefined
      }
    >
      {/* Category filter */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '24px' }}>
        {CATS.map(c => (
          <button
            key={c}
            onClick={() => setFilterCat(c)}
            style={{
              padding: '8px 18px', borderRadius: '20px', fontSize: '12px',
              fontWeight: 700, fontFamily: 'var(--font-display)', letterSpacing: '1px', textTransform: 'uppercase',
              cursor: 'pointer', transition: 'all 0.15s',
              background: filterCat === c ? 'var(--brand-red)' : 'var(--surface-2)',
              border: filterCat === c ? '1px solid var(--brand-red)' : '1px solid var(--border-subtle)',
              color: filterCat === c ? 'var(--brand-cream)' : 'var(--text-muted)'
            }}
          >
            {c}
          </button>
        ))}
      </div>

      {loading && (
        <div style={{ textAlign: 'center', padding: '48px', color: 'var(--text-dim)', fontSize: '13px' }}>
          Carregando cardápio...
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '16px' }}>
        {filtered.map(item => (
          <div
            key={item.id}
            style={{
              background: 'var(--surface-2)',
              border: `1px solid ${item.available ? 'var(--border-subtle)' : 'rgba(255,240,222,0.04)'}`,
              borderRadius: '14px', overflow: 'hidden',
              opacity: item.available ? 1 : 0.55, transition: 'opacity 0.2s'
            }}
          >
            <div style={{ height: '140px', position: 'relative', background: 'var(--surface-3)' }}>
              {item.image_url ? (
                <img src={item.image_url} alt={item.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              ) : (
                <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Image size={28} style={{ color: 'var(--text-dim)' }} />
                </div>
              )}
              {/* Overlay badges */}
              <div style={{ position: 'absolute', top: '8px', right: '8px', display: 'flex', gap: '4px' }}>
                {item.weight_mode && (
                  <span style={{
                    background: 'rgba(183,53,39,0.9)', color: 'var(--brand-cream)',
                    fontSize: '9px', fontWeight: 700, fontFamily: 'var(--font-display)',
                    padding: '3px 8px', borderRadius: '20px',
                    display: 'flex', alignItems: 'center', gap: '3px', letterSpacing: '0.5px', textTransform: 'uppercase'
                  }}>
                    <Scale size={9} /> Pesagem
                  </span>
                )}
                <span style={{
                  background: item.available ? 'rgba(93,186,117,0.9)' : 'rgba(183,53,39,0.9)',
                  color: 'var(--brand-cream)', fontSize: '9px', fontWeight: 700,
                  fontFamily: 'var(--font-display)', letterSpacing: '0.5px', textTransform: 'uppercase',
                  padding: '3px 8px', borderRadius: '20px'
                }}>
                  {item.available ? 'Disponível' : 'Indisponível'}
                </span>
              </div>
            </div>
            <div style={{ padding: '14px 16px' }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '8px', marginBottom: '4px' }}>
                <h3 style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '16px', color: 'var(--text-primary)', textTransform: 'uppercase', lineHeight: 1.2 }}>
                  {item.name}
                </h3>
                <div style={{ fontFamily: 'var(--font-display)', fontSize: '17px', fontWeight: 800, color: 'var(--brand-gold)', whiteSpace: 'nowrap' }}>
                  R$ {Number(item.price).toFixed(2).replace('.',',')}
                </div>
              </div>
              <div style={{ fontSize: '10px', color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '4px', fontWeight: 600 }}>
                {item.category}
              </div>
              {item.weight_mode && item.weight_options && item.weight_options.length > 0 && (
                <div style={{ fontSize: '11px', color: 'var(--brand-gold)', opacity: 0.8 }}>
                  {item.weight_options.length} faixa{item.weight_options.length > 1 ? 's' : ''} de peso
                </div>
              )}
              {profile.permissions?.manage_menu && (
                <div style={{ display: 'flex', gap: '6px', marginTop: '12px' }}>
                  <button
                    onClick={() => { setEditing(item); setIsNew(false) }}
                    style={{
                      flex: 1, padding: '7px', borderRadius: '6px',
                      background: 'rgba(255,240,222,0.05)', border: '1px solid var(--border-subtle)',
                      color: 'var(--text-muted)', cursor: 'pointer', fontSize: '11px',
                      fontFamily: 'var(--font-display)', fontWeight: 700, letterSpacing: '0.5px', textTransform: 'uppercase',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '5px', transition: 'all 0.15s'
                    }}
                  >
                    <Edit2 size={11} /> Editar
                  </button>
                  <button
                    onClick={() => handleToggleAvailable(item)}
                    style={{
                      flex: 1, padding: '7px', borderRadius: '6px',
                      background: 'rgba(255,240,222,0.05)', border: '1px solid var(--border-subtle)',
                      color: 'var(--text-muted)', cursor: 'pointer', fontSize: '11px',
                      fontFamily: 'var(--font-display)', fontWeight: 700, letterSpacing: '0.5px', textTransform: 'uppercase',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '5px', transition: 'all 0.15s'
                    }}
                  >
                    {item.available ? <ToggleRight size={11} style={{ color: '#5dba75' }} /> : <ToggleLeft size={11} style={{ color: 'var(--brand-red)' }} />}
                    {item.available ? 'Desativar' : 'Ativar'}
                  </button>
                  <button
                    onClick={() => handleDelete(item.id)}
                    style={{
                      padding: '7px 10px', borderRadius: '6px',
                      background: 'rgba(183,53,39,0.08)', border: '1px solid rgba(183,53,39,0.2)',
                      color: 'var(--brand-red)', cursor: 'pointer', display: 'flex', alignItems: 'center', transition: 'all 0.15s'
                    }}
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      <AnimatePresence>
        {editing && <MenuItemModal item={editing} isNew={isNew} onClose={() => setEditing(null)} onSave={fetchMenu} />}
      </AnimatePresence>
    </Page>
  )
}

// ─── MENU ITEM MODAL ──────────────────────────────────────────

function MenuItemModal({ item, isNew, onClose, onSave }: {
  item: MenuItem; isNew: boolean; onClose: () => void; onSave: () => void
}) {
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

  const [validationError, setValidationError] = useState<string | null>(null)

const handleSave = async () => {
    setValidationError(null)

    if (form.weight_mode) {
      if (!form.weight_options || form.weight_options.length === 0) {
        setValidationError('Ative faixas de peso: adicione ao menos 1 faixa antes de salvar.')
        return
      }
      const invalid = form.weight_options.some(o =>
        !o.label?.trim() ||
        !o.max_grams || Number(o.max_grams) <= 0 ||
        o.price === undefined || o.price === null || Number(o.price) <= 0
      )
      if (invalid) {
        setValidationError('Preencha Label, Máx. (g) e Preço em todas as faixas de peso (valores maiores que zero).')
        return
      }
    }

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

    if (form.weight_mode && itemId && form.weight_options) {
      await supabase.from('weight_options').delete().eq('menu_item_id', itemId)
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

  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '10px 12px', fontSize: '13px',
    background: 'rgba(255,240,222,0.04)', border: '1px solid var(--border-subtle)',
    borderRadius: '8px', color: 'var(--text-primary)', fontFamily: 'var(--font-body)'
  }

  const labelStyle: React.CSSProperties = {
    fontSize: '10px', color: 'var(--text-dim)', textTransform: 'uppercase',
    letterSpacing: '1.5px', fontWeight: 700, display: 'block', marginBottom: '5px',
    fontFamily: 'var(--font-display)'
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
      style={{
        position: 'fixed', inset: 0, background: 'rgba(26,9,5,0.85)',
        zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '24px', backdropFilter: 'blur(4px)'
      }}
    >
      <motion.div
        initial={{ scale: 0.95, y: 16 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.95, y: 16 }}
        style={{
          background: 'var(--surface-2)', border: '1px solid var(--border-medium)',
          borderRadius: '18px', width: '100%', maxWidth: '600px',
          maxHeight: '90vh', overflowY: 'auto',
          boxShadow: '0 24px 80px rgba(26,9,5,0.8)'
        }}
      >
        {/* Modal Header */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '20px 24px', borderBottom: '1px solid var(--border-subtle)'
        }}>
          <div>
            <h2 style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: '22px', textTransform: 'uppercase', color: 'var(--text-primary)' }}>
              {isNew ? 'Novo Item' : 'Editar Item'}
            </h2>
            <StarDivider />
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'transparent', border: '1px solid var(--border-subtle)',
              borderRadius: '8px', padding: '6px', cursor: 'pointer',
              color: 'var(--text-muted)', display: 'flex', alignItems: 'center'
            }}
          >
            <X size={16} />
          </button>
        </div>

        <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '18px' }}>
          {/* Image Upload */}
          <div
            onClick={() => fileRef.current?.click()}
            style={{
              height: '150px', borderRadius: '12px', overflow: 'hidden',
              border: '1px dashed var(--border-medium)', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: 'var(--surface-3)', transition: 'border-color 0.15s',
              position: 'relative'
            }}
          >
            {imagePreview ? (
              <img src={imagePreview} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px', color: 'var(--text-dim)' }}>
                <Upload size={24} />
                <span style={{ fontSize: '12px', fontFamily: 'var(--font-display)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '1px' }}>
                  Clique para adicionar foto
                </span>
              </div>
            )}
            <input ref={fileRef} type="file" accept="image/*" onChange={handleImage} style={{ display: 'none' }} />
          </div>

          {/* Fields */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
            <div style={{ gridColumn: '1 / -1' }}>
              <label style={labelStyle}>Nome do Item</label>
              <input value={form.name} onChange={e => set('name', e.target.value)} placeholder="Nome do item" style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>Categoria</label>
              <select value={form.category} onChange={e => set('category', e.target.value)} style={inputStyle}>
                <option>Carnes</option>
                <option>Acompanhamentos</option>
                <option>Bebidas</option>
              </select>
            </div>
            <div>
              <label style={labelStyle}>Preço base (R$)</label>
              <input type="number" step="0.01" value={form.price} onChange={e => set('price', e.target.value)} placeholder="0,00" style={inputStyle} />
            </div>
            <div style={{ gridColumn: '1 / -1' }}>
              <label style={labelStyle}>Descrição</label>
              <textarea value={form.description} onChange={e => set('description', e.target.value)} rows={2}
                placeholder="Descrição do item" style={{ ...inputStyle, resize: 'none' }} />
            </div>
          </div>

          {/* Weight mode — somente carnes */}
          {form.category === 'Carnes' && (
            <div style={{
              background: 'rgba(183,53,39,0.07)', border: '1px solid rgba(183,53,39,0.2)',
              borderRadius: '12px', padding: '18px'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: form.weight_mode ? '14px' : '0' }}>
                <div>
                  <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '14px', textTransform: 'uppercase', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Scale size={14} style={{ color: 'var(--brand-red)' }} /> Modo Pesagem
                  </div>
                  <div style={{ fontSize: '11px', color: 'var(--text-dim)', marginTop: '2px' }}>
                    Ativa seleção de faixas e pesagem pelo admin
                  </div>
                </div>
                <button
                  onClick={() => set('weight_mode', !form.weight_mode)}
                  style={{
                    width: '44px', height: '24px', borderRadius: '12px',
                    background: form.weight_mode ? 'var(--brand-red)' : 'var(--surface-3)',
                    border: `1px solid ${form.weight_mode ? 'var(--brand-red)' : 'var(--border-medium)'}`,
                    cursor: 'pointer', position: 'relative', flexShrink: 0, transition: 'all 0.2s'
                  }}
                >
                  <div style={{
                    position: 'absolute', top: '3px',
                    left: form.weight_mode ? '22px' : '3px',
                    width: '16px', height: '16px', borderRadius: '50%',
                    background: 'var(--brand-cream)', transition: 'left 0.2s'
                  }} />
                </button>
              </div>

              {form.weight_mode && (
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
                    <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '1px' }}>Faixas de Peso</span>
                    <button
                      onClick={addWeightOption}
                      style={{
                        display: 'flex', alignItems: 'center', gap: '4px',
                        background: 'transparent', border: 'none', color: 'var(--brand-gold)',
                        cursor: 'pointer', fontSize: '11px', fontFamily: 'var(--font-display)',
                        fontWeight: 700, letterSpacing: '0.5px', textTransform: 'uppercase'
                      }}
                    >
                      <Plus size={11} /> Adicionar
                    </button>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {form.weight_options?.map((opt, i) => (
                      <div key={i} style={{
                        background: 'rgba(26,9,5,0.3)', borderRadius: '10px',
                        padding: '12px', display: 'grid', gridTemplateColumns: '1fr 1fr 1fr auto', gap: '8px', alignItems: 'end'
                      }}>
                        <div>
                          <label style={{ ...labelStyle, marginBottom: '4px' }}>Label</label>
                          <input value={opt.label} onChange={e => updateWeightOption(i, 'label', e.target.value)}
                            placeholder="ex: Até 800g" style={{ ...inputStyle, padding: '7px 10px', fontSize: '12px' }} />
                        </div>
                        <div>
                          <label style={{ ...labelStyle, marginBottom: '4px' }}>Máx. (g)</label>
                          <input type="number" value={opt.max_grams} onChange={e => updateWeightOption(i, 'max_grams', e.target.value)}
                            placeholder="800" style={{ ...inputStyle, padding: '7px 10px', fontSize: '12px' }} />
                        </div>
                        <div>
                          <label style={{ ...labelStyle, marginBottom: '4px' }}>Preço (R$)</label>
                          <input type="number" step="0.01" value={opt.price} onChange={e => updateWeightOption(i, 'price', e.target.value)}
                            placeholder="149,90" style={{ ...inputStyle, padding: '7px 10px', fontSize: '12px' }} />
                        </div>
                        <button onClick={() => removeWeightOption(i)} style={{
                          background: 'transparent', border: 'none', color: 'var(--brand-red)',
                          cursor: 'pointer', padding: '4px', display: 'flex', alignItems: 'center',
                          marginBottom: '1px'
                        }}>
                          <X size={13} />
                        </button>
                      </div>
                    ))}
                    {form.weight_options?.length === 0 && (
                      <div style={{ textAlign: 'center', padding: '16px', fontSize: '12px', color: 'var(--text-dim)' }}>
                        Nenhuma faixa adicionada ainda
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        {validationError && (
          <div style={{
            margin: '0 24px 12px', padding: '10px 14px',
            background: 'rgba(183,53,39,0.12)', border: '1px solid rgba(183,53,39,0.35)',
            borderRadius: '8px', color: 'var(--brand-red)', fontSize: '12px', fontWeight: 600
          }}>
            {validationError}
          </div>
        )}
        <div style={{ padding: '16px 24px', borderTop: '1px solid var(--border-subtle)', display: 'flex', gap: '10px' }}>
          <button
            onClick={onClose}
            style={{
              flex: 1, padding: '10px', borderRadius: '8px',
              background: 'transparent', border: '1px solid var(--border-subtle)',
              color: 'var(--text-muted)', cursor: 'pointer',
              fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '13px',
              letterSpacing: '1px', textTransform: 'uppercase', transition: 'all 0.15s'
            }}
          >
            Cancelar
          </button>
          <button
            onClick={handleSave}
            disabled={saving || !form.name || (form.weight_mode && (!form.weight_options || form.weight_options.length === 0))}
            style={{
              flex: 1, padding: '10px', borderRadius: '8px',
              background: saving || !form.name ? 'rgba(183,53,39,0.3)' : 'var(--brand-red)',
              border: '1px solid rgba(183,53,39,0.5)',
              color: 'var(--brand-cream)', cursor: saving || !form.name ? 'not-allowed' : 'pointer',
              fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '13px',
              letterSpacing: '1px', textTransform: 'uppercase',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
              opacity: saving || !form.name ? 0.6 : 1, transition: 'all 0.15s'
            }}
          >
            {saving ? <RefreshCw size={14} /> : <Save size={14} />}
            {saving ? 'Salvando...' : 'Salvar Item'}
          </button>
        </div>
      </motion.div>
    </motion.div>
  )
}

// ─── COUPONS TAB ──────────────────────────────────────────────

function CouponsTab({ profile }: { profile: Profile }) {
  const [subTab, setSubTab] = useState<'fidelity' | 'manual' | 'validate'>('fidelity')

  return (
    <Page title="Cupons" subtitle="Fidelidade, promoções e validação presencial">
      {/* Sub-tabs */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '24px' }}>
        {[
          ['fidelity', 'Fidelidade'],
          ['manual', 'Cupons Manuais'],
          ['validate', 'Validar Cupom'],
        ].map(([key, label]) => (
          <button
            key={key}
            onClick={() => setSubTab(key as any)}
            style={{
              padding: '8px 18px', borderRadius: '20px', fontSize: '12px',
              fontWeight: 700, fontFamily: 'var(--font-display)', letterSpacing: '1px', textTransform: 'uppercase',
              cursor: 'pointer', transition: 'all 0.15s',
              background: subTab === key ? 'var(--brand-red)' : 'var(--surface-2)',
              border: subTab === key ? '1px solid var(--brand-red)' : '1px solid var(--border-subtle)',
              color: subTab === key ? 'var(--brand-cream)' : 'var(--text-muted)'
            }}
          >
            {label}
          </button>
        ))}
      </div>

      {subTab === 'fidelity' && <FidelityCouponsSubTab />}
      {subTab === 'manual' && <ManualCouponsSubTab canManage={!!profile.permissions?.manage_coupons} />}
      {subTab === 'validate' && <ValidateCouponSubTab />}
    </Page>
  )
}

function FidelityStats({ coupons }: { coupons: any[] }) {
  const isMobile = useIsMobile()
  return (
    <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'repeat(2,1fr)' : 'repeat(3,1fr)', gap: '12px', marginBottom: '24px' }}>
      <StatCard icon={Ticket}      label="Total gerados" value={coupons.length}                             color="var(--brand-red)" />
      <StatCard icon={CheckCircle} label="Resgatados"    value={coupons.filter(c => c.redeemed).length}    color="var(--brand-gold)" />
      <StatCard icon={Clock}       label="Disponíveis"   value={coupons.filter(c => !c.redeemed).length}   color="var(--brand-gold)" />
    </div>
  )
}

// ─── FIDELITY COUPONS ─────────────────────────────────────────

function FidelityCouponsSubTab() {
  const [coupons, setCoupons] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  const fetchCoupons = async () => {
    setLoading(true)
    const { data } = await supabase
      .from('fidelity_coupons')
      .select('*, profiles(full_name)')
      .order('created_at', { ascending: false })
    setCoupons(data ?? [])
    setLoading(false)
  }

  useEffect(() => { fetchCoupons() }, [])

  const handleRedeem = async (id: string) => {
    await supabase.from('fidelity_coupons').update({ redeemed: true, redeemed_at: new Date().toISOString() }).eq('id', id)
    fetchCoupons()
  }

  const handleRevoke = async (id: string) => {
    if (!confirm('Revogar este cupom?')) return
    await supabase.from('fidelity_coupons').delete().eq('id', id)
    fetchCoupons()
  }

  return (
    <div>
      <FidelityStats coupons={coupons} />

      {loading && <div style={{ textAlign: 'center', padding: '48px', color: 'var(--text-dim)', fontSize: '13px' }}>Carregando...</div>}

      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {coupons.map(coupon => (
          <div key={coupon.id} style={{
            background: 'var(--surface-2)', border: '1px solid var(--border-subtle)',
            borderRadius: '12px', padding: '16px 20px',
            display: 'flex', alignItems: 'center', gap: '14px'
          }}>
            <div style={{
              width: '36px', height: '36px', borderRadius: '8px', flexShrink: 0,
              background: coupon.redeemed ? 'rgba(93,186,117,0.15)' : 'rgba(183,53,39,0.15)',
              display: 'flex', alignItems: 'center', justifyContent: 'center'
            }}>
              <Ticket size={16} style={{ color: coupon.redeemed ? '#5dba75' : 'var(--brand-red)' }} />
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontFamily: 'var(--font-display)', fontSize: '15px', fontWeight: 700, color: 'var(--brand-gold)', letterSpacing: '2px' }}>
                {coupon.code}
              </div>
              <div style={{ fontSize: '11px', color: 'var(--text-dim)', marginTop: '2px' }}>
                {coupon.profiles?.full_name ?? 'Cliente'} • {new Date(coupon.created_at).toLocaleDateString('pt-BR')}
                {coupon.redeemed && coupon.redeemed_at && ` • Resgatado em ${new Date(coupon.redeemed_at).toLocaleDateString('pt-BR')}`}
              </div>
            </div>
            <div style={{
              padding: '4px 12px', borderRadius: '20px', fontSize: '10px',
              fontWeight: 700, fontFamily: 'var(--font-display)', letterSpacing: '0.5px', textTransform: 'uppercase',
              background: coupon.redeemed ? 'rgba(93,186,117,0.15)' : 'rgba(199,173,112,0.15)',
              color: coupon.redeemed ? '#5dba75' : 'var(--brand-gold)',
              border: `1px solid ${coupon.redeemed ? 'rgba(93,186,117,0.3)' : 'rgba(199,173,112,0.3)'}`
            }}>
              {coupon.redeemed ? 'Resgatado' : 'Disponível'}
            </div>
            {!coupon.redeemed && (
              <div style={{ display: 'flex', gap: '6px' }}>
                <button onClick={() => handleRedeem(coupon.id)} style={{
                  padding: '6px 14px', borderRadius: '6px',
                  background: 'rgba(93,186,117,0.1)', border: '1px solid rgba(93,186,117,0.3)',
                  color: '#5dba75', cursor: 'pointer', fontSize: '11px',
                  fontFamily: 'var(--font-display)', fontWeight: 700, letterSpacing: '0.5px', textTransform: 'uppercase'
                }}>
                  Resgatar
                </button>
                <button onClick={() => handleRevoke(coupon.id)} style={{
                  padding: '6px 14px', borderRadius: '6px',
                  background: 'rgba(183,53,39,0.08)', border: '1px solid rgba(183,53,39,0.25)',
                  color: 'var(--brand-red)', cursor: 'pointer', fontSize: '11px',
                  fontFamily: 'var(--font-display)', fontWeight: 700, letterSpacing: '0.5px', textTransform: 'uppercase'
                }}>
                  Revogar
                </button>
              </div>
            )}
          </div>
        ))}
        {!loading && coupons.length === 0 && (
          <div style={{ textAlign: 'center', padding: '64px', color: 'var(--text-dim)', fontSize: '13px' }}>
            Nenhum cupom de fidelidade gerado ainda.
          </div>
        )}
      </div>
    </div>
  )
}

// ─── MANUAL COUPONS ───────────────────────────────────────────

function ManualCouponsSubTab({ canManage }: { canManage: boolean }) {
  const [coupons, setCoupons] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({
    code: '', type: 'fixed', discount_value: '', free_item_description: '',
    max_uses: '1', expires_at: ''
  })
  const [saving, setSaving] = useState(false)

  const fetchCoupons = async () => {
    setLoading(true)
    const { data } = await supabase.from('coupons').select('*').order('created_at', { ascending: false })
    setCoupons(data ?? [])
    setLoading(false)
  }

  useEffect(() => { fetchCoupons() }, [])

  const handleSave = async () => {
    if (!form.code) return
    setSaving(true)
    await supabase.from('coupons').insert({
      code: form.code.toUpperCase().trim(),
      type: form.type,
      discount_value: form.discount_value ? Number(form.discount_value) : null,
      free_item_description: form.free_item_description || null,
      max_uses: Number(form.max_uses),
      expires_at: form.expires_at ? new Date(form.expires_at).toISOString() : null,
      active: true,
    })
    setSaving(false)
    setShowForm(false)
    setForm({ code: '', type: 'fixed', discount_value: '', free_item_description: '', max_uses: '1', expires_at: '' })
    fetchCoupons()
  }

  const handleToggle = async (id: string, active: boolean) => {
    await supabase.from('coupons').update({ active: !active }).eq('id', id)
    fetchCoupons()
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Excluir este cupom?')) return
    await supabase.from('coupons').delete().eq('id', id)
    fetchCoupons()
  }

  const typeLabel = (type: string) => ({ fixed: 'R$ Fixo', percent: '% Desconto', free_item: 'Item Grátis' }[type] ?? type)

  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '9px 12px', fontSize: '13px',
    background: 'rgba(255,240,222,0.04)', border: '1px solid var(--border-subtle)',
    borderRadius: '8px', color: 'var(--text-primary)', fontFamily: 'var(--font-body)'
  }

  const labelStyle: React.CSSProperties = {
    fontSize: '10px', color: 'var(--text-dim)', textTransform: 'uppercase',
    letterSpacing: '1.5px', fontWeight: 700, display: 'block', marginBottom: '5px',
    fontFamily: 'var(--font-display)'
  }

  return (
    <div>
      {canManage && (
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '16px' }}>
          <GoldButton onClick={() => setShowForm(v => !v)} small>
            <Plus size={13} /> {showForm ? 'Cancelar' : 'Novo Cupom'}
          </GoldButton>
        </div>
      )}

      {showForm && (
        <div style={{
          background: 'var(--surface-2)', border: '1px solid var(--border-medium)',
          borderRadius: '14px', padding: '20px', marginBottom: '20px'
        }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
            <div>
              <label style={labelStyle}>Código</label>
              <input value={form.code} onChange={e => setForm(f => ({ ...f, code: e.target.value }))}
                placeholder="EX: PROMO20" style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>Tipo</label>
              <select value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value }))} style={inputStyle}>
                <option value="fixed">R$ Fixo</option>
                <option value="percent">% Desconto</option>
                <option value="free_item">Item Grátis</option>
              </select>
            </div>
            {(form.type === 'fixed' || form.type === 'percent') && (
              <div>
                <label style={labelStyle}>{form.type === 'fixed' ? 'Valor (R$)' : 'Percentual (%)'}</label>
                <input type="number" value={form.discount_value}
                  onChange={e => setForm(f => ({ ...f, discount_value: e.target.value }))}
                  placeholder={form.type === 'fixed' ? '20.00' : '10'} style={inputStyle} />
              </div>
            )}
            {form.type === 'free_item' && (
              <div>
                <label style={labelStyle}>Descrição do Item Grátis</label>
                <input value={form.free_item_description}
                  onChange={e => setForm(f => ({ ...f, free_item_description: e.target.value }))}
                  placeholder="ex: Porção de Farofa" style={inputStyle} />
              </div>
            )}
            <div>
              <label style={labelStyle}>Máx. de Usos</label>
              <input type="number" value={form.max_uses}
                onChange={e => setForm(f => ({ ...f, max_uses: e.target.value }))}
                placeholder="1" style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>Expira em</label>
              <input type="datetime-local" value={form.expires_at}
                onChange={e => setForm(f => ({ ...f, expires_at: e.target.value }))} style={inputStyle} />
            </div>
          </div>
          <div style={{ marginTop: '16px', display: 'flex', justifyContent: 'flex-end' }}>
            <GoldButton onClick={handleSave} disabled={saving || !form.code} small>
              <Save size={13} /> {saving ? 'Salvando...' : 'Criar Cupom'}
            </GoldButton>
          </div>
        </div>
      )}

      {loading && <div style={{ textAlign: 'center', padding: '48px', color: 'var(--text-dim)', fontSize: '13px' }}>Carregando...</div>}

      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {coupons.map(coupon => {
          const expired = coupon.expires_at && new Date(coupon.expires_at) < new Date()
          const exhausted = coupon.used_count >= coupon.max_uses
          const statusColor = !coupon.active || expired || exhausted ? 'var(--brand-red)' : '#5dba75'
          const statusLabel = !coupon.active ? 'Inativo' : expired ? 'Expirado' : exhausted ? 'Esgotado' : 'Ativo'

          return (
            <div key={coupon.id} style={{
              background: 'var(--surface-2)', border: '1px solid var(--border-subtle)',
              borderRadius: '12px', padding: '14px 18px',
              display: 'flex', alignItems: 'center', gap: '14px',
              opacity: !coupon.active || expired || exhausted ? 0.6 : 1
            }}>
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '4px' }}>
                  <span style={{ fontFamily: 'var(--font-display)', fontSize: '15px', fontWeight: 700, color: 'var(--brand-gold)', letterSpacing: '2px' }}>
                    {coupon.code}
                  </span>
                  <span style={{
                    padding: '2px 8px', borderRadius: '20px', fontSize: '9px',
                    fontWeight: 700, fontFamily: 'var(--font-display)', textTransform: 'uppercase', letterSpacing: '0.5px',
                    color: statusColor, background: `${statusColor}18`, border: `1px solid ${statusColor}30`
                  }}>
                    {statusLabel}
                  </span>
                </div>
                <div style={{ fontSize: '11px', color: 'var(--text-dim)', display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                  <span>{typeLabel(coupon.type)}{coupon.discount_value ? `: ${coupon.type === 'fixed' ? 'R$ ' : ''}${coupon.discount_value}${coupon.type === 'percent' ? '%' : ''}` : ''}{coupon.free_item_description ? `: ${coupon.free_item_description}` : ''}</span>
                  <span>Usos: {coupon.used_count}/{coupon.max_uses}</span>
                  {coupon.expires_at && <span>Expira: {new Date(coupon.expires_at).toLocaleDateString('pt-BR')}</span>}
                </div>
              </div>
              <div style={{ display: 'flex', gap: '6px' }}>
                <button onClick={() => handleToggle(coupon.id, coupon.active)} style={{
                  padding: '6px 12px', borderRadius: '6px',
                  background: coupon.active ? 'rgba(183,53,39,0.08)' : 'rgba(93,186,117,0.08)',
                  border: `1px solid ${coupon.active ? 'rgba(183,53,39,0.25)' : 'rgba(93,186,117,0.25)'}`,
                  color: coupon.active ? 'var(--brand-red)' : '#5dba75',
                  cursor: 'pointer', fontSize: '11px',
                  fontFamily: 'var(--font-display)', fontWeight: 700, textTransform: 'uppercase'
                }}>
                  {coupon.active ? 'Desativar' : 'Ativar'}
                </button>
                <button onClick={() => handleDelete(coupon.id)} style={{
                  padding: '6px 10px', borderRadius: '6px',
                  background: 'rgba(183,53,39,0.08)', border: '1px solid rgba(183,53,39,0.25)',
                  color: 'var(--brand-red)', cursor: 'pointer',
                  display: 'flex', alignItems: 'center'
                }}>
                  <Trash2 size={12} />
                </button>
              </div>
            </div>
          )
        })}
        {!loading && coupons.length === 0 && (
          <div style={{ textAlign: 'center', padding: '64px', color: 'var(--text-dim)', fontSize: '13px' }}>
            Nenhum cupom manual criado ainda.
          </div>
        )}
      </div>
    </div>
  )
}

// ─── VALIDATE COUPON ──────────────────────────────────────────

function ValidateCouponSubTab() {
  const [code, setCode] = useState('')
  const [result, setResult] = useState<any>(null)
  const [notFound, setNotFound] = useState(false)
  const [redeeming, setRedeeming] = useState(false)
  const [redeemed, setRedeemed] = useState(false)

  const handleSearch = async () => {
    setResult(null)
    setNotFound(false)
    setRedeemed(false)

    const upperCode = code.toUpperCase().trim()

    // Checa fidelity_coupons
    const { data: fidelity } = await supabase
      .from('fidelity_coupons')
      .select('*, profiles(full_name)')
      .eq('code', upperCode)
      .maybeSingle()

    if (fidelity) {
      setResult({ source: 'fidelity', ...fidelity })
      return
    }

    // Checa coupons manuais
    const { data: manual } = await supabase
      .from('coupons')
      .select('*')
      .eq('code', upperCode)
      .maybeSingle()

    if (manual) {
      setResult({ source: 'manual', ...manual })
      return
    }

    setNotFound(true)
  }

  const handleRedeemFidelity = async () => {
    setRedeeming(true)
    await supabase.from('fidelity_coupons')
      .update({ redeemed: true, redeemed_at: new Date().toISOString() })
      .eq('id', result.id)
    setRedeeming(false)
    setRedeemed(true)
    setResult((r: any) => ({ ...r, redeemed: true }))
  }

  const handleRedeemManual = async () => {
    setRedeeming(true)
    await supabase.from('coupons').update({ used_count: result.used_count + 1 }).eq('id', result.id)
    await supabase.from('coupon_uses').insert({ coupon_id: result.id, user_id: null, order_id: null })
    setRedeeming(false)
    setRedeemed(true)
    setResult((r: any) => ({ ...r, used_count: r.used_count + 1 }))
  }

  const isManualValid = result?.source === 'manual' &&
    result.active &&
    result.used_count < result.max_uses &&
    (!result.expires_at || new Date(result.expires_at) > new Date())

  const isFidelityValid = result?.source === 'fidelity' && !result.redeemed

  const inputStyle: React.CSSProperties = {
    padding: '12px 16px', fontSize: '15px', fontFamily: 'var(--font-display)',
    fontWeight: 700, letterSpacing: '3px', textTransform: 'uppercase',
    background: 'rgba(255,240,222,0.04)', border: '1px solid var(--border-medium)',
    borderRadius: '10px', color: 'var(--text-primary)', width: '100%'
  }

  return (
    <div style={{ maxWidth: '520px' }}>
      <div style={{
        background: 'var(--surface-2)', border: '1px solid var(--border-medium)',
        borderRadius: '14px', padding: '24px', marginBottom: '20px'
      }}>
        <div style={{ fontSize: '11px', color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '2px', fontFamily: 'var(--font-display)', fontWeight: 700, marginBottom: '12px' }}>
          Verificar Cupom Presencialmente
        </div>
        <div style={{ display: 'flex', gap: '10px' }}>
          <input
            value={code}
            onChange={e => setCode(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSearch()}
            placeholder="DIGITE O CÓDIGO"
            style={inputStyle}
          />
          <GoldButton onClick={handleSearch}>
            <Search size={14} /> Verificar
          </GoldButton>
        </div>
      </div>

      {notFound && (
        <div style={{
          background: 'rgba(183,53,39,0.08)', border: '1px solid rgba(183,53,39,0.3)',
          borderRadius: '12px', padding: '20px', textAlign: 'center'
        }}>
          <div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--brand-red)', fontFamily: 'var(--font-display)', textTransform: 'uppercase', letterSpacing: '1px' }}>
            Cupom não encontrado
          </div>
          <div style={{ fontSize: '12px', color: 'var(--text-dim)', marginTop: '4px' }}>
            O código "{code.toUpperCase()}" não existe no sistema.
          </div>
        </div>
      )}

      {result && (
        <div style={{
          background: 'var(--surface-2)', border: `1px solid ${(isFidelityValid || isManualValid) && !redeemed ? 'rgba(93,186,117,0.4)' : 'rgba(183,53,39,0.3)'}`,
          borderRadius: '14px', overflow: 'hidden'
        }}>
          <div style={{
            padding: '14px 20px',
            background: (isFidelityValid || isManualValid) && !redeemed ? 'rgba(93,186,117,0.08)' : 'rgba(183,53,39,0.08)',
            borderBottom: '1px solid var(--border-subtle)',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between'
          }}>
            <span style={{ fontFamily: 'var(--font-display)', fontSize: '20px', fontWeight: 800, letterSpacing: '3px', color: 'var(--brand-gold)' }}>
              {result.code}
            </span>
            <span style={{
              padding: '4px 12px', borderRadius: '20px', fontSize: '11px',
              fontWeight: 700, fontFamily: 'var(--font-display)', textTransform: 'uppercase', letterSpacing: '0.5px',
              color: (isFidelityValid || isManualValid) && !redeemed ? '#5dba75' : 'var(--brand-red)',
              background: (isFidelityValid || isManualValid) && !redeemed ? 'rgba(93,186,117,0.15)' : 'rgba(183,53,39,0.15)'
            }}>
              {redeemed ? 'Resgatado agora' :
                result.source === 'fidelity'
                  ? (result.redeemed ? 'Já resgatado' : 'Válido')
                  : (!result.active ? 'Inativo' :
                      result.used_count >= result.max_uses ? 'Esgotado' :
                      result.expires_at && new Date(result.expires_at) < new Date() ? 'Expirado' : 'Válido')}
            </span>
          </div>

          <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {result.source === 'fidelity' && (
              <>
                <Row label="Tipo" value="Fidelidade — Porção Grátis" />
                <Row label="Cliente" value={result.profiles?.full_name ?? 'Cliente'} />
                <Row label="Gerado em" value={new Date(result.created_at).toLocaleDateString('pt-BR')} />
                {result.redeemed && <Row label="Resgatado em" value={new Date(result.redeemed_at).toLocaleDateString('pt-BR')} />}
              </>
            )}
            {result.source === 'manual' && (
              <>
                <Row label="Tipo" value={{ fixed: 'Desconto fixo', percent: 'Desconto percentual', free_item: 'Item grátis' }[result.type] ?? result.type} />
                {result.discount_value && <Row label="Desconto" value={result.type === 'fixed' ? `R$ ${Number(result.discount_value).toFixed(2)}` : `${result.discount_value}%`} />}
                {result.free_item_description && <Row label="Item Grátis" value={result.free_item_description} />}
                <Row label="Usos" value={`${result.used_count} / ${result.max_uses}`} />
                {result.expires_at && <Row label="Expira em" value={new Date(result.expires_at).toLocaleDateString('pt-BR')} />}
              </>
            )}
          </div>

          {(isFidelityValid || isManualValid) && !redeemed && (
            <div style={{ padding: '0 20px 20px' }}>
              <button
                onClick={result.source === 'fidelity' ? handleRedeemFidelity : handleRedeemManual}
                disabled={redeeming}
                style={{
                  width: '100%', padding: '12px',
                  background: 'rgba(93,186,117,0.15)', border: '1px solid rgba(93,186,117,0.4)',
                  borderRadius: '10px', color: '#5dba75', cursor: redeeming ? 'not-allowed' : 'pointer',
                  fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '13px',
                  letterSpacing: '1px', textTransform: 'uppercase',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px'
                }}
              >
                <CheckCircle size={15} /> {redeeming ? 'Resgatando...' : 'Confirmar Resgate Presencial'}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
      <span style={{ fontSize: '11px', color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '1px', fontFamily: 'var(--font-display)', fontWeight: 700 }}>{label}</span>
      <span style={{ fontSize: '13px', color: 'var(--text-primary)', fontWeight: 500 }}>{value}</span>
    </div>
  )
}

function ReportsGrid({ data, loading, maxRevenue }: { data: any; loading: boolean; maxRevenue: number }) {
  const isMobile = useIsMobile()
  return (
    <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: '20px' }}>
      {/* Bar chart */}
      <SectionCard>
        <div style={{ padding: '18px 20px', borderBottom: '1px solid var(--border-subtle)' }}>
          <h3 style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '14px', textTransform: 'uppercase', letterSpacing: '1px', color: 'var(--text-primary)' }}>
            Faturamento por Dia
          </h3>
        </div>
        <div style={{ padding: '20px' }}>
          {loading ? (
            <div style={{ textAlign: 'center', padding: '32px', color: 'var(--text-dim)', fontSize: '13px' }}>Carregando...</div>
          ) : data.byDay.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '32px', color: 'var(--text-dim)', fontSize: '12px' }}>Sem dados no período</div>
          ) : (
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: '8px', height: '140px' }}>
              {data.byDay.map(([day, val]: any) => (
                <div key={day} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px', height: '100%', justifyContent: 'flex-end' }}>
                  <div style={{ fontSize: '9px', color: 'var(--brand-gold)', fontFamily: 'var(--font-display)', fontWeight: 700 }}>
                    {(val/100).toFixed(0)}
                  </div>
                  <div style={{
                    width: '100%', background: 'var(--brand-red)', borderRadius: '4px 4px 0 0',
                    height: `${Math.max((val / maxRevenue) * 100, 4)}%`,
                    opacity: 0.85, transition: 'height 0.3s ease',
                    position: 'relative', overflow: 'hidden'
                  }}>
                    <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '2px', background: 'var(--brand-gold)' }} />
                  </div>
                  <div style={{ fontSize: '9px', color: 'var(--text-dim)' }}>{day}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      </SectionCard>

      {/* Top items */}
      <SectionCard>
        <div style={{ padding: '18px 20px', borderBottom: '1px solid var(--border-subtle)' }}>
          <h3 style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '14px', textTransform: 'uppercase', letterSpacing: '1px', color: 'var(--text-primary)' }}>
            Itens Mais Pedidos
          </h3>
        </div>
        <div style={{ padding: '20px' }}>
          {loading ? (
            <div style={{ textAlign: 'center', padding: '32px', color: 'var(--text-dim)', fontSize: '13px' }}>Carregando...</div>
          ) : data.topItems.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '32px', color: 'var(--text-dim)', fontSize: '12px' }}>Sem dados no período</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              {data.topItems.map((item: any, i: number) => (
                <div key={item.name} style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div style={{
                    width: '22px', height: '22px', borderRadius: '50%', flexShrink: 0,
                    background: i === 0 ? 'var(--brand-gold)' : 'rgba(183,53,39,0.2)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: '11px', fontWeight: 700, fontFamily: 'var(--font-display)',
                    color: i === 0 ? 'var(--brand-dark)' : 'var(--brand-red)'
                  }}>
                    {i + 1}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: '13px', fontWeight: 500, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginBottom: '4px' }}>
                      {item.name}
                    </div>
                    <div style={{ height: '3px', background: 'var(--surface-3)', borderRadius: '2px', overflow: 'hidden' }}>
                      <div style={{
                        height: '100%', borderRadius: '2px',
                        background: i === 0 ? 'var(--brand-gold)' : 'var(--brand-red)',
                        width: `${(item.count / (data.topItems[0]?.count ?? 1)) * 100}%`,
                        transition: 'width 0.4s ease'
                      }} />
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '10px', flexShrink: 0, alignItems: 'center' }}>
                    <span style={{ fontSize: '11px', color: 'var(--text-dim)' }}>{item.count}x</span>
                    <span style={{ fontSize: '12px', fontWeight: 700, fontFamily: 'var(--font-display)', color: 'var(--brand-gold)' }}>
                      R$ {item.revenue.toFixed(0)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </SectionCard>
    </div>
  )
}

function ReportsStats({ data }: { data: any }) {
  const isMobile = useIsMobile()
  return (
    <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : 'repeat(3, 1fr)', gap: '12px', marginBottom: isMobile ? '16px' : '28px' }}>
      <StatCard icon={DollarSign}  label="Faturamento"  value={`R$ ${data.revenue.toFixed(2).replace('.',',')}`}   color="var(--brand-gold)" />
      <StatCard icon={ShoppingBag} label="Pedidos"      value={data.orders}                                         color="var(--brand-red)" />
      <StatCard icon={TrendingUp}  label="Ticket Médio" value={`R$ ${data.avgTicket.toFixed(2).replace('.',',')}`} color="var(--brand-gold)" />
    </div>
  )
}

// ─── REPORTS TAB ──────────────────────────────────────────────

function ReportsTab() {
  const [range, setRange] = useState<'today' | 'week' | 'month'>('week')
  const [data, setData] = useState<any>({ revenue: 0, orders: 0, avgTicket: 0, topItems: [], byDay: [] })
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

      const allItems: any[] = list.flatMap(o => Array.isArray(o.items) ? o.items : [])
      const itemCount: Record<string, { name: string; count: number; revenue: number }> = {}
      allItems.forEach(item => {
        if (!itemCount[item.name]) itemCount[item.name] = { name: item.name, count: 0, revenue: 0 }
        itemCount[item.name].count += item.quantity ?? 1
        itemCount[item.name].revenue += Number(item.price ?? 0) * (item.quantity ?? 1)
      })
      const topItems = Object.values(itemCount).sort((a, b) => b.count - a.count).slice(0, 5)

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
    <Page
      title="Relatórios"
      subtitle="A brasa que nos move é a mesma que nos une"
      action={
        <div style={{ display: 'flex', gap: '6px' }}>
          {[['today','Hoje'],['week','7 dias'],['month','30 dias']].map(([k,l]) => (
            <button
              key={k}
              onClick={() => setRange(k as any)}
              style={{
                padding: '8px 16px', borderRadius: '8px', fontSize: '12px',
                fontWeight: 700, fontFamily: 'var(--font-display)', letterSpacing: '0.5px', textTransform: 'uppercase',
                cursor: 'pointer', transition: 'all 0.15s',
                background: range === k ? 'var(--brand-red)' : 'var(--surface-2)',
                border: range === k ? '1px solid var(--brand-red)' : '1px solid var(--border-subtle)',
                color: range === k ? 'var(--brand-cream)' : 'var(--text-muted)'
              }}
            >
              {l}
            </button>
          ))}
        </div>
      }
    >
      <ReportsStats data={data} />

      <ReportsGrid data={data} loading={loading} maxRevenue={maxRevenue} />
    </Page>
  )
}

// ─── ESTOQUE TAB ──────────────────────────────────────────────

function EstoqueTab() {
  const [file, setFile] = React.useState<File | null>(null)
  const [products, setProducts] = React.useState<CsvProduct[]>([])
  const [importing, setImporting] = React.useState(false)
  const [done, setDone] = React.useState(0)
  const [total, setTotal] = React.useState(0)
  const [errors, setErrors] = React.useState<string[]>([])
  const [finished, setFinished] = React.useState(false)
  const fileRef = React.useRef<HTMLInputElement>(null)

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    if (!f) return
    setFile(f)
    setProducts([])
    setFinished(false)
    setErrors([])
    const reader = new FileReader()
    reader.onload = ev => {
      const text = ev.target?.result as string
      const parsed = parseCsvProducts(text)
      setProducts(parsed)
    }
    reader.readAsText(f, 'UTF-8')
  }

  const handleImport = async () => {
    if (!products.length) return
    setImporting(true)
    setDone(0)
    setTotal(products.length)
    setErrors([])
    setFinished(false)

    // Busca todos os menu_items existentes para checar duplicatas pelo nome
    const { data: existing } = await supabase
      .from('menu_items')
      .select('id, name')
    const existingMap: Record<string, string> = {}
    for (const item of existing ?? []) {
      existingMap[item.name.trim().toLowerCase()] = item.id
    }

    const errs: string[] = []
    let count = 0

    for (const p of products) {
      const category = mapCategoria(p.categoria)
      // Preços absurdos (placeholder do ERP) viram 0
      const price = p.valor > 99999 ? 0 : p.valor

      const payload = {
        name: p.nome,
        category,
        description: '',
        price,
        image_url: '',
        available: p.disponivel,
        weight_mode: false,
        sort_order: 0,
      }

      const existingId = existingMap[p.nome.trim().toLowerCase()]
      let err: string | null = null

      if (existingId) {
        // Atualiza se já existe
        const { error } = await supabase
          .from('menu_items')
          .update(payload)
          .eq('id', existingId)
        if (error) err = `${p.nome}: ${error.message}`
      } else {
        // Insere novo
        const { error } = await supabase
          .from('menu_items')
          .insert(payload)
        if (error) err = `${p.nome}: ${error.message}`
      }

      if (err) errs.push(err)
      count++
      setDone(count)
    }

    setErrors(errs)
    setImporting(false)
    setFinished(true)
  }

  const pct = total > 0 ? Math.round((done / total) * 100) : 0

  return (
    <Page
      title="Importar Estoque"
      subtitle="Importe seu relatório do ERP e sincronize o cardápio automaticamente"
    >
      {/* Upload */}
      <SectionCard style={{ marginBottom: '20px' }}>
        <div style={{ padding: '24px' }}>
          <div
            onClick={() => fileRef.current?.click()}
            style={{
              border: `2px dashed ${file ? 'var(--brand-gold)' : 'var(--border-medium)'}`,
              borderRadius: '12px', padding: '40px',
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px',
              cursor: 'pointer', transition: 'border-color 0.2s',
              background: file ? 'rgba(199,173,112,0.04)' : 'transparent'
            }}
          >
            <Upload size={32} style={{ color: file ? 'var(--brand-gold)' : 'var(--text-dim)' }} />
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '16px', color: file ? 'var(--brand-gold)' : 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '1px' }}>
                {file ? file.name : 'Clique para selecionar o CSV'}
              </div>
              <div style={{ fontSize: '12px', color: 'var(--text-dim)', marginTop: '4px' }}>
                {file ? `${products.length} produto(s) encontrado(s)` : 'Arquivo rel_dinamico exportado do ERP'}
              </div>
            </div>
            <input ref={fileRef} type="file" accept=".csv,text/csv" onChange={handleFile} style={{ display: 'none' }} />
          </div>
        </div>
      </SectionCard>

      {/* Preview */}
      {products.length > 0 && !finished && (
        <SectionCard style={{ marginBottom: '20px' }}>
          <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border-subtle)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <h3 style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '14px', textTransform: 'uppercase', letterSpacing: '1px', color: 'var(--text-primary)' }}>
              Preview — {products.length} produto(s)
            </h3>
            <GoldButton onClick={handleImport} disabled={importing}>
              <Save size={14} />
              {importing ? `Importando... ${done}/${total}` : 'Importar tudo'}
            </GoldButton>
          </div>

          {/* Barra de progresso */}
          {importing && (
            <div style={{ padding: '12px 20px' }}>
              <div style={{ height: '6px', background: 'var(--surface-3)', borderRadius: '3px', overflow: 'hidden' }}>
                <div style={{ height: '100%', background: 'var(--brand-gold)', width: `${pct}%`, transition: 'width 0.2s', borderRadius: '3px' }} />
              </div>
              <div style={{ fontSize: '11px', color: 'var(--text-dim)', marginTop: '4px', textAlign: 'right' }}>{pct}%</div>
            </div>
          )}

          <div style={{ maxHeight: '340px', overflowY: 'auto' }}>
            {products.slice(0, 200).map((p, i) => (
              <div key={i} style={{
                display: 'flex', alignItems: 'center', gap: '12px',
                padding: '10px 20px',
                borderBottom: i < products.length - 1 ? '1px solid var(--border-subtle)' : 'none'
              }}>
                <div style={{ width: '32px', height: '32px', borderRadius: '6px', background: 'rgba(183,53,39,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <span style={{ fontSize: '9px', fontWeight: 700, fontFamily: 'var(--font-display)', color: 'var(--brand-red)', textTransform: 'uppercase' }}>
                    {mapCategoria(p.categoria)[0]}
                  </span>
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {p.nome}
                  </div>
                  <div style={{ fontSize: '10px', color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                    {mapCategoria(p.categoria)} • {p.categoria}
                  </div>
                </div>
                <div style={{ textAlign: 'right', flexShrink: 0 }}>
                  <div style={{ fontFamily: 'var(--font-display)', fontSize: '14px', fontWeight: 700, color: p.valor > 99999 ? 'var(--text-dim)' : 'var(--brand-gold)' }}>
                    {p.valor > 99999 ? 'A definir' : `R$ ${p.valor.toFixed(2).replace('.', ',')}`}
                  </div>
                  <div style={{ fontSize: '9px', color: p.disponivel ? '#5dba75' : 'var(--brand-red)', fontWeight: 700, textTransform: 'uppercase' }}>
                    {p.disponivel ? 'Disponível' : 'Inativo'}
                  </div>
                </div>
              </div>
            ))}
            {products.length > 200 && (
              <div style={{ padding: '12px 20px', textAlign: 'center', fontSize: '11px', color: 'var(--text-dim)' }}>
                ... e mais {products.length - 200} produtos (todos serão importados)
              </div>
            )}
          </div>
        </SectionCard>
      )}

      {/* Resultado */}
      {finished && (
        <SectionCard>
          <div style={{ padding: '32px', textAlign: 'center' }}>
            <CheckCircle size={40} style={{ color: errors.length === 0 ? '#5dba75' : 'var(--brand-gold)', marginBottom: '12px' }} />
            <div style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: '22px', textTransform: 'uppercase', color: 'var(--text-primary)', marginBottom: '6px' }}>
              {errors.length === 0 ? 'Importação concluída!' : 'Importação com avisos'}
            </div>
            <div style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
              {done - errors.length} produto(s) importado(s) com sucesso
              {errors.length > 0 && `, ${errors.length} com erro`}
            </div>
            {errors.length > 0 && (
              <div style={{ marginTop: '16px', textAlign: 'left', background: 'rgba(183,53,39,0.08)', borderRadius: '8px', padding: '12px', maxHeight: '200px', overflowY: 'auto' }}>
                {errors.map((e, i) => (
                  <div key={i} style={{ fontSize: '11px', color: 'var(--brand-red)', marginBottom: '4px' }}>{e}</div>
                ))}
              </div>
            )}
            <div style={{ marginTop: '20px' }}>
              <GhostButton onClick={() => { setFile(null); setProducts([]); setFinished(false); setErrors([]) }}>
                Importar outro arquivo
              </GhostButton>
            </div>
          </div>
        </SectionCard>
      )}
    </Page>
  )
}

// ─── TEAM TAB (só super_admin) ────────────────────────────────

const ALL_PERMISSIONS: { key: keyof AdminPermissions; label: string; group: string }[] = [
  { key: 'view_dashboard',   label: 'Ver Dashboard',      group: 'Dashboard' },
  { key: 'view_orders',      label: 'Ver Pedidos',         group: 'Pedidos' },
  { key: 'manage_orders',    label: 'Gerenciar Pedidos',   group: 'Pedidos' },
  { key: 'view_chat',        label: 'Ver Chat',            group: 'Chat' },
  { key: 'manage_chat',      label: 'Responder Chat',      group: 'Chat' },
  { key: 'view_menu',        label: 'Ver Cardápio',        group: 'Cardápio' },
  { key: 'manage_menu',      label: 'Editar Cardápio',     group: 'Cardápio' },
  { key: 'view_coupons',     label: 'Ver Cupons',          group: 'Cupons' },
  { key: 'manage_coupons',   label: 'Gerenciar Cupons',    group: 'Cupons' },
  { key: 'view_reports',     label: 'Ver Relatórios',      group: 'Relatórios' },
]

function TeamTab() {
  const [admins, setAdmins] = useState<Profile[]>([])
  const [searchEmail, setSearchEmail] = useState('')
  const [searchResult, setSearchResult] = useState<Profile | null>(null)
  const [searchError, setSearchError] = useState('')
  const [editing, setEditing] = useState<Profile | null>(null)
  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(true)

  const fetchAdmins = async () => {
    setLoading(true)
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .in('role', ['admin', 'super_admin'])
      .order('full_name')
    setAdmins(data ?? [])
    setLoading(false)
  }

  useEffect(() => { fetchAdmins() }, [])

  const handleSearch = async () => {
    setSearchResult(null)
    setSearchError('')
    if (!searchEmail.trim()) return

    // Busca via auth.users pelo email usando service (profiles não tem email)
    // Alternativa: busca na tabela profiles por email se você tiver essa coluna
    // Como profiles tem só id/full_name/role, buscamos pelo email no auth e cruzamos
    const { data: profile, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('email', searchEmail.trim().toLowerCase())
      .maybeSingle()
    
    if (error || !profile) {
      setSearchError('Usuário não encontrado. Verifique o e-mail.')
      return
    }

    if (!profile) {
      setSearchError('Perfil não encontrado para este e-mail.')
      return
    }

    if (profile.role === 'super_admin') {
      setSearchError('Este usuário é super_admin e não pode ser editado aqui.')
      return
    }

    setSearchResult(profile)
    setEditing({ ...profile, permissions: profile.permissions ?? {} })
  }

  const handleTogglePerm = (key: keyof AdminPermissions) => {
    if (!editing) return
    setEditing(e => ({
      ...e!,
      permissions: { ...e!.permissions, [key]: !e!.permissions?.[key] }
    }))
  }

  const handleSave = async () => {
    if (!editing) return
    setSaving(true)
    await supabase
      .from('profiles')
      .update({
        role: 'admin',
        permissions: editing.permissions
      })
      .eq('id', editing.id)
    setSaving(false)
    setSearchResult(null)
    setSearchEmail('')
    setEditing(null)
    fetchAdmins()
  }

  const handleRemoveAdmin = async (id: string) => {
    if (!confirm('Remover acesso de admin deste usuário?')) return
    await supabase
      .from('profiles')
      .update({ role: 'user', permissions: {} })
      .eq('id', id)
    fetchAdmins()
  }

  const groups = [...new Set(ALL_PERMISSIONS.map(p => p.group))]

  return (
    <Page
      title="Equipe"
      subtitle="Gerencie os administradores e suas permissões"
    >
      {/* Buscar usuário */}
      <SectionCard style={{ marginBottom: '24px' }}>
        <div style={{ padding: '18px 20px', borderBottom: '1px solid var(--border-subtle)' }}>
          <h3 style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '14px', textTransform: 'uppercase', letterSpacing: '1px', color: 'var(--text-primary)' }}>
            Adicionar ou Editar Admin
          </h3>
        </div>
        <div style={{ padding: '20px' }}>
          <div style={{ display: 'flex', gap: '10px', marginBottom: '16px' }}>
            <input
              value={searchEmail}
              onChange={e => setSearchEmail(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSearch()}
              placeholder="E-mail do usuário..."
              style={{ flex: 1, padding: '10px 14px', fontSize: '13px' }}
            />
            <GoldButton onClick={handleSearch} small>
              <Search size={13} /> Buscar
            </GoldButton>
          </div>

          {searchError && (
            <div style={{ color: 'var(--brand-red)', fontSize: '12px', padding: '10px 14px', background: 'rgba(183,53,39,0.08)', borderRadius: '8px', border: '1px solid rgba(183,53,39,0.2)' }}>
              {searchError}
            </div>
          )}

          {editing && searchResult && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              style={{ background: 'rgba(199,173,112,0.05)', border: '1px solid var(--border-medium)', borderRadius: '12px', padding: '18px' }}
            >
              <div style={{ marginBottom: '16px' }}>
                <div style={{ fontFamily: 'var(--font-display)', fontSize: '16px', fontWeight: 700, color: 'var(--text-primary)', textTransform: 'uppercase' }}>
                  {editing.full_name || 'Usuário sem nome'}
                </div>
                <div style={{ fontSize: '11px', color: 'var(--text-dim)', marginTop: '2px' }}>
                  {searchEmail}
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginBottom: '18px' }}>
                {groups.map(group => (
                  <div key={group}>
                    <div style={{ fontSize: '10px', fontFamily: 'var(--font-display)', fontWeight: 700, letterSpacing: '2px', textTransform: 'uppercase', color: 'var(--brand-gold)', marginBottom: '8px' }}>
                      {group}
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      {ALL_PERMISSIONS.filter(p => p.group === group).map(perm => {
                        const checked = !!editing.permissions?.[perm.key]
                        return (
                          <label
                            key={perm.key}
                            onClick={() => handleTogglePerm(perm.key)}
                            style={{
                              display: 'flex', alignItems: 'center', gap: '10px',
                              cursor: 'pointer', padding: '8px 12px', borderRadius: '8px',
                              background: checked ? 'rgba(93,186,117,0.08)' : 'rgba(255,240,222,0.03)',
                              border: `1px solid ${checked ? 'rgba(93,186,117,0.25)' : 'var(--border-subtle)'}`,
                              transition: 'all 0.15s', userSelect: 'none'
                            }}
                          >
                            <div style={{
                              width: '16px', height: '16px', borderRadius: '4px', flexShrink: 0,
                              background: checked ? '#5dba75' : 'transparent',
                              border: `2px solid ${checked ? '#5dba75' : 'var(--border-medium)'}`,
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                              transition: 'all 0.15s'
                            }}>
                              {checked && (
                                <svg width="9" height="7" viewBox="0 0 9 7" fill="none">
                                  <path d="M1 3.5L3.5 6L8 1" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                                </svg>
                              )}
                            </div>
                            <span style={{ fontSize: '13px', fontWeight: 500, color: checked ? 'var(--text-primary)' : 'var(--text-muted)' }}>
                              {perm.label}
                            </span>
                          </label>
                        )
                      })}
                    </div>
                  </div>
                ))}
              </div>

              <div style={{ display: 'flex', gap: '10px' }}>
                <GhostButton onClick={() => { setSearchResult(null); setEditing(null); setSearchEmail('') }} small>
                  Cancelar
                </GhostButton>
                <GoldButton onClick={handleSave} disabled={saving} small>
                  <Save size={13} /> {saving ? 'Salvando...' : 'Salvar Permissões'}
                </GoldButton>
              </div>
            </motion.div>
          )}
        </div>
      </SectionCard>

      {/* Lista de admins existentes */}
      <SectionCard>
        <div style={{ padding: '18px 20px', borderBottom: '1px solid var(--border-subtle)' }}>
          <h3 style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '14px', textTransform: 'uppercase', letterSpacing: '1px', color: 'var(--text-primary)' }}>
            Admins Ativos
          </h3>
        </div>
        <div>
          {loading && (
            <div style={{ padding: '48px', textAlign: 'center', color: 'var(--text-dim)', fontSize: '13px' }}>
              Carregando...
            </div>
          )}
          {!loading && admins.length === 0 && (
            <div style={{ padding: '48px', textAlign: 'center', color: 'var(--text-dim)', fontSize: '13px' }}>
              Nenhum admin cadastrado além de você.
            </div>
          )}
          {admins.map((admin, i) => {
            const perms = admin.permissions ?? {}
            const activePerms = ALL_PERMISSIONS.filter(p => perms[p.key])
            return (
              <div
                key={admin.id}
                style={{
                  display: 'flex', alignItems: 'flex-start', gap: '14px',
                  padding: '16px 20px',
                  borderBottom: i < admins.length - 1 ? '1px solid var(--border-subtle)' : 'none'
                }}
              >
                <div style={{
                  width: '36px', height: '36px', borderRadius: '50%', flexShrink: 0,
                  background: admin.role === 'super_admin' ? 'rgba(199,173,112,0.2)' : 'rgba(183,53,39,0.15)',
                  border: `1px solid ${admin.role === 'super_admin' ? 'rgba(199,173,112,0.4)' : 'rgba(183,53,39,0.3)'}`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '13px', fontWeight: 700, fontFamily: 'var(--font-display)',
                  color: admin.role === 'super_admin' ? 'var(--brand-gold)' : 'var(--brand-red)'
                }}>
                  {admin.full_name?.[0]?.toUpperCase() ?? '?'}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                    <span style={{ fontFamily: 'var(--font-display)', fontSize: '14px', fontWeight: 700, color: 'var(--text-primary)', textTransform: 'uppercase' }}>
                      {admin.full_name}
                    </span>
                    <span style={{
                      padding: '2px 8px', borderRadius: '20px', fontSize: '9px',
                      fontWeight: 700, fontFamily: 'var(--font-display)', textTransform: 'uppercase', letterSpacing: '0.5px',
                      color: admin.role === 'super_admin' ? 'var(--brand-gold)' : 'var(--text-muted)',
                      background: admin.role === 'super_admin' ? 'rgba(199,173,112,0.15)' : 'rgba(255,240,222,0.06)',
                      border: `1px solid ${admin.role === 'super_admin' ? 'rgba(199,173,112,0.3)' : 'var(--border-subtle)'}`
                    }}>
                      {admin.role === 'super_admin' ? 'Super Admin' : 'Admin'}
                    </span>
                  </div>
                  {admin.role !== 'super_admin' && (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                      {activePerms.length === 0 && (
                        <span style={{ fontSize: '11px', color: 'var(--text-dim)' }}>Nenhuma permissão ativa</span>
                      )}
                      {activePerms.map(p => (
                        <span key={p.key} style={{
                          fontSize: '10px', padding: '2px 8px', borderRadius: '20px',
                          background: 'rgba(93,186,117,0.08)', color: '#5dba75',
                          border: '1px solid rgba(93,186,117,0.2)',
                          fontFamily: 'var(--font-display)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.3px'
                        }}>
                          {p.label}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
                {admin.role !== 'super_admin' && (
                  <div style={{ display: 'flex', gap: '6px', flexShrink: 0 }}>
                    <button
                      onClick={() => {
                        setSearchEmail('(editar direto)')
                        setSearchResult(admin)
                        setEditing({ ...admin, permissions: admin.permissions ?? {} })
                      }}
                      style={{
                        padding: '6px 12px', borderRadius: '6px',
                        background: 'transparent', border: '1px solid var(--border-medium)',
                        color: 'var(--text-muted)', cursor: 'pointer', fontSize: '11px',
                        fontFamily: 'var(--font-display)', fontWeight: 700, textTransform: 'uppercase',
                        display: 'flex', alignItems: 'center', gap: '4px'
                      }}
                    >
                      <Edit2 size={11} /> Editar
                    </button>
                    <button
                      onClick={() => handleRemoveAdmin(admin.id)}
                      style={{
                        padding: '6px 10px', borderRadius: '6px',
                        background: 'rgba(183,53,39,0.08)', border: '1px solid rgba(183,53,39,0.25)',
                        color: 'var(--brand-red)', cursor: 'pointer',
                        display: 'flex', alignItems: 'center'
                      }}
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </SectionCard>
    </Page>
  )
}

// ─── CHAT TAB (estilo WhatsApp Web) ───────────────────────────

type ChatMessage = {
  id: string
  user_id: string
  sender: 'user' | 'admin'
  admin_id: string | null
  body: string
  read_by_admin: boolean
  read_by_user: boolean
  created_at: string
}

type ChatConversation = {
  user_id: string
  full_name: string
  last_message: string
  last_message_at: string
  unread_count: number
}

function ChatTab({ profile }: { profile: Profile }) {
  const isMobile = useIsMobile()
  const [conversations, setConversations] = useState<ChatConversation[]>([])
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')

  const fetchConversations = useCallback(async () => {
    setLoading(true)
    // Busca todas as mensagens (ordenadas), depois agrupa por user_id no client.
    // Para volumes grandes isso deveria virar uma view/RPC no banco, mas para o
    // volume de um chat de suporte de restaurante isso é perfeitamente viável.
    const { data: messages } = await supabase
      .from('chat_messages')
      .select('user_id, sender, body, created_at, read_by_admin')
      .order('created_at', { ascending: false })

    if (!messages) { setConversations([]); setLoading(false); return }

    const grouped = new Map<string, ChatConversation>()
    const unreadCount = new Map<string, number>()

    for (const m of messages) {
      if (!grouped.has(m.user_id)) {
        grouped.set(m.user_id, {
          user_id: m.user_id,
          full_name: '',
          last_message: m.body,
          last_message_at: m.created_at,
          unread_count: 0,
        })
      }
      if (m.sender === 'user' && !m.read_by_admin) {
        unreadCount.set(m.user_id, (unreadCount.get(m.user_id) ?? 0) + 1)
      }
    }

    const userIds = Array.from(grouped.keys())
    if (userIds.length > 0) {
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, full_name')
        .in('id', userIds)
      for (const p of profiles ?? []) {
        const conv = grouped.get(p.id)
        if (conv) conv.full_name = p.full_name ?? 'Cliente'
      }
    }

    for (const [uid, conv] of grouped) {
      conv.unread_count = unreadCount.get(uid) ?? 0
    }

    setConversations(Array.from(grouped.values()).sort((a, b) =>
      new Date(b.last_message_at).getTime() - new Date(a.last_message_at).getTime()
    ))
    setLoading(false)
  }, [])

  useEffect(() => { fetchConversations() }, [fetchConversations])

  // Realtime: qualquer INSERT novo atualiza a lista de conversas
  useEffect(() => {
    const channel = supabase
      .channel('admin-chat-list')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'chat_messages' }, fetchConversations)
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [fetchConversations])

  const filtered = conversations.filter(c =>
    !search || c.full_name.toLowerCase().includes(search.toLowerCase())
  )

  const selectedConv = conversations.find(c => c.user_id === selectedUserId) ?? null

  return (
    <Page title="Chat" subtitle="Converse com os clientes em tempo real">
      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '340px 1fr', gap: '16px', height: isMobile ? 'auto' : 'calc(100vh - 220px)' }}>

        {/* ── LISTA DE CONVERSAS (esconde em mobile quando há seleção) ── */}
        {(!isMobile || !selectedUserId) && (
          <SectionCard style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--border-subtle)' }}>
              <div style={{ position: 'relative' }}>
                <Search size={13} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-dim)' }} />
                <input
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder="Buscar cliente..."
                  style={{ width: '100%', padding: '8px 12px 8px 30px', fontSize: '12px' }}
                />
              </div>
            </div>
            <div style={{ flex: 1, overflowY: 'auto' }}>
              {loading && (
                <div style={{ padding: '32px', textAlign: 'center', color: 'var(--text-dim)', fontSize: '13px' }}>
                  Carregando conversas...
                </div>
              )}
              {!loading && filtered.length === 0 && (
                <div style={{ padding: '32px', textAlign: 'center', color: 'var(--text-dim)', fontSize: '13px' }}>
                  Nenhuma conversa ainda.
                </div>
              )}
              {filtered.map(conv => {
                const isSelected = selectedUserId === conv.user_id
                return (
                  <button
                    key={conv.user_id}
                    onClick={() => setSelectedUserId(conv.user_id)}
                    style={{
                      width: '100%', display: 'flex', alignItems: 'center', gap: '12px',
                      padding: '12px 16px', textAlign: 'left', cursor: 'pointer',
                      background: isSelected ? 'rgba(183,53,39,0.1)' : 'transparent',
                      border: 'none', borderBottom: '1px solid var(--border-subtle)',
                      transition: 'background 0.15s'
                    }}
                  >
                    <div style={{
                      width: '38px', height: '38px', borderRadius: '50%', flexShrink: 0,
                      background: 'rgba(183,53,39,0.15)', border: '1px solid rgba(183,53,39,0.3)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: '14px', fontWeight: 700, color: 'var(--brand-red)',
                      fontFamily: 'var(--font-display)'
                    }}>
                      {conv.full_name?.[0]?.toUpperCase() ?? '?'}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '6px' }}>
                        <span style={{
                          fontSize: '13px', fontWeight: 700, color: 'var(--text-primary)',
                          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap'
                        }}>
                          {conv.full_name || 'Cliente'}
                        </span>
                        <span style={{ fontSize: '10px', color: 'var(--text-dim)', flexShrink: 0 }}>
                          {new Date(conv.last_message_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '6px', marginTop: '2px' }}>
                        <span style={{
                          fontSize: '12px', color: 'var(--text-dim)',
                          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap'
                        }}>
                          {conv.last_message}
                        </span>
                        {conv.unread_count > 0 && (
                          <span style={{
                            background: 'var(--brand-red)', color: 'var(--brand-cream)',
                            fontSize: '10px', fontWeight: 700, minWidth: '18px', height: '18px',
                            borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center',
                            padding: '0 5px', flexShrink: 0
                          }}>
                            {conv.unread_count}
                          </span>
                        )}
                      </div>
                    </div>
                  </button>
                )
              })}
            </div>
          </SectionCard>
        )}

        {/* ── PAINEL DE CONVERSA ── */}
        {(!isMobile || selectedUserId) && (
          selectedConv ? (
            <ChatConversationPanel
              key={selectedConv.user_id}
              conversation={selectedConv}
              profile={profile}
              onBack={() => setSelectedUserId(null)}
              onMessagesRead={fetchConversations}
              isMobile={isMobile}
            />
          ) : (
            <SectionCard style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
              gap: '10px', color: 'var(--text-dim)', minHeight: '300px'
            }}>
              <MessageCircle size={28} style={{ opacity: 0.3 }} />
              <span style={{ fontSize: '12px', textTransform: 'uppercase', letterSpacing: '1px', fontFamily: 'var(--font-display)' }}>
                Selecione uma conversa
              </span>
            </SectionCard>
          )
        )}
      </div>
    </Page>
  )
}

function ChatConversationPanel({ conversation, profile, onBack, onMessagesRead, isMobile }: {
  conversation: ChatConversation
  profile: Profile
  onBack: () => void
  onMessagesRead: () => void
  isMobile: boolean
}) {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [loading, setLoading] = useState(true)
  const canReply = profile.role === 'super_admin' || !!profile.permissions?.manage_chat
  const scrollRef = useRef<HTMLDivElement>(null)

  const fetchMessages = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase
      .from('chat_messages')
      .select('*')
      .eq('user_id', conversation.user_id)
      .order('created_at', { ascending: true })
    setMessages(data ?? [])
    setLoading(false)

    // Marca mensagens do cliente como lidas
    await supabase
      .from('chat_messages')
      .update({ read_by_admin: true })
      .eq('user_id', conversation.user_id)
      .eq('sender', 'user')
      .eq('read_by_admin', false)

    onMessagesRead()
  }, [conversation.user_id])

  useEffect(() => { fetchMessages() }, [fetchMessages])

  useEffect(() => {
    const channel = supabase
      .channel(`admin-chat-conv-${conversation.user_id}`)
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public', table: 'chat_messages',
        filter: `user_id=eq.${conversation.user_id}`,
      }, (payload) => {
        setMessages(prev => [...prev, payload.new as ChatMessage])
        if ((payload.new as ChatMessage).sender === 'user') {
          supabase
            .from('chat_messages')
            .update({ read_by_admin: true })
            .eq('id', (payload.new as ChatMessage).id)
            .then(() => onMessagesRead())
        }
      })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [conversation.user_id])

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
  }, [messages])

  const handleSend = async () => {
    if (!input.trim() || sending || !canReply) return
    setSending(true)
    const body = input.trim()
    setInput('')

    const { data: { user } } = await supabase.auth.getUser()

    await supabase.from('chat_messages').insert({
      user_id: conversation.user_id,
      sender: 'admin',
      admin_id: user?.id ?? null,
      body,
      read_by_admin: true,
      read_by_user: false,
    })

    setSending(false)
  }

  return (
    <SectionCard style={{ display: 'flex', flexDirection: 'column', height: isMobile ? '70vh' : '100%', minHeight: 0 }}>
      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: '12px',
        padding: '14px 18px', borderBottom: '1px solid var(--border-subtle)',
        background: 'rgba(183,53,39,0.06)'
      }}>
        {isMobile && (
          <button
            onClick={onBack}
            style={{
              background: 'transparent', border: 'none', color: 'var(--text-muted)',
              cursor: 'pointer', display: 'flex', alignItems: 'center', padding: '4px'
            }}
          >
            <ArrowRight size={18} style={{ transform: 'rotate(180deg)' }} />
          </button>
        )}
        <div style={{
          width: '36px', height: '36px', borderRadius: '50%', flexShrink: 0,
          background: 'rgba(183,53,39,0.15)', border: '1px solid rgba(183,53,39,0.3)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: '13px', fontWeight: 700, color: 'var(--brand-red)',
          fontFamily: 'var(--font-display)'
        }}>
          {conversation.full_name?.[0]?.toUpperCase() ?? '?'}
        </div>
        <div>
          <div style={{ fontFamily: 'var(--font-display)', fontSize: '15px', fontWeight: 700, color: 'var(--text-primary)', textTransform: 'uppercase' }}>
            {conversation.full_name || 'Cliente'}
          </div>
        </div>
      </div>

      {/* Mensagens */}
      <div
        ref={scrollRef}
        style={{
          flex: '1 1 0', overflowY: 'auto', padding: '18px',
          display: 'flex', flexDirection: 'column', gap: '10px',
          minHeight: 0
        }}
      >
        {loading && (
          <div style={{ textAlign: 'center', color: 'var(--text-dim)', fontSize: '13px', padding: '20px' }}>
            Carregando mensagens...
          </div>
        )}
        {!loading && messages.length === 0 && (
          <div style={{ textAlign: 'center', color: 'var(--text-dim)', fontSize: '13px', padding: '20px' }}>
            Nenhuma mensagem ainda.
          </div>
        )}
        {messages.map(m => {
          const isAdmin = m.sender === 'admin'
          return (
            <div
              key={m.id}
              style={{
                alignSelf: isAdmin ? 'flex-end' : 'flex-start',
                maxWidth: '75%',
                display: 'flex', flexDirection: 'column', gap: '2px'
              }}
            >
              <div style={{
                padding: '10px 14px', borderRadius: isAdmin ? '14px 14px 2px 14px' : '14px 14px 14px 2px',
                background: isAdmin ? 'var(--brand-red)' : 'rgba(255,240,222,0.08)',
                color: isAdmin ? 'var(--brand-cream)' : 'var(--text-primary)',
                fontSize: '13px', lineHeight: 1.4, wordBreak: 'break-word'
              }}>
                {m.body}
              </div>
              <div style={{
                display: 'flex', alignItems: 'center', gap: '4px',
                fontSize: '10px', color: 'var(--text-dim)',
                alignSelf: isAdmin ? 'flex-end' : 'flex-start'
              }}>
                {new Date(m.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                {isAdmin && (m.read_by_user ? <CheckCheck size={12} style={{ color: 'var(--brand-gold)' }} /> : <Check size={12} />)}
              </div>
            </div>
          )
        })}
      </div>

      {/* Input */}
      <div style={{ padding: '14px 18px', borderTop: '1px solid var(--border-subtle)', display: 'flex', gap: '10px' }}>
        <input
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleSend()}
          placeholder={canReply ? 'Digite sua mensagem...' : 'Você não tem permissão para responder'}
          disabled={!canReply}
          style={{ flex: 1, padding: '10px 14px', fontSize: '13px' }}
        />
        <button
          onClick={handleSend}
          disabled={!input.trim() || sending || !canReply}
          style={{
            width: '40px', height: '40px', borderRadius: '10px', flexShrink: 0,
            background: !input.trim() || sending || !canReply ? 'rgba(183,53,39,0.2)' : 'var(--brand-red)',
            border: 'none', color: 'var(--brand-cream)',
            cursor: !input.trim() || sending || !canReply ? 'not-allowed' : 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            opacity: !input.trim() || sending || !canReply ? 0.5 : 1, transition: 'all 0.15s'
          }}
        >
          <Send size={16} />
        </button>
      </div>
    </SectionCard>
  )
}
