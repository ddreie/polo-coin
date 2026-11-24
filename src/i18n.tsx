import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

/** App language. The website stays English; the wallet speaks Spanish to recipients in Argentina.
 *  Keys are the English texts; `{name}` placeholders are filled from `vars`. Missing keys fall back to English. */
export type Lang = 'en' | 'es';

const ES: Record<string, string> = {
  // Shell
  'Overview': 'Resumen',
  'Pay': 'Pagar',
  'Escrow': 'Escrow',
  'Activity': 'Movimientos',
  'Review': 'Revisión',
  'Reserve': 'Reserva',
  'Website': 'Sitio web',
  'Ledger': 'Registro',
  'Log out': 'Cerrar sesión',
  'Switch role': 'Cambiar rol',
  'Demo accounts': 'Cuentas demo',
  'Language': 'Idioma',
  'Loading your wallet…': 'Cargando tu billetera…',
  // Overview
  'Polo Coin balance': 'Saldo en Polo Coin',
  '= USD {x}, backed 1:1': '= USD {x}, respaldado 1:1',
  'Bank account (simulated)': 'Cuenta bancaria (simulada)',
  'USD paid out to bank account': 'USD pagados a tu cuenta bancaria',
  'Use it to buy Polo Coin': 'Para comprar Polo Coin',
  'From PC cashed out at the partner bank': 'De PC canjeados en el banco socio',
  'Wallet': 'Billetera',
  'To do': 'Pendiente',
  'Nothing to do right now.': 'Nada pendiente por ahora.',
  'Recent activity': 'Últimos movimientos',
  'See all': 'Ver todo',
  'Buy PC': 'Comprar PC',
  'Send PC': 'Enviar PC',
  'Request': 'Solicitar',
  'Cash out': 'Retirar en USD',
  // Requests
  'Payment requests': 'Solicitudes de pago',
  '{name} asks you for': '{name} te solicita',
  'You asked {name} for': 'Solicitaste a {name}',
  'Pay now': 'Pagar ahora',
  'Decline': 'Rechazar',
  'Withdraw': 'Retirar solicitud',
  'open': 'abierta', 'paid': 'pagada', 'declined': 'rechazada',
  'Ask a patron to pay you. They pay with one click, and the money arrives in seconds.':
    'Pide a un patrón que te pague. Paga con un clic y el dinero llega en segundos.',
  'Who should pay?': '¿Quién debe pagar?',
  'Send request': 'Enviar solicitud',
  'Reference': 'Referencia',
  'What is this payment for?': '¿Por qué es este pago?',
  'Request sent': 'Solicitud enviada',
  // Pay forms
  'Recipient': 'Destinatario',
  'Amount': 'Monto',
  'You pay': 'Pagas',
  'You receive': 'Recibes',
  'Fee (1%)': 'Comisión (1%)',
  '{name} receives': '{name} recibe',
  'Free': 'Gratis',
  'Same payment by bank wire': 'El mismo pago por transferencia bancaria',
  'You give': 'Entregas',
  'Paid to your bank account': 'Se paga a tu cuenta bancaria',
  'Sending…': 'Enviando…', 'Buying…': 'Comprando…', 'Cashing out…': 'Retirando…',
  'Exchange PC for US dollars at the partner bank, 1:1 and free. The PC is destroyed and the USD leaves the reserve.':
    'Cambia PC por dólares en el banco socio, 1:1 y sin costo. Los PC se destruyen y los USD salen de la reserva.',
  'Sending PC is free and final within seconds, any day of the week.':
    'Enviar PC es gratis y queda firme en segundos, cualquier día de la semana.',
  // Escrow
  'Horse purchases in escrow': 'Compras de caballos en escrow',
  'The purchase price is locked in a smart contract. The vet confirms the pre-purchase examination, then the contract pays the seller by itself.':
    'El precio queda bloqueado en un contrato inteligente. El veterinario confirma el examen previo a la compra y el contrato paga al vendedor automáticamente.',
  'Locked': 'Bloqueado', 'Paid to seller': 'Pagado al vendedor', 'Refunded': 'Reembolsado',
  'Waiting for the vet check': 'Esperando el examen veterinario',
  'Buyer': 'Comprador', 'Seller': 'Vendedor', 'Veterinarian': 'Veterinario',
  'Vet check passed': 'Examen aprobado', 'Vet check failed': 'Examen no aprobado',
  'Report: passed': 'Informar: aprobado', 'Report: failed': 'Informar: no aprobado',
  'Cancel and refund': 'Cancelar y reembolsar',
  'No escrows yet.': 'Todavía no hay escrows.',
  'Start an escrow': 'Iniciar un escrow',
  'Horse': 'Caballo',
  'Lock {x} PC in escrow': 'Bloquear {x} PC en escrow',
  // KYC / misc
  'KYC verified': 'KYC verificado', 'KYC pending': 'KYC pendiente', 'KYC rejected': 'KYC rechazado',
  'Payment received': 'Pago recibido',
};

interface Ctx { lang: Lang; setLang: (l: Lang) => void; t: (en: string, vars?: Record<string, string | number>) => string }
const LangCtx = createContext<Ctx | null>(null);

function fill(s: string, vars?: Record<string, string | number>) {
  return vars ? s.replace(/\{(\w+)\}/g, (_, k) => String(vars[k] ?? '')) : s;
}

/** `user` keeps the choice per demo account, so the patron can stay in English while the player reads Spanish. */
export function LangProvider({ children, preferred, user }: { children: ReactNode; preferred: Lang; user: string }) {
  const KEY = `polo-coin-lang:${user}`;
  const [lang, setLangState] = useState<Lang>(() => {
    try { return (localStorage.getItem(KEY) as Lang) || preferred; } catch { return preferred; }
  });
  // A new account from Argentina starts in Spanish unless the user picked a language.
  useEffect(() => {
    try { setLangState((localStorage.getItem(KEY) as Lang) || preferred); } catch { setLangState(preferred); }
  }, [preferred, KEY]);
  const setLang = useCallback((l: Lang) => {
    setLangState(l);
    try { localStorage.setItem(KEY, l); } catch { /* ignore */ }
  }, [KEY]);
  const t = useCallback((en: string, vars?: Record<string, string | number>) => fill(lang === 'es' ? ES[en] ?? en : en, vars), [lang]);
  const value = useMemo(() => ({ lang, setLang, t }), [lang, setLang, t]);
  return <LangCtx.Provider value={value}>{children}</LangCtx.Provider>;
}

/** Outside the wallet (website) there is no provider: English. */
export function useT() {
  return useContext(LangCtx) ?? { lang: 'en' as Lang, setLang: () => undefined, t: fill };
}
