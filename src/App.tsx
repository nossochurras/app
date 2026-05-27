import { supabase } from './supabaseClient'
import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  MapPin, 
  ShoppingBag, 
  ArrowLeft,
  Search,
  Plus, 
  Minus, 
  CheckCircle,
  Flame,
  ChefHat,
  LayoutGrid,
  Beef,
  UtensilsCrossed,
  Beer,
  Home,
  User,
  Ticket,
  MessageCircle,
  CreditCard,
  ReceiptText,
  Gift,
  ChevronRight,
  LogOut,
  Scale,
} from 'lucide-react';
import AdminPanel from './AdminPanel'

// ─── FIDELITY HELPERS ───────────────────────────────────────────

const FIDELITY_GOAL = 900;

async function ensureFidelityRecord(userId: string) {
  const { data } = await supabase
    .from('fidelity')
    .select('total_spent')
    .eq('user_id', userId)
    .maybeSingle();

  if (data) return data;

  const { data: created } = await supabase
    .from('fidelity')
    .insert({ user_id: userId, total_spent: 0 })
    .select('total_spent')
    .single();

  return created;
}

async function addSpentAndCheckGoal(userId: string, amount: number) {
  const current = await ensureFidelityRecord(userId);
  if (!current) return { couponGenerated: false };

  const newTotal = current.total_spent + amount;

  if (newTotal >= FIDELITY_GOAL) {
    const excess = newTotal - FIDELITY_GOAL;
    const code = 'BRASA-' + Math.random().toString(36).substring(2, 8).toUpperCase();

    await supabase
      .from('fidelity')
      .update({ total_spent: excess, updated_at: new Date().toISOString() })
      .eq('user_id', userId);

    await supabase
      .from('fidelity_coupons')
      .insert({ user_id: userId, code, redeemed: false });

    return { couponGenerated: true, couponCode: code };
  }

  await supabase
    .from('fidelity')
    .update({ total_spent: newTotal, updated_at: new Date().toISOString() })
    .eq('user_id', userId);

  return { couponGenerated: false };
}

async function fetchActiveCoupons(userId: string) {
  const { data } = await supabase
    .from('fidelity_coupons')
    .select('id, code, redeemed, created_at')
    .eq('user_id', userId)
    .eq('redeemed', false)
    .order('created_at', { ascending: false });

  return data ?? [];
}

// ─── TYPES ───────────────────────────────────────────────────────

type WeightOption = {
  id: string
  label: string
  max_grams: number
  price: number
  sort_order: number
}

type DynamicMenuItem = {
  id: number | string
  name: string
  category: 'Carnes' | 'Acompanhamentos' | 'Bebidas'
  desc: string
  price: number
  image: string
  weight_mode: boolean
  weight_options: WeightOption[]
}

const LOCATIONS = Array.from({ length: 10 }, (_, i) => `Churrasqueira ${i + 1}`);

const GoogleIcon = () => (
  <svg viewBox="0 0 24 24" width="24" height="24" xmlns="http://www.w3.org/2000/svg">
    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
  </svg>
);

const AppleIcon = () => (
  <svg viewBox="0 0 24 24" width="24" height="24" xmlns="http://www.w3.org/2000/svg">
    <path d="M16.365 7.042c-.084-2.527 2.052-3.753 2.148-3.811-1.183-1.748-3.036-1.986-3.69-2.015-1.583-.162-3.09.939-3.896.939-.807 0-2.046-.918-3.344-.891-1.688.026-3.242.981-4.113 2.502-1.765 3.069-.452 7.618 1.258 10.103.844 1.222 1.83 2.59 3.104 2.54 1.221-.054 1.696-.799 3.177-.799 1.48 0 1.902.799 3.177.773 1.328-.026 2.158-1.246 2.977-2.438.95-1.391 1.341-2.738 1.366-2.812-.03-.014-2.632-1.01-2.716-4.09H16.365zM14.288 3.515c.677-.82 1.135-1.96 1.01-3.095-1.019.041-2.245.679-2.946 1.523-.559.671-1.109 1.841-.958 2.949 1.139.088 2.213-.557 2.894-1.377z" fill="currentColor"/>
  </svg>
);

const pageVariants = {
  initial: { opacity: 0, scale: 0.98 },
  animate: { opacity: 1, scale: 1 },
  exit: { opacity: 0, scale: 1.02 }
};

const BranchTransition = ({ isVisible }: { isVisible: boolean }) => {
  const branches = [
    { d: "M390,0 C320,80 240,120 180,200 C120,280 80,360 40,450 C10,520 -20,600 0,700", w: 22, delay: 0 },
    { d: "M0,844 C80,760 160,700 220,620 C280,540 310,460 350,370 C380,300 410,220 390,140", w: 22, delay: 0.05 },
    { d: "M100,0 C140,100 120,180 100,280 C80,370 40,440 20,540 C0,620 10,720 50,844", w: 16, delay: 0.1 },
    { d: "M290,844 C260,740 280,660 260,560 C240,460 190,400 180,300 C170,210 200,120 220,0", w: 16, delay: 0.08 },
    { d: "M390,300 C320,320 260,300 200,320 C140,340 80,320 0,340", w: 12, delay: 0.15 },
    { d: "M0,500 C80,480 160,500 230,480 C300,460 350,480 390,460", w: 12, delay: 0.18 },
    { d: "M390,0 C370,40 390,80 360,100 C330,120 290,100 260,130", w: 10, delay: 0.12 },
    { d: "M180,200 C220,170 260,180 290,150 C320,120 330,80 390,60", w: 8, delay: 0.2 },
    { d: "M100,280 C140,260 170,240 200,210 C230,180 250,150 280,120", w: 8, delay: 0.22 },
    { d: "M40,450 C80,420 120,430 160,400 C200,370 220,340 260,320", w: 7, delay: 0.25 },
    { d: "M0,700 C60,670 100,680 150,650 C200,620 230,590 270,560", w: 7, delay: 0.28 },
    { d: "M220,620 C180,650 140,640 100,670 C60,700 30,730 0,760", w: 7, delay: 0.2 },
    { d: "M350,370 C310,400 270,390 230,420 C190,450 160,470 120,500", w: 7, delay: 0.22 },
    { d: "M390,140 C340,160 300,150 260,180 C220,210 200,240 160,260", w: 7, delay: 0.25 },
    { d: "M390,0 C380,20 370,10 355,25 C340,40 345,60 330,70", w: 5, delay: 0.3 },
    { d: "M360,100 C345,115 330,108 315,120 C300,132 298,148 282,155", w: 5, delay: 0.32 },
    { d: "M290,150 C278,165 265,160 252,175 C239,190 240,208 225,215", w: 5, delay: 0.34 },
    { d: "M200,320 C188,335 175,330 162,345 C149,360 150,378 135,385", w: 5, delay: 0.36 },
    { d: "M150,650 C138,665 125,660 112,675 C99,690 100,708 85,715", w: 5, delay: 0.3 },
    { d: "M270,560 C258,575 245,570 232,585 C219,600 220,618 205,625", w: 5, delay: 0.32 },
    { d: "M0,340 C20,325 35,330 50,315 C65,300 66,282 82,275", w: 5, delay: 0.34 },
    { d: "M0,500 C25,488 40,492 58,478 C76,464 78,446 96,440", w: 5, delay: 0.36 },
    { d: "M100,0 C88,22 92,38 78,52 C64,66 46,64 35,80", w: 5, delay: 0.38 },
    { d: "M220,0 C210,25 215,42 200,56 C185,70 166,68 155,85", w: 5, delay: 0.4 },
    { d: "M50,844 C62,820 58,804 74,790 C90,776 108,778 120,762", w: 5, delay: 0.3 },
    { d: "M290,844 C278,820 282,804 268,790 C254,776 236,778 225,762", w: 5, delay: 0.32 },
  ];

  const leaves = [
    [375,8],[360,18],[385,28],[348,12],[370,35],[358,42],[342,28],[390,50],
    [215,15],[228,28],[202,32],[240,22],[218,42],[195,20],
    [325,72],[338,62],[312,80],[348,88],[328,95],[308,68],
    [278,125],[292,115],[265,132],[285,145],[260,118],
    [255,182],[268,172],[242,190],[272,198],[248,168],
    [195,212],[208,202],[182,220],[212,228],[188,198],
    [155,262],[168,252],[142,270],[172,278],[148,248],
    [130,388],[143,378],[117,396],[147,404],[123,374],
    [200,325],[213,315],[187,333],[217,341],[193,311],
    [48,318],[62,308],[35,326],[66,334],[42,304],
    [92,443],[105,433],[79,451],[109,459],[85,429],
    [18,543],[32,533],[5,551],[36,559],[12,529],
    [42,678],[55,668],[28,686],[60,694],[36,664],
    [78,55],[92,45],[65,63],[96,71],[72,41],
    [32,83],[46,73],[19,91],[50,99],[26,69],
    [80,718],[94,708],[67,726],[98,734],[74,704],
    [148,653],[162,643],[135,661],[166,669],[142,639],
    [108,768],[122,758],[95,776],[126,784],[102,754],
    [222,765],[236,755],[209,773],[240,781],[218,751],
    [268,592],[282,582],[255,600],[286,608],[262,578],
    [205,628],[219,618],[192,636],[223,644],[199,614],
    [348,372],[362,362],[335,380],[366,388],[342,358],
    [315,422],[328,412],[302,430],[332,438],[308,408],
    [272,562],[285,552],[259,570],[289,578],[265,548],
    [232,422],[245,412],[219,430],[249,438],[225,408],
    [88,322],[102,315],[75,330],[106,338],[82,312],
    [170,342],[183,335],[157,350],[187,358],[163,332],
    [242,332],[255,325],[229,340],[259,348],[235,322],
    [318,312],[331,305],[305,320],[335,328],[311,302],
    [58,482],[72,475],[45,490],[76,498],[52,472],
    [142,462],[155,455],[129,470],[159,478],[135,452],
    [215,472],[228,465],[202,480],[232,488],[208,462],
    [295,452],[308,445],[282,460],[312,468],[288,442],
    [358,462],[371,455],[345,470],[375,478],[351,452],
  ].map(([cx, cy], i) => ({ cx, cy, r: i % 3 === 0 ? 6 : i % 3 === 1 ? 5 : 4, delay: 0.3 + (i * 0.008) }));

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          className="fixed inset-0 z-[1000] pointer-events-none"
          initial={{ opacity: 1 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ exit: { duration: 0.4, delay: 0.1 } }}
        >
          <svg
            className="absolute inset-0 w-full h-full"
            viewBox="0 0 390 844"
            preserveAspectRatio="xMidYMid slice"
          >
            <rect width="390" height="844" fill="#f5ede0" />
            
            {branches.map((b, i) => (
              <motion.path
                key={i}
                d={b.d}
                stroke="#7b3f1a"
                strokeWidth={b.w}
                strokeLinecap="round"
                strokeLinejoin="round"
                fill="none"
                initial={{ pathLength: 0, opacity: 0 }}
                animate={{ pathLength: 1, opacity: 1 }}
                exit={{ pathLength: 0, opacity: 0 }}
                transition={{ duration: 0.5, delay: b.delay, ease: "easeInOut" }}
              />
            ))}

            {leaves.map((l, i) => (
              <motion.circle
                key={`l${i}`}
                cx={l.cx} cy={l.cy} r={l.r}
                fill="#7b3f1a"
                initial={{ scale: 0, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0, opacity: 0 }}
                transition={{ duration: 0.2, delay: l.delay }}
              />
            ))}
          </svg>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default function App() {
  const [view, setView] = useState<
    'auth' | 'register' | 'confirm-email' | 'welcome' | 'location' |
    'menu' | 'cart' | 'checkout' | 'success' | 'profile' | 'coupons' | 'support' | 'awaiting_weighing'
  >('auth');
  const [location, setLocation] = useState<string>('');
  const [cart, setCart] = useState<{
    item: DynamicMenuItem
    quantity: number
    cartKey: string
    weightOption: WeightOption | null
    price: number
  }[]>([]);
  const [orderCode, setOrderCode] = useState<string>('');
  const [fidelityNewCoupon, setFidelityNewCoupon] = useState<string | null>(null);
  const [loginAnim, setLoginAnim] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [showAllLocations, setShowAllLocations] = useState(false);
  const [user, setUser] = useState<any>(null);
  const [adminStatus, setAdminStatus] = useState<null | boolean>(null);
  const [menuItems, setMenuItems] = useState<DynamicMenuItem[]>([]);
  const [weightModal, setWeightModal] = useState<DynamicMenuItem | null>(null);
  const [awaitingWeighingOrderId, setAwaitingWeighingOrderId] = useState<string | null>(null);
  const [weighedTotal, setWeighedTotal] = useState<number | null>(null);
  
  const checkRole = React.useCallback(async (userId: string) => {
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      setAdminStatus(false);
      setView('location');
      return;
    }
  
    const { data, error } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', userId)
      .single();
  
    if (error) {
      console.error('checkRole error:', error.message);
      setAdminStatus(false);
      setView('location');
      return;
    }
  
    if (data?.role === 'admin') {
      setAdminStatus(true);
    } else {
      setAdminStatus(false);
      setView('location');
    }
  }, []);

  // ─── AUTH LISTENER ────────────────────────────────────────────
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (event === 'SIGNED_OUT') {
          setUser(null);
          setAdminStatus(false);
          setView('auth');
          return;
        }

        if ((event === 'SIGNED_IN' || event === 'INITIAL_SESSION') && session?.user) {
          setUser(session.user);
          checkRole(session.user.id);
          return;
        }

        if (event === 'INITIAL_SESSION' && !session) {
          setAdminStatus(false);
          setView('auth');
        }
      }
    );

    return () => subscription.unsubscribe();
  }, [checkRole]);

  // ─── FETCH MENU FROM SUPABASE ─────────────────────────────────
  useEffect(() => {
    supabase
      .from('menu_items')
      .select('*, weight_options(*)')
      .eq('available', true)
      .order('sort_order')
      .then(({ data }) => {
        if (!data) return;
        setMenuItems(data.map(item => ({
          id: item.id,
          name: item.name,
          category: item.category,
          desc: item.description,
          price: item.price,
          image: item.image_url,
          weight_mode: item.weight_mode ?? false,
          weight_options: (item.weight_options ?? []).sort((a: WeightOption, b: WeightOption) => a.sort_order - b.sort_order),
        })));
      });
  }, [user]);

  if (adminStatus === null) {
    return (
      <div className="min-h-screen bg-brand-cream flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <svg className="animate-spin h-8 w-8 text-brand-red" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
          </svg>
          <p className="text-brand-dark/40 text-sm">Verificando...</p>
        </div>
      </div>
    );
  }

  if (adminStatus === true) {
    return <AdminPanel />;
  }

  const handleLoginClick = async (provider: 'google' | 'apple') => {
    await supabase.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo: 'https://freofigures-nosso-churras.7t6kue.easypanel.host/',
        skipBrowserRedirect: false,
      }
    });
  };

  const handleRegister = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget;
    const name = (form.elements.namedItem('name') as HTMLInputElement).value;
    const email = (form.elements.namedItem('email') as HTMLInputElement).value;
    const password = (form.elements.namedItem('password') as HTMLInputElement).value;
    const { error } = await supabase.auth.signUp({ email, password, options: { data: { full_name: name } } });
    if (!error) setView('confirm-email');
  };

  const handleAddToCart = (item: DynamicMenuItem, weightOption?: WeightOption) => {
    if (item.weight_mode && item.weight_options.length > 0 && !weightOption) {
      setWeightModal(item);
      return;
    }

    const cartKey = weightOption ? `${item.id}_${weightOption.id}` : String(item.id);
    const price = weightOption ? weightOption.price : item.price;

    setCart(prev => {
      const existing = prev.find(i => i.cartKey === cartKey);
      if (existing) {
        return prev.map(i => i.cartKey === cartKey ? { ...i, quantity: i.quantity + 1 } : i);
      }
      return [...prev, {
        item,
        quantity: 1,
        cartKey,
        weightOption: weightOption ?? null,
        price,
      }];
    });
  };

  const handleRemoveFromCart = (cartKey: string) => {
    setCart(prev => {
      const existing = prev.find(i => i.cartKey === cartKey);
      if (existing && existing.quantity > 1) {
        return prev.map(i => i.cartKey === cartKey ? { ...i, quantity: i.quantity - 1 } : i);
      }
      return prev.filter(i => i.cartKey !== cartKey);
    });
  };

  const handleWeighing = async () => {
    // Gera o código do pedido
    let code: string;
    if (location === 'Retirada no Balcão') {
      code = Math.random().toString(36).substring(2, 8).toUpperCase();
    } else {
      const { data: lastOrder } = await supabase
        .from('orders')
        .select('order_code')
        .neq('location', 'Retirada no Balcão')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
  
      const lastNumber = lastOrder ? parseInt(lastOrder.order_code, 10) : 0;
      const nextNumber = (isNaN(lastNumber) ? 0 : lastNumber) + 1;
      code = nextNumber.toString().padStart(3, '0');
    }
  
    setOrderCode(code);
  
    if (user?.id) {
      const { data: orderData, error } = await supabase
        .from('orders')
        .insert({
          user_id: user.id,
          location: location,
          items: cart.map(c => ({
            id: c.item.id,
            name: c.item.name,
            price: c.price,
            quantity: c.quantity,
            weight_mode: c.item.weight_mode,
            chosen_label: c.weightOption?.label ?? null,
            chosen_max_grams: c.weightOption?.max_grams ?? null,
            weight_option_id: c.weightOption?.id ?? null,
            unit_price: c.price,
            final_price: null,
            real_grams: null,
          })),
          total: cartTotal,
          payment_type: 'local', // será definido após pesagem
          order_code: code,
          status: 'awaiting_weighing',
        })
        .select('id')
        .single();
  
      if (error) {
        console.error('Erro ao salvar pedido:', error.message);
        return;
      }
  
      if (orderData?.id) {
        setAwaitingWeighingOrderId(orderData.id);
        setView('awaiting_weighing');
      }
    }
  };
  
  const cartTotal = cart.reduce((acc, curr) => acc + (curr.price * curr.quantity), 0);
  const cartCount = cart.reduce((acc, curr) => acc + curr.quantity, 0);

  return (
    <div className="font-sans min-h-screen bg-brand-cream text-brand-dark selection:bg-brand-red selection:text-white pb-safe max-w-md mx-auto shadow-2xl relative bg-[url('https://www.transparenttextures.com/patterns/rice-paper-2.png')] overflow-hidden">
      
      <BranchTransition isVisible={loginAnim} />

      {/* MODAL SELEÇÃO DE FAIXA DE PESO */}
      <AnimatePresence>
        {weightModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 z-[200] flex items-end justify-center p-4"
            onClick={() => setWeightModal(null)}
          >
            <motion.div
              initial={{ y: 100 }}
              animate={{ y: 0 }}
              exit={{ y: 100 }}
              onClick={e => e.stopPropagation()}
              className="bg-brand-cream w-full max-w-md rounded-3xl p-6 shadow-2xl"
            >
              <h3 className="font-display text-2xl text-brand-dark mb-1">{weightModal.name}</h3>
              <p className="text-sm text-brand-dark/60 mb-6">Escolha a faixa de peso desejada:</p>

              <div className="space-y-3 mb-6">
                {weightModal.weight_options.map(opt => (
                  <button
                    key={opt.id}
                    onClick={() => {
                      handleAddToCart(weightModal, opt);
                      setWeightModal(null);
                    }}
                    className="w-full bg-white border-2 border-brand-gold/20 rounded-2xl p-4 flex items-center justify-between hover:border-brand-red hover:bg-brand-red/5 transition text-left"
                  >
                    <div>
                      <div className="font-bold text-brand-dark">{opt.label}</div>
                      <div className="text-xs text-brand-dark/50 mt-0.5">Até {opt.max_grams}g</div>
                    </div>
                    <div className="font-display text-xl text-brand-red">
                      R$ {Number(opt.price).toFixed(2).replace('.', ',')}
                    </div>
                  </button>
                ))}
              </div>

              <button
                onClick={() => setWeightModal(null)}
                className="w-full py-3 text-brand-dark/50 font-bold hover:text-brand-dark transition"
              >
                Cancelar
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence mode="wait">
        
        {/* AUTH SCREEN */}
        {view === 'auth' && (
          <motion.div
            key="auth"
            variants={pageVariants}
            initial="initial"
            animate="animate"
            exit="exit"
            className="min-h-screen bg-brand-cream flex flex-col p-6 relative z-10"
          >
            <div className="flex-1 flex flex-col justify-center relative z-10 w-full mt-4">
              <div className="flex flex-col items-center mb-8 w-full">
                <span className="text-brand-dark/50 text-sm font-bold tracking-[0.2em] uppercase mb-0 mt-3 relative z-20">Bem vindo ao</span>
                <div className="relative flex items-center justify-center w-full h-[240px] pointer-events-none" style={{ overflow: 'visible', marginTop: '24px' }}>
                  <img 
                    src="/logo.png" 
                    alt="Praça Nosso Churras" 
                    className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-auto object-contain z-10 select-none"
                    style={{ 
                      width: '140vw',
                      maxWidth: '560px',
                      filter: 'drop-shadow(0px 8px 12px rgba(26, 9, 5, 0.15))',
                      marginLeft: '8%'
                    }}
                    onError={(e) => {
                      e.currentTarget.onerror = null;
                      e.currentTarget.src = "https://placehold.co/800x600/transparent/1a0905.png?text=Pra%C3%A7a+Nosso+Churras";
                    }}
                  />
                </div>
                
                <p className="text-brand-dark/70 text-center text-sm font-medium mt-0 relative z-20">Faça login para continuar sua resenha</p>
              </div>

              <div className="space-y-4 w-full max-w-sm mx-auto">
                <div className="flex flex-col gap-3">
                  <button onClick={() => handleLoginClick('google')} className="w-full bg-white border border-brand-gold/20 text-brand-dark p-4 rounded-2xl flex items-center justify-center gap-3 font-semibold shadow-sm hover:bg-gray-50 transition active:scale-[0.98]">
                    <GoogleIcon />
                    Continuar com Google
                  </button>
                  <button onClick={() => handleLoginClick('apple')} className="w-full bg-black text-white p-4 rounded-2xl flex items-center justify-center gap-3 font-semibold shadow-sm hover:bg-gray-900 transition active:scale-[0.98]">
                    <AppleIcon />
                    Continuar com Apple
                  </button>
                </div>

                <div className="relative flex items-center py-4">
                  <div className="flex-grow border-t border-brand-gold/30"></div>
                  <span className="flex-shrink-0 mx-4 text-brand-dark/40 text-sm font-bold uppercase">ou</span>
                  <div className="flex-grow border-t border-brand-gold/30"></div>
                </div>

                <button onClick={() => setView('register')} className="w-full bg-brand-red text-white p-4 rounded-2xl font-bold tracking-wide flex items-center justify-center shadow-lg hover:bg-red-700 transition active:scale-[0.98]">
                  Fazer Cadastro
                </button>
              </div>
            </div>
            <div className="text-center mt-auto pb-4">
               <p className="text-xs text-brand-dark/50">Ao continuar, você concorda com nossos Termos e Condições.</p>
            </div>
          </motion.div>
        )}

        {/* REGISTER SCREEN */}
        {view === 'register' && (
          <motion.div
            key="register"
            variants={pageVariants}
            initial="initial"
            animate="animate"
            exit="exit"
            className="min-h-screen bg-brand-cream flex flex-col p-6 relative z-10"
          >
            <button onClick={() => setView('auth')} className="absolute top-6 left-6 p-2 bg-white rounded-full shadow-sm hover:bg-brand-gold/10 transition z-20">
              <ArrowLeft size={24} className="text-brand-dark" />
            </button>
            
            <div className="flex-1 flex flex-col justify-center max-w-sm mx-auto w-full mt-12">
              <div className="mb-8">
                <h2 className="font-display text-4xl text-brand-dark mb-2">Criar Conta</h2>
                <p className="text-brand-dark/70">Preencha seus dados para entrar na roda.</p>
              </div>

              <form onSubmit={handleRegister} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-brand-dark/70 uppercase tracking-wider mb-1.5 ml-1">Nome Completo</label>
                  <input name="name" type="text" required placeholder="João da Silva" className="w-full bg-white border border-brand-gold/30 rounded-2xl p-4 text-brand-dark placeholder:text-brand-dark/30 focus:outline-none focus:ring-2 focus:ring-brand-red/50 shadow-sm transition" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-brand-dark/70 uppercase tracking-wider mb-1.5 ml-1">Telefone</label>
                  <input type="tel" required placeholder="(11) 99999-9999" className="w-full bg-white border border-brand-gold/30 rounded-2xl p-4 text-brand-dark placeholder:text-brand-dark/30 focus:outline-none focus:ring-2 focus:ring-brand-red/50 shadow-sm transition" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-brand-dark/70 uppercase tracking-wider mb-1.5 ml-1">E-mail</label>
                  <input name="email" type="email" required placeholder="joao@exemplo.com" className="w-full bg-white border border-brand-gold/30 rounded-2xl p-4 text-brand-dark placeholder:text-brand-dark/30 focus:outline-none focus:ring-2 focus:ring-brand-red/50 shadow-sm transition" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-brand-dark/70 uppercase tracking-wider mb-1.5 ml-1">Senha</label>
                  <input name="password" type="password" required placeholder="Mínimo 6 caracteres" className="w-full bg-white border border-brand-gold/30 rounded-2xl p-4 text-brand-dark placeholder:text-brand-dark/30 focus:outline-none focus:ring-2 focus:ring-brand-red/50 shadow-sm transition" />
                </div>

                <div className="pt-4">
                  <button type="submit" className="w-full bg-brand-red text-white p-4 rounded-2xl font-bold tracking-wide flex items-center justify-center shadow-lg hover:bg-red-700 transition active:scale-[0.98]">
                    Finalizar Cadastro
                  </button>
                </div>
              </form>
            </div>
          </motion.div>
        )}

        {/* CONFIRM EMAIL SCREEN */}
        {view === 'confirm-email' && (
          <motion.div
            key="confirm-email"
            variants={pageVariants}
            initial="initial"
            animate="animate"
            exit="exit"
            className="min-h-screen bg-brand-cream flex flex-col items-center justify-center p-6 text-center relative z-10"
          >
            <div className="relative z-10 flex flex-col items-center w-full max-w-sm mx-auto">
              <div className="w-24 h-24 bg-brand-red rounded-full flex items-center justify-center mb-8 shadow-lg">
                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="2" y="4" width="20" height="16" rx="2"/>
                  <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/>
                </svg>
              </div>

              <h2 className="font-display text-4xl text-brand-dark mb-3">Confirme seu E-mail</h2>
              <p className="text-brand-dark/70 text-base mb-10 leading-relaxed">
                Enviamos um link de confirmação para o seu e-mail. Acesse sua caixa de entrada e clique no link para ativar sua conta.
              </p>

              <div className="w-full bg-white border border-brand-gold/20 rounded-3xl p-6 mb-8 shadow-sm text-left space-y-4">
                <div className="flex items-start gap-3">
                  <div className="w-6 h-6 bg-brand-red/10 rounded-full flex items-center justify-center mt-0.5 shrink-0">
                    <span className="text-brand-red font-bold text-xs">1</span>
                  </div>
                  <p className="text-sm text-brand-dark/80">Abra o e-mail que enviamos para você</p>
                </div>
                <div className="flex items-start gap-3">
                  <div className="w-6 h-6 bg-brand-red/10 rounded-full flex items-center justify-center mt-0.5 shrink-0">
                    <span className="text-brand-red font-bold text-xs">2</span>
                  </div>
                  <p className="text-sm text-brand-dark/80">Clique no botão <strong>"Confirmar E-mail"</strong></p>
                </div>
                <div className="flex items-start gap-3">
                  <div className="w-6 h-6 bg-brand-red/10 rounded-full flex items-center justify-center mt-0.5 shrink-0">
                    <span className="text-brand-red font-bold text-xs">3</span>
                  </div>
                  <p className="text-sm text-brand-dark/80">Volte ao app e faça seu login</p>
                </div>
              </div>

              <button
                onClick={() => setView('auth')}
                className="w-full bg-brand-red text-white p-4 rounded-2xl font-bold tracking-wide flex items-center justify-center shadow-lg hover:bg-red-700 transition active:scale-[0.98]"
              >
                Ir para o Login
              </button>

              <p className="text-xs text-brand-dark/40 mt-6">Não recebeu o e-mail? Verifique sua pasta de spam.</p>
            </div>
          </motion.div>
        )}

        {/* WELCOME SCREEN */}
        {view === 'welcome' && (
          <motion.div
            key="welcome"
            variants={pageVariants}
            initial="initial"
            animate="animate"
            exit="exit"
            className="min-h-screen bg-brand-cream flex flex-col items-center justify-center p-6 text-center relative z-10"
          >
            <div className="absolute inset-0 opacity-[0.03] bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-brand-dark via-brand-dark to-brand-dark pointer-events-none"></div>

            <div className="relative z-10 flex flex-col items-center w-full">
              <div className="relative flex items-center justify-center w-full h-[240px] pointer-events-none mb-6" style={{ overflow: 'visible' }}>
                <img 
                  src="/logo.png" 
                  alt="Praça Nosso Churras" 
                  className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-auto object-contain z-10 select-none animate-[pulse_4s_ease-in-out_infinite]"
                  style={{ 
                    width: '140vw',
                    maxWidth: '560px',
                    filter: 'drop-shadow(0px 8px 12px rgba(26, 9, 5, 0.15))',
                    marginLeft: '8%'
                  }}
                  onError={(e) => {
                    e.currentTarget.onerror = null;
                    e.currentTarget.src = "https://placehold.co/800x600/transparent/1a0905.png?text=Pra%C3%A7a+Nosso+Churras";
                  }}
                />
              </div>
              
              <p className="font-sans text-lg mb-12 text-brand-dark/80 max-w-[280px] sm:max-w-xs mx-auto font-medium relative z-20">
                Onde a qualidade encontra o encontro. Seu churrasco favorito.
              </p>
              
              <button 
                onClick={() => setView('location')} 
                className="group relative bg-brand-red text-brand-cream text-lg font-bold uppercase tracking-wider py-4 px-12 md:px-16 rounded-full overflow-hidden shadow-[0_0_20px_rgba(183,53,39,0.3)] hover:shadow-[0_0_30px_rgba(183,53,39,0.5)] hover:scale-105 active:scale-95 transition-all duration-300"
              >
                <div className="absolute inset-0 w-full h-full bg-white/20 scale-x-0 group-hover:scale-x-100 origin-left transition-transform duration-300"></div>
                <span className="relative z-10">Fazer Pedido</span>
              </button>
            </div>
          </motion.div>
        )}

        {/* LOCATION SCREEN */}
        {view === 'location' && (
          <motion.div
            key="location"
            variants={pageVariants}
            initial="initial"
            animate="animate"
            exit="exit"
            className="min-h-screen flex flex-col p-6 pt-12"
          >
            <div className="flex items-center mb-6">
              <button onClick={() => setView('welcome')} className="p-2 -ml-2 hover:bg-brand-gold/20 rounded-full transition w-fit">
                <ArrowLeft size={28} className="text-brand-dark" />
              </button>
            </div>
            <h2 className="font-display text-4xl text-brand-dark mb-2">Onde a resenha tá rolando?</h2>
            <p className="text-brand-dark/70 mb-6">Selecione ou busque o número da sua churrasqueira.</p>
            
            <div className="relative mb-6">
              <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none">
                <Search size={20} className="text-brand-dark/40" />
              </div>
              <input
                type="number"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Qual o número?"
                className="w-full bg-white border-2 border-brand-gold/20 rounded-2xl py-4 pl-12 pr-4 text-lg font-bold text-brand-dark focus:outline-none focus:border-brand-red placeholder:text-brand-dark/40 shadow-sm"
              />
            </div>

            <div className="flex-1 overflow-y-auto hide-scrollbar pb-8 -mx-2 px-2">
              <div className="grid grid-cols-4 sm:grid-cols-5 gap-3 mb-8">
                {Array.from({ length: 75 }, (_, i) => i + 1)
                  .filter(num => !searchTerm || num.toString().includes(searchTerm))
                  .slice(0, showAllLocations || searchTerm ? undefined : 10)
                  .map(num => (
                  <button 
                    key={num}
                    onClick={() => { setLocation(`Churrasqueira ${num}`); setView('menu'); }} 
                    className="bg-white border-2 border-brand-gold/20 aspect-square rounded-2xl flex flex-col items-center justify-center gap-1 hover:border-brand-red hover:bg-brand-red hover:text-white transition-all text-brand-dark shadow-sm group"
                  >
                    <span className="text-2xl font-black group-hover:scale-110 transition-transform">{num}</span>
                    <span className="text-[10px] font-bold uppercase tracking-wider opacity-60 group-hover:opacity-100">Churr.</span>
                  </button>
                ))}
                {!searchTerm && (
                  <button
                    onClick={() => setShowAllLocations(!showAllLocations)}
                    className="col-span-full mt-2 py-3 border-2 border-dashed border-brand-gold/40 text-brand-dark rounded-xl font-bold hover:bg-brand-gold/10 transition-colors"
                  >
                    {showAllLocations ? "Ocultar churrasqueiras" : "Ver todas as churrasqueiras"}
                  </button>
                )}
                {Array.from({ length: 75 }, (_, i) => i + 1).filter(num => !searchTerm || num.toString().includes(searchTerm)).length === 0 && (
                   <div className="col-span-full py-8 text-center text-brand-dark/50 font-medium">Nenhuma churrasqueira encontrada com "{searchTerm}".</div>
                )}
              </div>
              
              <button 
                onClick={() => { setLocation('Retirada no Balcão'); setView('menu'); }} 
                className="w-full bg-brand-dark text-brand-cream p-5 rounded-2xl flex items-center justify-center gap-3 hover:bg-black hover:scale-[1.02] shadow-xl transition-all font-bold sticky bottom-4 z-10"
              >
                <ShoppingBag className="text-brand-gold" size={24} />
                <span className="text-lg">Zerar a brasa (Retirada)</span>
              </button>
            </div>
          </motion.div>
        )}

        {/* MENU SCREEN */}
        {view === 'menu' && (
          <MenuScreen 
            menuItems={menuItems}
            location={location} 
            cartCount={cartCount}
            cartTotal={cartTotal}
            onBack={() => setView('location')} 
            onCart={() => setView('cart')}
            onProfile={() => setView('profile')}
            onCoupons={() => setView('coupons')}
            onSupport={() => setView('support')}
            cartItems={cart}
            onAdd={handleAddToCart}
            onRemove={handleRemoveFromCart}
          />
        )}

        {/* CART SCREEN */}
        {view === 'cart' && (
          <CartScreen
             cart={cart}
             location={location}
             cartTotal={cartTotal}
             onBack={() => setView('menu')}
             onAdd={handleAddToCart}
             onRemove={handleRemoveFromCart}
             onCheckout={() => setView('checkout')}
             onWeighing={handleWeighing}
          />
        )}

        {/* CHECKOUT SCREEN */}
        {view === 'checkout' && (
          <CheckoutScreen
            location={location}
            cartTotal={weighedTotal !== null ? weighedTotal : cartTotal}
            onBack={() => setView('cart')}
            onFinalize={async (paymentType: 'app' | 'local') => {
              if (awaitingWeighingOrderId) {
                await supabase
                  .from('orders')
                  .update({
                    payment_type: paymentType,
                    status: 'preparing',
                  })
                  .eq('id', awaitingWeighingOrderId);

                if (user?.id) {
                  const result = await addSpentAndCheckGoal(user.id, cartTotal);
                  if (result.couponGenerated && result.couponCode) {
                    setFidelityNewCoupon(result.couponCode);
                  }
                }

                setView('success');
                return;
              }

              let code: string;
              if (location === 'Retirada no Balcão') {
                code = Math.random().toString(36).substring(2, 8).toUpperCase();
              } else {
                const { data: lastOrder } = await supabase
                  .from('orders')
                  .select('order_code')
                  .neq('location', 'Retirada no Balcão')
                  .order('created_at', { ascending: false })
                  .limit(1)
                  .maybeSingle();
                const lastNumber = lastOrder ? parseInt(lastOrder.order_code, 10) : 0;
                const nextNumber = (isNaN(lastNumber) ? 0 : lastNumber) + 1;
                code = nextNumber.toString().padStart(3, '0');
              }

              setOrderCode(code);

              if (user?.id) {
                const { error } = await supabase
                  .from('orders')
                  .insert({
                    user_id: user.id,
                    location: location,
                    items: cart.map(c => ({
                      id: c.item.id,
                      name: c.item.name,
                      price: c.price,
                      quantity: c.quantity,
                      weight_mode: c.item.weight_mode,
                      chosen_label: c.weightOption?.label ?? null,
                      chosen_max_grams: c.weightOption?.max_grams ?? null,
                      weight_option_id: c.weightOption?.id ?? null,
                      unit_price: c.price,
                      final_price: null,
                      real_grams: null,
                    })),
                    total: cartTotal,
                    payment_type: paymentType,
                    order_code: code,
                    status: 'pending',
                  });

                if (error) {
                  console.error('Erro ao salvar pedido:', error.message);
                  return;
                }

                const result = await addSpentAndCheckGoal(user.id, cartTotal);
                if (result.couponGenerated && result.couponCode) {
                  setFidelityNewCoupon(result.couponCode);
                }
              }

              setView('success');
            }}
          />
        )}
        {/* PROFILE SCREEN */}
        {(view === 'profile' || view === 'coupons') && (
          <ProfileScreen 
            key={view}
            user={user}
            cartCount={cartCount}
            initialSubView={view === 'coupons' ? 'coupons' : 'main'}
            onBack={() => setView('menu')}
            onCart={() => setView('cart')}
            onHome={() => setView('location')}
            onCoupons={() => setView('coupons')}
            onProfile={() => setView('profile')}
            onSupport={() => setView('support')}
          />
        )}

        {/* SUPPORT SCREEN */}
        {view === 'support' && (
          <SupportScreen
            cartCount={cartCount}
            onBack={() => setView('menu')}
            onNavigate={(tab: string) => {
               if (tab === 'home') setView('location');
               if (tab === 'coupons') setView('coupons');
               if (tab === 'cart') setView('cart');
               if (tab === 'profile') setView('profile');
            }}
          />
        )}

        {/* AWAITING WEIGHING SCREEN */}
        {view === 'awaiting_weighing' && awaitingWeighingOrderId && (
          <AwaitingWeighingScreen
            key="awaiting_weighing"
            orderId={awaitingWeighingOrderId}
            orderCode={orderCode}
            location={location}
            onConfirmed={async (finalPrice: number) => {
              setWeighedTotal(finalPrice);
              setView('checkout');
            }}
          />
        )}

        {/* SUCCESS SCREEN */}
        {view === 'success' && (
          <motion.div
            key="success"
            variants={pageVariants}
            initial="initial"
            animate="animate"
            exit="exit"
            className="min-h-screen bg-brand-red text-white flex flex-col items-center justify-center p-6 text-center"
          >
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: 'spring', bounce: 0.5, delay: 0.2 }}
            >
              <ChefHat size={80} className="text-brand-gold mb-6 mx-auto" />
            </motion.div>
            <h1 className="font-display text-5xl mb-4">Pedido na Brasa!</h1>
            <p className="text-brand-cream/90 text-lg mb-8 max-w-sm">
              Tudo anotado para o seu momento.{' '}
              {location === 'Retirada no Balcão'
                ? 'Apresente o código abaixo no balcão para retirar.'
                : 'Aproveite a resenha enquanto levamos seu churrasco.'}
            </p>
        
            <div className="bg-brand-dark w-full max-w-sm p-8 rounded-3xl mb-6 shadow-2xl relative overflow-hidden">
              <div className="absolute top-0 left-0 w-full h-1 bg-brand-gold"></div>
              <div className="text-brand-gold text-xs font-bold uppercase tracking-widest mb-2">Seu Local</div>
              <div className="text-xl mb-6">{location}</div>
              {location === 'Retirada no Balcão' ? (
                <>
                  <div className="text-brand-gold text-xs font-bold uppercase tracking-widest mb-2">Código de Retirada</div>
                  <div className="font-display text-6xl text-brand-cream tracking-widest">{orderCode}</div>
                </>
              ) : (
                <>
                  <div className="text-brand-gold text-xs font-bold uppercase tracking-widest mb-2">Número do Pedido</div>
                  <div className="font-display text-6xl text-brand-cream">#{orderCode}</div>
                </>
              )}
            </div>
        
            {fidelityNewCoupon && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.5 }}
                className="w-full max-w-sm bg-brand-gold text-brand-dark p-5 rounded-2xl mb-6 shadow-xl"
              >
                <div className="flex items-center gap-2 mb-1">
                  <Gift size={20} className="text-brand-dark" />
                  <span className="font-bold text-sm uppercase tracking-wider">Meta atingida! Cupom gerado 🎉</span>
                </div>
                <div className="font-display text-2xl tracking-widest">{fidelityNewCoupon}</div>
                <p className="text-xs mt-1 text-brand-dark/70">Use na sua próxima visita • válido em Cupons no app</p>
              </motion.div>
            )}
        
            <button
              onClick={() => {
                setCart([]);
                setOrderCode('');
                setFidelityNewCoupon(null);
                setAwaitingWeighingOrderId(null);
                setWeighedTotal(null);
                setView('welcome');
              }}
              className="bg-brand-cream text-brand-red font-bold text-lg py-4 px-10 rounded-full hover:scale-105 transition shadow-xl"
            >
              Voltar ao Início
            </button>
          </motion.div>
        )}

      </AnimatePresence>
    </div>
  );
}

// ─── AWAITING WEIGHING SCREEN ─────────────────────────────────────

function AwaitingWeighingScreen({
  orderId,
  orderCode,
  location,
  onConfirmed,
}: {
  orderId: string
  orderCode: string
  location: string
  onConfirmed: (finalPrice: number) => void
}) {
  const [notification, setNotification] = useState<{
    message: string
    photo_url: string | null
    real_grams: number
    final_price: number
  } | null>(null);
  const [confirmed, setConfirmed] = useState(false);

  useEffect(() => {
    supabase
      .from('order_notifications')
      .select('*')
      .eq('order_id', orderId)
      .eq('type', 'weight_update')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()
      .then(({ data }) => {
        if (data) setNotification(data);
      });

    const channel = supabase
      .channel(`weighing-${orderId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'order_notifications',
          filter: `order_id=eq.${orderId}`,
        },
        (payload) => {
          setNotification(payload.new as any);
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [orderId]);

  const handleConfirm = async () => {
    setConfirmed(true);
    await supabase
      .from('orders')
      .update({ status: 'preparing' })
      .eq('id', orderId);
    onConfirmed(notification?.final_price ?? 0);
  };

  return (
    <motion.div
      key="awaiting_weighing"
      variants={pageVariants}
      initial="initial"
      animate="animate"
      exit="exit"
      className="min-h-screen bg-brand-cream flex flex-col items-center justify-center p-6 text-center"
    >
      {!notification ? (
        <div className="flex flex-col items-center gap-6 max-w-sm w-full">
          <div className="w-24 h-24 bg-brand-red/10 rounded-full flex items-center justify-center">
            <Scale size={48} className="text-brand-red animate-pulse" />
          </div>
          <h2 className="font-display text-4xl text-brand-dark">Aguardando Pesagem</h2>
          <p className="text-brand-dark/70 leading-relaxed">
            Seu pedido foi recebido! Estamos pesando seu corte na balança para garantir o preço exato. Aguarde um momento...
          </p>

          <div className="w-full bg-white border border-brand-gold/20 rounded-3xl p-6 shadow-sm space-y-4 text-left">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-brand-red rounded-full flex items-center justify-center">
                <CheckCircle size={16} className="text-white" />
              </div>
              <div>
                <div className="font-bold text-sm text-brand-dark">Pedido recebido</div>
                <div className="text-xs text-brand-dark/50">#{orderCode} • {location}</div>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-brand-gold/30 rounded-full flex items-center justify-center">
                <Scale size={16} className="text-brand-dark/60" />
              </div>
              <div>
                <div className="font-bold text-sm text-brand-dark/60">Pesando seu corte...</div>
                <div className="text-xs text-brand-dark/40">Você será avisado em instantes</div>
              </div>
            </div>
            <div className="flex items-center gap-3 opacity-30">
              <div className="w-8 h-8 bg-brand-cream rounded-full flex items-center justify-center border-2 border-brand-dark/20">
                <ChefHat size={16} className="text-brand-dark/40" />
              </div>
              <div>
                <div className="font-bold text-sm text-brand-dark/40">Preparando</div>
                <div className="text-xs text-brand-dark/30">Após confirmação</div>
              </div>
            </div>
          </div>

          <div className="flex gap-1.5 mt-2">
            {[0, 1, 2].map(i => (
              <motion.div
                key={i}
                className="w-2 h-2 bg-brand-red rounded-full"
                animate={{ opacity: [0.3, 1, 0.3] }}
                transition={{ duration: 1.2, repeat: Infinity, delay: i * 0.4 }}
              />
            ))}
          </div>
        </div>
      ) : (
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col items-center gap-6 max-w-sm w-full"
        >
          <div className="w-24 h-24 bg-green-100 rounded-full flex items-center justify-center">
            <CheckCircle size={48} className="text-green-500" />
          </div>
          <h2 className="font-display text-4xl text-brand-dark">Pesagem Concluída!</h2>
          <p className="text-brand-dark/70">Confira o peso e o valor final do seu corte:</p>

          {notification.photo_url && (
            <div className="w-full rounded-3xl overflow-hidden shadow-lg border border-brand-gold/20">
              <img
                src={notification.photo_url}
                alt="Foto da balança"
                className="w-full object-cover max-h-56"
              />
            </div>
          )}

          <div className="w-full bg-brand-dark text-brand-cream rounded-3xl p-6 shadow-xl">
            <div className="flex justify-between items-center mb-4 pb-4 border-b border-white/10">
              <span className="text-brand-cream/60 text-sm">Peso real</span>
              <span className="font-bold text-lg">{notification.real_grams}g</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-brand-cream/60 text-sm">Valor final</span>
              <span className="font-display text-2xl text-brand-red">
                R$ {Number(notification.final_price).toFixed(2).replace('.', ',')}
              </span>
            </div>
          </div>

          <p className="text-xs text-brand-dark/50 px-4">{notification.message}</p>

          <button
            onClick={handleConfirm}
            disabled={confirmed}
            className="w-full bg-brand-red text-white p-5 rounded-2xl font-bold text-lg shadow-2xl hover:bg-red-700 transition disabled:opacity-50"
          >
            {confirmed ? 'Confirmando...' : 'Confirmar e Continuar'}
          </button>
        </motion.div>
      )}
    </motion.div>
  );
}

// ─── CATEGORY TABS ────────────────────────────────────────────────

const CATEGORY_TABS = [
  { id: 'Todos', label: 'Tudo', icon: LayoutGrid, color: 'text-brand-dark' },
  { id: 'Carnes', label: 'Cortes', icon: Beef, color: 'text-brand-red' },
  { id: 'Acompanhamentos', label: 'Acomp.', icon: UtensilsCrossed, color: 'text-brand-gold' },
  { id: 'Bebidas', label: 'Bebidas', icon: Beer, color: 'text-yellow-600' },
];

function MenuScreen({ menuItems, location, cartCount, cartTotal, onBack, onCart, onProfile, onCoupons, onSupport, cartItems, onAdd, onRemove }: any) {
  const [activeCat, setActiveCat] = useState<'Todos' | 'Carnes' | 'Acompanhamentos' | 'Bebidas'>('Todos');

  const filteredMenu = activeCat === 'Todos' ? menuItems : menuItems.filter((i: any) => i.category === activeCat);

  return (
    <motion.div
      key="menu"
      variants={pageVariants}
      initial="initial"
      animate="animate"
      exit="exit"
      className="min-h-screen flex flex-col bg-brand-cream pb-32"
    >
      <div className="sticky top-0 z-40 bg-brand-dark text-brand-cream px-6 py-4 flex items-center justify-between shadow-md">
        <button onClick={onBack} className="p-2 -ml-2 rounded-full hover:bg-brand-gold/20 transition">
          <ArrowLeft size={24} />
        </button>
        <div className="text-center flex-1">
          <div className="text-[10px] text-brand-gold font-bold uppercase tracking-[0.2em] mb-0.5">Local</div>
          <div className="font-display text-xl leading-none">{location}</div>
        </div>
        <button onClick={onCart} className="relative p-2 -mr-2 hover:bg-brand-gold/20 rounded-full transition">
           <ShoppingBag size={24} />
           {cartCount > 0 && (
             <motion.span 
               initial={{ scale: 0 }} 
               animate={{ scale: 1 }} 
               className="absolute top-1 right-1 bg-brand-red text-white text-[10px] font-bold rounded-full w-5 h-5 flex items-center justify-center border-2 border-brand-dark"
             >
               {cartCount}
             </motion.span>
           )}
        </button>
      </div>

      <div className="sticky top-[72px] z-30 bg-brand-cream/95 backdrop-blur-md pt-4 pb-4 shadow-sm border-b border-brand-gold/10">
        <div className="flex overflow-x-auto gap-3 px-6 hide-scrollbar snap-x">
          {CATEGORY_TABS.map(tab => {
            const Icon = tab.icon;
            const isActive = activeCat === tab.id;
            return (
              <button 
                key={tab.id}
                onClick={() => setActiveCat(tab.id as any)}
                className={`flex flex-col items-center gap-2 snap-start min-w-[76px] p-2 rounded-2xl transition-all duration-300 ${
                  isActive ? 'bg-white shadow-md scale-105' : 'bg-transparent hover:bg-white/50 scale-100'
                }`}
              >
                <div className={`w-14 h-14 rounded-xl flex items-center justify-center transition-colors ${
                  isActive ? 'bg-brand-red text-white shadow-inner' : 'bg-white text-brand-dark shadow-sm border border-brand-gold/10'
                }`}>
                  <Icon size={28} className={isActive ? 'text-white' : tab.color} />
                </div>
                <span className={`text-xs font-bold tracking-tight transition-colors ${
                  isActive ? 'text-brand-red' : 'text-brand-dark/70'
                }`}>
                  {tab.label}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="p-6 space-y-6">
        <AnimatePresence mode="popLayout">
          {filteredMenu.map((item: DynamicMenuItem) => {
            // Para itens sem peso, busca pelo id simples; para itens com peso, não mostra contador único
            const cartItemsForThisMenu = cartItems.filter((i: any) => i.item.id === item.id);
            const simpleCartItem = cartItemsForThisMenu.find((i: any) => !i.weightOption);
            const totalQtyInCart = cartItemsForThisMenu.reduce((acc: number, i: any) => acc + i.quantity, 0);

            return (
              <motion.div 
                layout
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95 }}
                key={item.id} 
                className="bg-white rounded-3xl overflow-hidden shadow-sm border border-brand-gold/20 flex flex-col hover:shadow-md transition"
              >
                <div className="h-48 relative overflow-hidden bg-brand-cream">
                  <img src={item.image} alt={item.name} className="w-full h-full object-cover hover:scale-105 transition duration-500" />
                  <div className="absolute top-3 right-3 bg-white/90 backdrop-blur-sm px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider text-brand-dark">
                    {item.category}
                  </div>
                  {item.weight_mode && (
                    <div className="absolute top-3 left-3 bg-brand-dark/80 backdrop-blur-sm px-3 py-1 rounded-full text-xs font-bold text-brand-gold flex items-center gap-1">
                      <Scale size={12} /> Por peso
                    </div>
                  )}
                </div>
                <div className="p-5 flex-1 flex flex-col">
                  <div className="flex justify-between items-start mb-2">
                    <h3 className="font-display text-2xl text-brand-dark leading-tight max-w-[70%]">{item.name}</h3>
                    <span className="font-display text-xl text-brand-red whitespace-nowrap leading-tight">
                      {item.weight_mode && item.weight_options.length > 0
                        ? `a partir de R$ ${Math.min(...item.weight_options.map(o => o.price)).toFixed(2).replace('.', ',')}`
                        : `R$ ${item.price.toFixed(2).replace('.', ',')}`}
                    </span>
                  </div>
                  <p className="text-brand-dark/60 text-sm mb-6 flex-1 leading-relaxed">{item.desc}</p>
                  
                  <div className="mt-auto flex justify-end">
                    {item.weight_mode ? (
                      // Itens por peso: sempre mostra botão "Adicionar" (abre modal de faixa)
                      <div className="flex items-center gap-3">
                        {totalQtyInCart > 0 && (
                          <span className="text-xs text-brand-dark/50 font-bold">{totalQtyInCart} no carrinho</span>
                        )}
                        <button onClick={() => onAdd(item)} className="bg-brand-dark text-brand-gold px-8 py-3 rounded-full font-bold text-sm hover:bg-black transition flex items-center gap-2 shadow-md">
                          <Scale size={16} /> Escolher Peso
                        </button>
                      </div>
                    ) : simpleCartItem ? (
                      <div className="flex items-center gap-4 bg-brand-cream rounded-full p-1 border border-brand-gold/40 shadow-inner">
                        <button onClick={() => onRemove(simpleCartItem.cartKey)} className="w-10 h-10 bg-white rounded-full flex items-center justify-center text-brand-dark hover:bg-brand-red hover:text-white transition shadow-sm"><Minus size={18} /></button>
                        <span className="font-bold text-lg w-4 text-center">{simpleCartItem.quantity}</span>
                        <button onClick={() => onAdd(item)} className="w-10 h-10 bg-brand-red rounded-full flex items-center justify-center text-white hover:bg-red-700 transition shadow-sm"><Plus size={18} /></button>
                      </div>
                    ) : (
                       <button onClick={() => onAdd(item)} className="bg-brand-dark text-brand-gold px-8 py-3 rounded-full font-bold text-sm hover:bg-black transition flex items-center gap-2 shadow-md">
                         <Plus size={18} /> Adicionar
                       </button>
                    )}
                  </div>
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>

      <AnimatePresence>
        {cartCount > 0 && (
          <motion.div 
            initial={{ y: 150 }} 
            animate={{ y: 0 }} 
            exit={{ y: 150 }} 
            className="fixed bottom-[80px] left-0 right-0 p-6 z-50 pointer-events-none"
          >
            <div className="max-w-md mx-auto pointer-events-auto">
              <button 
                onClick={onCart}
                className="w-full bg-brand-red text-white p-5 rounded-2xl flex items-center justify-between font-bold shadow-2xl hover:bg-red-700 transition hover:-translate-y-1"
              >
                <div className="flex items-center gap-3">
                  <div className="bg-white/20 w-8 h-8 rounded-full flex items-center justify-center text-sm">{cartCount}</div>
                  <span className="text-lg">Ver Pedido</span>
                </div>
                <div className="text-xl font-display tracking-widest">
                  R$ {cartTotal.toFixed(2).replace('.', ',')}
                </div>
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <BottomNav activeTab="home" cartCount={cartCount} onNavigate={(tab) => {
        if (tab === 'home') onBack();
        if (tab === 'cart') onCart();
        if (tab === 'profile') onProfile();
        if (tab === 'coupons') onCoupons();
        if (tab === 'support') onSupport();
      }} />
    </motion.div>
  );
}

function CartScreen({ cart, location, cartTotal, onBack, onAdd, onRemove, onCheckout, onWeighing }: any) {
  return (
    <motion.div
      key="cart"
      variants={pageVariants}
      initial={{ opacity: 0, y: 50 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 50 }}
      className="min-h-screen bg-brand-cream pb-40 flex flex-col"
    >
      <div className="sticky top-0 z-40 bg-brand-cream/90 backdrop-blur-md px-6 py-4 flex items-center justify-between shadow-sm">
        <button onClick={onBack} className="p-2 -ml-2 rounded-full hover:bg-brand-gold/20 transition">
          <ArrowLeft size={28} className="text-brand-dark" />
        </button>
        <h2 className="font-display text-2xl absolute left-1/2 -translate-x-1/2">Seu Pedido</h2>
      </div>

      <div className="p-6 flex-1">
        {cart.length === 0 ? (
           <div className="flex flex-col items-center justify-center h-[50vh] text-brand-dark/50">
             <ShoppingBag size={64} className="mb-4 opacity-50" />
             <p className="text-lg font-bold">Nenhum item na brasa ainda!</p>
             <button onClick={onBack} className="mt-6 text-brand-red font-bold underline">Voltar pro Menu</button>
           </div>
        ) : (
          <div className="space-y-4">
            <AnimatePresence>
              {cart.map((cartItem: any) => {
                const { item, quantity, weightOption, price, cartKey } = cartItem;
                return (
                  <motion.div 
                    key={cartKey}
                    layout
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, x: -100 }}
                    className="bg-white p-4 rounded-2xl shadow-sm border border-brand-gold/20 flex items-center gap-4"
                  >
                     <img src={item.image} alt={item.name} className="w-16 h-16 rounded-xl object-cover" />
                     <div className="flex-1">
                       <h4 className="font-bold text-brand-dark leading-tight mb-1">{item.name}</h4>
                       {weightOption && (
                         <div className="text-xs text-purple-600 font-medium mb-1">
                           {weightOption.label}
                         </div>
                       )}
                       <div className="text-brand-red font-display tracking-wider">R$ {(price * quantity).toFixed(2).replace('.', ',')}</div>
                     </div>
                     <div className="flex flex-col items-center gap-1 bg-brand-cream rounded-full px-1 py-1 border border-brand-gold/30">
                        <button onClick={() => onAdd(item, weightOption ?? undefined)} className="w-8 h-8 flex items-center justify-center text-brand-red hover:bg-white rounded-full transition"><Plus size={14}/></button>
                        <span className="font-bold text-sm w-4 text-center">{quantity}</span>
                        <button onClick={() => onRemove(cartKey)} className="w-8 h-8 flex items-center justify-center text-brand-dark hover:bg-white rounded-full transition"><Minus size={14}/></button>
                     </div>
                  </motion.div>
                );
              })}
            </AnimatePresence>

            <motion.div layout className="mt-8 bg-brand-dark text-brand-cream p-6 rounded-3xl shadow-xl relative overflow-hidden">
               <div className="absolute -right-4 -top-4 opacity-10">
                 <Flame size={120} />
               </div>
               <h3 className="font-display text-2xl mb-6 text-brand-gold">Resumo do Encontro</h3>
               <div className="flex justify-between items-center mb-4 text-brand-cream/80 border-b border-brand-cream/10 pb-4">
                 <span>Mesa / Local</span>
                 <span className="font-bold text-white text-right break-words max-w-[60%]">{location}</span>
               </div>
               <div className="flex justify-between items-center text-2xl font-display pt-2">
                 <span>Total</span>
                 <span className="text-brand-red">R$ {cartTotal.toFixed(2).replace('.', ',')}</span>
               </div>
            </motion.div>
          </div>
        )}
      </div>

      {cart.length > 0 && (
         <div className="fixed bottom-0 left-0 right-0 p-6 bg-gradient-to-t from-brand-cream via-brand-cream to-transparent z-50">
           <div className="max-w-md mx-auto">
             <button 
                onClick={() => {
                  const hasWeight = cart.some((c: any) => c.item.weight_mode);
                  if (hasWeight) {
                    onWeighing();
                  } else {
                    onCheckout();
                  }
                }}
                className="w-full bg-brand-red text-white p-5 rounded-2xl flex items-center justify-center gap-3 font-bold text-xl shadow-2xl hover:bg-red-700 transition hover:-translate-y-1 font-display tracking-widest uppercase"
              >
                Confirmar Pedido
              </button>
           </div>
         </div>
      )}
    </motion.div>
  );
}

function CheckoutScreen({ location, cartTotal, onBack, onFinalize }: any) {
  const [paymentType, setPaymentType] = useState<'app' | 'local'>('app');

  return (
    <motion.div
      key="checkout"
      variants={pageVariants}
      initial={{ opacity: 0, x: 100 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 100 }}
      className="min-h-screen bg-brand-cream pb-40 flex flex-col"
    >
      <div className="sticky top-0 z-40 bg-brand-cream/90 backdrop-blur-md px-6 py-4 flex items-center justify-between shadow-sm">
        <button onClick={onBack} className="p-2 -ml-2 rounded-full hover:bg-brand-gold/20 transition">
          <ArrowLeft size={28} className="text-brand-dark" />
        </button>
        <h2 className="font-display text-2xl absolute left-1/2 -translate-x-1/2">Pagamento</h2>
      </div>

      <div className="p-6 flex-1 flex flex-col">
        <h3 className="text-xl font-bold text-brand-dark mb-4">Escolha a forma de pagamento</h3>
        <p className="text-sm text-brand-dark/70 mb-8 border-b border-brand-gold/20 pb-4">
          Você pode pagar agora pelo App com Cartão/PIX, ou pagar no momento da {location === 'Retirada no Balcão' ? 'retirada' : 'entrega'}.
        </p>

        <div className="space-y-4">
          <button 
            onClick={() => setPaymentType('app')}
            className={`w-full flex items-center gap-4 p-5 rounded-2xl border-2 transition-all duration-300 ${
              paymentType === 'app' ? 'border-brand-red bg-white shadow-lg scale-100' : 'border-brand-gold/20 bg-transparent hover:bg-white/50 scale-[0.98]'
            }`}
          >
            <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-colors ${
              paymentType === 'app' ? 'border-brand-red' : 'border-brand-gold'
            }`}>
              {paymentType === 'app' && <motion.div layoutId="pay-dot" className="w-3 h-3 bg-brand-red rounded-full"></motion.div>}
            </div>
            <div className="flex-1 text-left">
              <div className="font-bold text-brand-dark">Pagar pelo App</div>
              <div className="text-xs text-brand-dark/60 mt-1 flex gap-2">
                <span className="bg-brand-dark/5 px-2 py-0.5 rounded-sm">Cartão</span>
                <span className="bg-brand-dark/5 px-2 py-0.5 rounded-sm">PIX</span>
              </div>
            </div>
          </button>

          <button 
            onClick={() => setPaymentType('local')}
            className={`w-full flex items-center gap-4 p-5 rounded-2xl border-2 transition-all duration-300 ${
              paymentType === 'local' ? 'border-brand-red bg-white shadow-lg scale-100' : 'border-brand-gold/20 bg-transparent hover:bg-white/50 scale-[0.98]'
            }`}
          >
            <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-colors ${
              paymentType === 'local' ? 'border-brand-red' : 'border-brand-gold'
            }`}>
              {paymentType === 'local' && <motion.div layoutId="pay-dot" className="w-3 h-3 bg-brand-red rounded-full"></motion.div>}
            </div>
            <div className="flex-1 text-left">
              <div className="font-bold text-brand-dark">Pagar {location === 'Retirada no Balcão' ? 'na Retirada' : 'no Local'}</div>
              <div className="text-xs text-brand-dark/60 mt-1 flex gap-2">
                <span className="bg-brand-dark/5 px-2 py-0.5 rounded-sm">Cartão</span>
                <span className="bg-brand-dark/5 px-2 py-0.5 rounded-sm">Benefício</span>
              </div>
            </div>
          </button>
        </div>
        
        <div className="mt-auto pt-8">
           <div className="bg-brand-dark text-brand-cream p-6 rounded-3xl shadow-xl flex items-center justify-between">
              <div>
                 <div className="text-brand-gold text-xs font-bold uppercase tracking-widest mb-1">Total a Pagar</div>
                 <div className="font-display text-3xl">R$ {cartTotal.toFixed(2).replace('.', ',')}</div>
              </div>
              <Flame size={40} className="text-brand-red opacity-50" />
           </div>
        </div>
      </div>

       <div className="fixed bottom-0 left-0 right-0 p-6 bg-gradient-to-t from-brand-cream via-brand-cream to-transparent z-50">
         <div className="max-w-md mx-auto">
           <button 
              onClick={() => onFinalize(paymentType)}
              className="w-full bg-brand-red text-white p-5 rounded-2xl flex items-center justify-center gap-3 font-bold text-xl shadow-2xl hover:bg-red-700 transition hover:-translate-y-1 font-display tracking-widest uppercase"
            >
              Finalizar Pedido
            </button>
         </div>
       </div>
    </motion.div>
  );
}

function BottomNav({ activeTab, cartCount, onNavigate }: { activeTab: string, cartCount: number, onNavigate: (tab: string) => void }) {
  return (
    <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-brand-gold/20 flex justify-between items-center pt-3 pb-safe-bottom z-[60] shadow-[0_-10px_30px_rgba(0,0,0,0.05)] text-brand-dark max-w-md mx-auto px-4">
      <button className={`flex flex-col items-center gap-1 p-1 sm:p-2 relative ${activeTab === 'home' ? 'text-brand-red' : 'text-brand-dark/40 hover:text-brand-dark'}`} onClick={() => onNavigate('home')}>
        <Home size={24} className={activeTab === 'home' ? 'fill-brand-red/20' : ''} />
        <span className="text-[10px] font-bold">Início</span>
      </button>
      <button className={`flex flex-col items-center gap-1 p-1 sm:p-2 ${activeTab === 'coupons' ? 'text-brand-red' : 'text-brand-dark/40 hover:text-brand-dark'}`} onClick={() => onNavigate('coupons')}>
        <Ticket size={24} className={activeTab === 'coupons' ? 'fill-brand-red/20' : ''} />
        <span className="text-[10px] font-bold">Cupons</span>
      </button>
      <button className={`flex flex-col items-center gap-1 p-1 sm:p-2 ${activeTab === 'support' ? 'text-[#25D366]' : 'text-brand-dark/40 hover:text-brand-dark'}`} onClick={() => onNavigate('support')}>
        <MessageCircle size={24} className={activeTab === 'support' ? 'text-[#25D366] fill-[#25D366]/20' : 'text-[#25D366]'} />
        <span className="text-[10px] font-bold">Suporte</span>
      </button>
      <button className={`flex flex-col items-center gap-1 p-1 sm:p-2 relative ${activeTab === 'cart' ? 'text-brand-red' : 'text-brand-dark/40 hover:text-brand-dark'}`} onClick={() => onNavigate('cart')}>
        <ShoppingBag size={24} className={activeTab === 'cart' ? 'fill-brand-red/20' : ''} />
        <span className="text-[10px] font-bold">Pedido</span>
        {cartCount > 0 && (
           <span className="absolute top-1 right-2 w-4 h-4 bg-brand-red text-white text-[9px] font-bold flex items-center justify-center rounded-full border border-white">
             {cartCount}
           </span>
        )}
      </button>
      <button className={`flex flex-col items-center gap-1 p-1 sm:p-2 ${activeTab === 'profile' ? 'text-brand-red' : 'text-brand-dark/40 hover:text-brand-dark'}`} onClick={() => onNavigate('profile')}>
        <User size={24} className={activeTab === 'profile' ? 'fill-brand-red/20' : ''} />
        <span className="text-[10px] font-bold">Perfil</span>
      </button>
    </div>
  );
}

function ProfileScreen({ user, cartCount, initialSubView = 'main', onBack, onCart, onHome, onCoupons, onProfile, onSupport }: any) {
  const [subView, setSubView] = useState<'main' | 'orders' | 'coupons' | 'payments' | 'fidelity'>(initialSubView);
  const displayName = user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'Usuário';
  const initials = displayName.split(' ').map((n: string) => n[0]).slice(0, 2).join('').toUpperCase();
  const avatarUrl = user?.user_metadata?.avatar_url;

  if (subView !== 'main') {
    return (
      <motion.div
        key={subView}
        initial={{ opacity: 0, x: 50 }}
        animate={{ opacity: 1, x: 0 }}
        exit={{ opacity: 0, x: 50 }}
        className="min-h-screen bg-brand-cream pb-32 flex flex-col pt-6 px-6"
      >
        <div className="flex items-center mb-8 mt-4 relative">
          <button onClick={() => setSubView('main')} className="absolute left-0 p-2 -ml-2 rounded-full hover:bg-brand-gold/20 transition">
            <ArrowLeft size={28} className="text-brand-dark" />
          </button>
          <h2 className="font-display text-2xl mx-auto w-full text-center mt-1">
            {subView === 'orders' && 'Meus Pedidos'}
            {subView === 'coupons' && 'Cupons e Vantagens'}
            {subView === 'payments' && 'Meus Cartões'}
            {subView === 'fidelity' && 'Fidelidade'}
          </h2>
        </div>
        
        {subView === 'orders' && <OrdersSubView userId={user?.id} />}
        {subView === 'coupons' && <CouponsSubView userId={user?.id} />}
        {subView === 'payments' && (
           <div className="space-y-4">
             <div className="bg-white p-5 rounded-2xl shadow-sm border border-brand-gold/20 flex items-center gap-4">
                <div className="w-12 h-12 bg-brand-cream rounded-xl flex items-center justify-center">
                   <CreditCard className="text-brand-dark/50" size={24} />
                </div>
                <div className="flex-1">
                  <div className="font-bold text-brand-dark">Cartão **** 1234</div>
                  <div className="text-xs text-brand-dark/50 mt-0.5">Vencimento 12/28</div>
                </div>
                <button className="text-brand-red/50 hover:text-brand-red p-2"><Minus size={20} /></button>
             </div>
             <button className="w-full py-5 border-2 border-dashed border-brand-gold/40 rounded-2xl text-brand-dark/60 font-bold flex flex-col justify-center items-center gap-2 hover:bg-brand-gold/10 transition active:bg-brand-gold/20">
               <Plus size={24} className="text-brand-gold" />
               Adicionar Cartão
             </button>
           </div>
        )}
        {subView === 'fidelity' && <FidelitySubView userId={user?.id} />}

        <BottomNav activeTab={subView === 'coupons' ? 'coupons' : 'profile'} cartCount={cartCount} onNavigate={(tab) => {
          if (tab === 'home') onHome();
          if (tab === 'cart') onCart();
          if (tab === 'coupons') { setSubView('coupons'); if(onCoupons) onCoupons(); }
          if (tab === 'profile') { setSubView('main'); if(onProfile) onProfile(); }
          if (tab === 'support') { if(onSupport) onSupport(); }
        }} />
      </motion.div>
    );
  }

  return (
    <motion.div
      key="profile"
      variants={pageVariants}
      initial={{ opacity: 0, scale: 0.98 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.98 }}
      className="min-h-screen bg-brand-cream pb-32 flex flex-col pt-6 px-6"
    >
      <div className="flex items-center justify-between mb-8 mt-4">
        <div>
          <h2 className="font-display text-4xl text-brand-dark">Perfil</h2>
          <p className="text-brand-dark/70 text-sm font-medium">Sua conta e fidelidade</p>
        </div>
        {avatarUrl ? (
          <img src={avatarUrl} className="w-16 h-16 rounded-full object-cover shadow-md" />
        ) : (
          <div className="w-16 h-16 bg-brand-red rounded-full flex items-center justify-center text-white text-2xl font-bold shadow-md">
            {initials}
          </div>
        )}
      </div>

      <FidelityProgressButton onClick={() => setSubView('fidelity')} userId={user?.id} />

      <div className="space-y-3">
         <button onClick={() => setSubView('orders')} className="w-full bg-white p-5 rounded-2xl border border-brand-gold/20 flex items-center justify-between font-bold text-brand-dark shadow-sm hover:bg-gray-50 transition active:scale-[0.98]">
            <div className="flex items-center gap-3"><ReceiptText size={20} className="text-brand-dark/50" />Meus Pedidos</div>
            <ChevronRight size={18} className="text-brand-dark/30" />
         </button>
         <button onClick={() => setSubView('coupons')} className="w-full bg-white p-5 rounded-2xl border border-brand-gold/20 flex items-center justify-between font-bold text-brand-dark shadow-sm hover:bg-gray-50 transition active:scale-[0.98]">
            <div className="flex items-center gap-3"><Gift size={20} className="text-brand-dark/50" />Cupons e Vantagens</div>
            <ChevronRight size={18} className="text-brand-dark/30" />
         </button>
         <button onClick={() => setSubView('payments')} className="w-full bg-white p-5 rounded-2xl border border-brand-gold/20 flex items-center justify-between font-bold text-brand-dark shadow-sm hover:bg-gray-50 transition active:scale-[0.98]">
            <div className="flex items-center gap-3"><CreditCard size={20} className="text-brand-dark/50" />Formas de Pagamento</div>
            <ChevronRight size={18} className="text-brand-dark/30" />
         </button>
      </div>

      <button 
        onClick={async () => { await supabase.auth.signOut(); }} 
        className="mt-8 text-brand-red font-bold flex items-center justify-center gap-2 w-full pb-4 hover:underline"
      >
        <LogOut size={16} />
        Sair da Conta
      </button>

      <BottomNav activeTab="profile" cartCount={cartCount} onNavigate={(tab) => {
        if (tab === 'home') onHome();
        if (tab === 'cart') onCart();
        if (tab === 'coupons') { setSubView('coupons'); if(onCoupons) onCoupons(); }
        if (tab === 'profile') { setSubView('main'); if(onProfile) onProfile(); }
        if (tab === 'support') { if(onSupport) onSupport(); }
      }} />
    </motion.div>
  );
}

function SupportScreen({ cartCount, onNavigate, onBack }: any) {
  const [messages, setMessages] = useState([
    { id: 1, text: 'Olá! Como podemos ajudar o seu churras hoje?', sender: 'restaurante', time: '10:00' }
  ]);
  const [input, setInput] = useState('');

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;
    
    const newMsg = { id: Date.now(), text: input, sender: 'user', time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) };
    setMessages(prev => [...prev, newMsg]);
    setInput('');
    
    setTimeout(() => {
      setMessages(prev => [...prev, { id: Date.now() + 1, text: 'Nossa equipe já vai te responder, aguarde um minutinho!', sender: 'restaurante', time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) }]);
    }, 1500);
  };

  return (
    <motion.div
      key="support"
      variants={pageVariants}
      initial={{ opacity: 0, x: 50 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 50 }}
      className="min-h-screen bg-brand-cream pb-24 flex flex-col pt-6 px-6 relative"
    >
      <div className="flex items-center mb-6 mt-4 relative pb-4 border-b border-brand-gold/20">
        <button onClick={onBack} className="absolute left-0 p-2 -ml-2 rounded-full hover:bg-brand-gold/20 transition">
          <ArrowLeft size={28} className="text-brand-dark" />
        </button>
        <div className="mx-auto flex items-center gap-3">
          <div className="w-10 h-10 bg-[#25D366]/20 rounded-full flex items-center justify-center">
            <MessageCircle size={20} className="text-[#25D366]" fill="currentColor" />
          </div>
          <div>
            <h2 className="font-display text-xl text-brand-dark leading-none">Suporte Praça</h2>
            <span className="text-[10px] text-[#25D366] font-bold uppercase tracking-wider">Online</span>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto mb-4 hide-scrollbar flex flex-col gap-4 pb-20">
         {messages.map(msg => (
           <div key={msg.id} className={`flex flex-col max-w-[80%] ${msg.sender === 'user' ? 'self-end items-end' : 'self-start items-start'}`}>
             <div className={`p-4 rounded-2xl ${msg.sender === 'user' ? 'bg-brand-red text-white rounded-br-none' : 'bg-white border border-brand-gold/20 text-brand-dark rounded-bl-none shadow-sm'}`}>
               <p className="text-sm">{msg.text}</p>
             </div>
             <span className="text-[10px] text-brand-dark/40 mt-1">{msg.time}</span>
           </div>
         ))}
      </div>

      <div className="fixed bottom-[80px] left-0 right-0 px-6 z-40">
        <form onSubmit={handleSend} className="max-w-md mx-auto relative">
          <input 
            type="text" 
            value={input}
            onChange={e => setInput(e.target.value)}
            placeholder="Digite sua mensagem..." 
            className="w-full bg-white border border-brand-gold/30 rounded-full py-4 pl-6 pr-14 text-sm text-brand-dark placeholder:text-brand-dark/40 focus:outline-none focus:ring-2 focus:ring-[#25D366]/50 shadow-sm"
          />
          <button type="submit" disabled={!input.trim()} className="absolute right-2 top-1/2 -translate-y-1/2 bg-[#25D366] text-white w-10 h-10 rounded-full flex items-center justify-center shadow-md disabled:opacity-50 disabled:cursor-not-allowed">
            <svg viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" className="translate-x-[-1px] translate-y-[1px]"><line x1="22" y1="2" x2="11" y2="13"></line><polygon points="22 2 15 22 11 13 2 9 22 2"></polygon></svg>
          </button>
        </form>
      </div>

      <BottomNav activeTab="support" cartCount={cartCount} onNavigate={onNavigate} />
    </motion.div>
  );
}

function FidelityProgressButton({ onClick, userId }: { onClick: () => void; userId?: string }) {
  const [totalSpent, setTotalSpent] = useState(0);

  useEffect(() => {
    if (!userId) return;
    ensureFidelityRecord(userId).then(data => {
      if (data) setTotalSpent(data.total_spent);
    });
  }, [userId]);

  const progressPercent = Math.min((totalSpent / FIDELITY_GOAL) * 100, 100);

  return (
    <button onClick={onClick} className="bg-white p-6 rounded-3xl shadow-sm border border-brand-gold/20 mb-6 relative overflow-hidden text-left hover:scale-[1.02] active:scale-[0.98] transition-transform w-full">
      <div className="absolute top-0 right-0 p-4 opacity-[0.03]">
        <Flame size={120} />
      </div>
      <div className="flex items-center gap-3 mb-4 relative z-10">
        <Flame className="text-brand-red" size={28} />
        <h3 className="font-display text-2xl text-brand-dark">Fidelidade Na Brasa</h3>
      </div>
      <p className="text-sm text-brand-dark/70 mb-4 leading-relaxed relative z-10">
        Acumule <strong>R$ {FIDELITY_GOAL}</strong> em compras no App e ganhe 1 porção de Linguiça ou Farofa por nossa conta!
      </p>
      <div className="relative pt-8 pb-2 z-10">
        <div className="w-full h-3 bg-brand-cream rounded-full overflow-hidden border border-brand-gold/10 relative">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${progressPercent}%` }}
            transition={{ duration: 1.5, type: 'spring' }}
            className="h-full bg-brand-red rounded-full absolute left-0 top-0"
          />
        </div>
        <div
          className="absolute top-0 transition-all duration-1000 flex flex-col items-center"
          style={{ left: `calc(${progressPercent}% - 30px)` }}
        >
          <div className="bg-brand-dark text-brand-gold text-[10px] font-bold px-2 py-1 rounded w-max shadow-sm">
            R$ {totalSpent.toFixed(2).replace('.', ',')}
          </div>
          <div className="w-2 h-2 bg-brand-dark transform rotate-45 -mt-1 shadow-sm"></div>
        </div>
        <div className="flex justify-between text-xs mt-2 font-bold text-brand-dark/60">
          <span>R$ 0</span>
          <span>R$ {FIDELITY_GOAL}</span>
        </div>
      </div>
    </button>
  );
}

function FidelitySubView({ userId }: { userId?: string }) {
  const [totalSpent, setTotalSpent] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId) { setLoading(false); return; }
    ensureFidelityRecord(userId).then(data => {
      if (data) setTotalSpent(data.total_spent);
      setLoading(false);
    });
  }, [userId]);

  const remaining = Math.max(FIDELITY_GOAL - totalSpent, 0);

  return (
    <div className="space-y-6">
      <div className="bg-white p-8 rounded-3xl shadow-sm border border-brand-gold/20 flex flex-col items-center text-center">
        <div className="w-20 h-20 bg-brand-cream rounded-full flex items-center justify-center mb-6">
          <Flame className="text-brand-red" size={40} />
        </div>
        {loading ? (
          <p className="text-brand-dark/50">Carregando...</p>
        ) : remaining === 0 ? (
          <>
            <h3 className="font-display text-3xl text-brand-dark mb-3">Meta atingida! 🎉</h3>
            <p className="text-brand-dark/70 text-base mb-4">
              Você ganhou um cupom! Confira em <strong>Cupons e Vantagens</strong>.
            </p>
          </>
        ) : (
          <>
            <h3 className="font-display text-3xl text-brand-dark mb-3">Quase lá!</h3>
            <p className="text-brand-dark/70 text-base mb-8 max-w-[250px]">
              Você acumulou <strong>R$ {totalSpent.toFixed(2).replace('.', ',')}</strong>. Faltam apenas{' '}
              <strong>R$ {remaining.toFixed(2).replace('.', ',')}</strong> para resgatar sua porção grátis!
            </p>
          </>
        )}
        <div className="w-full bg-brand-cream/50 p-5 rounded-2xl text-left border border-brand-gold/10">
          <h4 className="font-bold text-sm mb-3 text-brand-dark uppercase tracking-wider">Como Funciona</h4>
          <ul className="text-sm text-brand-dark/70 space-y-3 list-disc list-inside">
            <li>Todas as compras no app são válidas.</li>
            <li>Ao atingir R$ {FIDELITY_GOAL}, um cupom é gerado automaticamente.</li>
            <li>Válido para 1 Porção de Linguiça Artesanal ou Farofa.</li>
          </ul>
        </div>
      </div>
    </div>
  );
}

function OrdersSubView({ userId }: { userId?: string }) {
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId) { setLoading(false); return; }
    supabase
      .from('orders')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .then(({ data, error }) => {
        if (!error && data) setOrders(data);
        setLoading(false);
      });
  }, [userId]);

  if (loading) return <p className="text-center text-brand-dark/50 mt-8">Carregando...</p>;

  if (orders.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-brand-dark/40">
        <ReceiptText size={48} className="mb-4 opacity-40" />
        <p className="font-bold text-lg">Nenhum pedido ainda</p>
        <p className="text-sm mt-1 text-center max-w-[220px]">Seus pedidos vão aparecer aqui!</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {orders.map(order => {
        const date = new Date(order.created_at).toLocaleDateString('pt-BR', {
          day: '2-digit', month: 'short', year: 'numeric'
        });
        const isRetirada = order.location === 'Retirada no Balcão';
        return (
          <div key={order.id} className="bg-white p-5 rounded-2xl shadow-sm border border-brand-gold/20">
            <div className="flex items-start justify-between mb-3">
              <div>
                <div className="font-bold text-brand-dark text-lg">
                  {isRetirada ? `Código: ${order.order_code}` : `Pedido #${order.order_code}`}
                </div>
                <div className="text-sm text-brand-dark/60 mt-0.5">{date}</div>
              </div>
              <div className="bg-yellow-100 text-yellow-700 font-bold text-[10px] px-3 py-1.5 rounded-md tracking-wider uppercase">
                {order.status === 'pending' ? 'Em andamento' :
                 order.status === 'awaiting_weighing' ? 'Aguardando pesagem' :
                 order.status === 'preparing' ? 'Preparando' :
                 order.status}
              </div>
            </div>
            <div className="text-xs text-brand-dark/50 mb-1 flex items-center gap-1">
              <MapPin size={11} /> {order.location}
            </div>
            <div className="border-t border-brand-gold/10 pt-3 mt-3 flex justify-between items-center">
              <span className="text-xs text-brand-dark/50">
                {(order.items as any[]).length} {(order.items as any[]).length === 1 ? 'item' : 'itens'} •{' '}
                {order.payment_type === 'app' ? 'Pago pelo App' : 'Pagar no Local'}
              </span>
              <span className="font-display text-brand-red text-lg">
                R$ {Number(order.total).toFixed(2).replace('.', ',')}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function CouponsSubView({ userId }: { userId?: string }) {
  const [coupons, setCoupons] = useState<{ id: string; code: string; redeemed: boolean; created_at: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState<string | null>(null);

  useEffect(() => {
    if (!userId) { setLoading(false); return; }
    fetchActiveCoupons(userId).then(data => {
      setCoupons(data);
      setLoading(false);
    });
  }, [userId]);

  const handleCopy = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopied(code);
    setTimeout(() => setCopied(null), 2000);
  };

  if (loading) return <p className="text-center text-brand-dark/50 mt-8">Carregando...</p>;

  if (coupons.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-brand-dark/40">
        <Ticket size={48} className="mb-4 opacity-40" />
        <p className="font-bold text-lg">Nenhum cupom disponível</p>
        <p className="text-sm mt-1 text-center max-w-[220px]">Continue pedindo para acumular e ganhar cupons!</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {coupons.map(coupon => (
        <div key={coupon.id} className="bg-brand-red text-white p-6 rounded-3xl shadow-sm relative overflow-hidden">
          <div className="absolute -top-4 -right-4 p-4 opacity-[0.15]">
            <Ticket size={120} />
          </div>
          <div className="relative z-10 flex flex-col items-start">
            <div className="font-display text-3xl mb-1 tracking-wider">{coupon.code}</div>
            <div className="text-sm text-white/80 mb-4">1 Porção grátis (Linguiça ou Farofa)</div>
            <button
              onClick={() => handleCopy(coupon.code)}
              className="bg-white text-brand-red text-xs font-bold px-5 py-2.5 rounded-full uppercase tracking-widest shadow-md active:scale-95 transition-transform"
            >
              {copied === coupon.code ? '✓ Copiado!' : 'Copiar Código'}
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
