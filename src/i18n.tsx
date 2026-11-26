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
  'No vet report within 14 days, refunded to the buyer': 'Sin informe veterinario en 14 días, reembolsado al comprador',
  'Cancelled by the buyer': 'Cancelado por el comprador',
  'Vet report due by {d} ({n} days left). Without a report, the contract refunds the buyer automatically.':
    'Informe veterinario hasta el {d} (quedan {n} días). Sin informe, el contrato reembolsa al comprador automáticamente.',
  'If the seller does not accept or the vet does not report within 14 days, the PC come back to you automatically.':
    'Si el vendedor no acepta o el veterinario no informa en 14 días, los PC vuelven a ti automáticamente.',
  'Report: passed': 'Informar: aprobado', 'Report: failed': 'Informar: no aprobado',
  'Cancel and refund': 'Cancelar y reembolsar',
  'No escrows yet.': 'Todavía no hay escrows.',
  'Start an escrow': 'Iniciar un escrow',
  'Horse': 'Caballo',
  'Lock {x} PC in escrow': 'Bloquear {x} PC en escrow',
  // KYC / misc
  'KYC verified': 'KYC verificado', 'KYC pending': 'KYC pendiente', 'KYC rejected': 'KYC rechazado',
  'Payment received': 'Pago recibido',
  // Contracts
  'Contracts': 'Contratos', 'Horse escrow': 'Escrow de caballos', 'Win bonus': 'Bono por victoria',
  'The patron locks a bonus for a match. When the tournament organiser records the result, the contract pays the player or refunds the patron by itself.':
    'El patrón bloquea un bono para un partido. Cuando el organizador registra el resultado, el contrato paga al jugador o reembolsa al patrón automáticamente.',
  'Lock': 'Bloquear', 'Examine': 'Examinar', 'Settle': 'Liquidar', 'Play': 'Jugar',
  'Buyer’s PC move into the contract wallet': 'Los PC del comprador pasan a la billetera del contrato',
  'The named vet checks the horse': 'El veterinario designado revisa el caballo',
  'Buyer locks the price and proposes a verified vet': 'El comprador bloquea el precio y propone un veterinario verificado',
  'Seller accepts the terms and the vet, or declines': 'El vendedor acepta las condiciones y el veterinario, o rechaza',
  'The vet checks the horse and reports': 'El veterinario examina el caballo e informa',
  'Accept': 'Aceptar',
  'Passed: paid to seller. Failed, declined or no response within 14 days: back to buyer':
    'Aprobado: se paga al vendedor. No aprobado, rechazado o sin respuesta en 14 días: vuelve al comprador',
  'Waiting for seller': 'Esperando al vendedor',
  'Licence': 'Matrícula', 'verified by Polo Coin': 'verificada por Polo Coin',
  'Accepted by the seller, waiting for the vet check': 'Aceptado por el vendedor, esperando el examen veterinario',
  'Waiting for the seller to accept the escrow and the vet': 'Esperando que el vendedor acepte el escrow y el veterinario',
  'Waiting for the seller to accept': 'Esperando que el vendedor acepte',
  'The seller has until {d} to accept ({n} days left). Until then the buyer can still cancel.':
    'El vendedor tiene hasta el {d} para aceptar (quedan {n} días). Hasta entonces el comprador aún puede cancelar.',
  'Accept escrow and vet': 'Aceptar escrow y veterinario',
  'Cancellation requested': 'Cancelación solicitada',
  'Win bonus #{n} cancelled': 'Premio #{n} cancelado',
  'Both sides agreed. PC {x} went back to {name}.': 'Ambas partes estuvieron de acuerdo. PC {x} volvieron a {name}.',
  '{name} has to confirm. Until then the bonus stays locked and the result still counts.':
    '{name} tiene que confirmar. Hasta entonces el premio sigue bloqueado y el resultado sigue contando.',
  'Request withdrawn': 'Solicitud retirada', 'Bonus kept': 'Premio mantenido',
  'The bonus stays locked until the organiser records the result.': 'El premio sigue bloqueado hasta que el organizador registre el resultado.',
  '{name} asked to cancel the bonus': '{name} pidió cancelar el premio',
  'Cancelled by patron and player': 'Cancelado por patrón y jugador',
  'This bonus is a binding promise. It can only be cancelled if {a} and {b} both agree.':
    'Este premio es una promesa vinculante. Solo se puede cancelar si {a} y {b} están de acuerdo.',
  'You asked to cancel. {name} has to confirm, until then the result still counts.':
    'Pediste cancelar. {name} tiene que confirmar, hasta entonces el resultado sigue contando.',
  '{name} asked to cancel this bonus. If you agree, PC {x} go back to {p}.':
    '{name} pidió cancelar este premio. Si estás de acuerdo, PC {x} vuelven a {p}.',
  'Ask to cancel': 'Pedir cancelación', 'Withdraw request': 'Retirar solicitud',
  'Agree to cancel': 'Aceptar cancelación', 'Keep the bonus': 'Mantener el premio',
  'Payment under a short review': 'Pago en una breve revisión',
  'Your payment of PC {x} to {name} is held for a routine compliance check by our partner bank. It is released as soon as the check is done, usually within a few hours.':
    'Tu pago de PC {x} a {name} está retenido para un control de cumplimiento de rutina de nuestro banco socio. Se libera en cuanto termina el control, normalmente en pocas horas.',
  'Review held payment': 'Revisar pago retenido',
  'Payment to {name} under review': 'Pago a {name} en revisión',
  'Routine compliance check, usually a few hours': 'Control de rutina, normalmente pocas horas',
  'Your wallet is frozen': 'Tu billetera está congelada',
  'The Polo Coin Treasury has frozen this wallet pending a compliance review. Your balance is safe, but you cannot send, receive or cash out PC until the freeze is lifted. Our team will contact you.':
    'La tesorería de Polo Coin congeló esta billetera por una revisión de cumplimiento. Tu saldo está seguro, pero no puedes enviar, recibir ni retirar PC hasta que se levante. Nuestro equipo te contactará.',
  'Vet profile': 'Perfil del veterinario', 'Verified by Polo Coin': 'Verificado por Polo Coin', 'since {d}': 'desde el {d}',
  'New on Polo Coin: no examinations reported yet.': 'Nuevo en Polo Coin: todavía no informó ningún examen.',
  'Examinations': 'Exámenes', '{p} passed, {f} failed': '{p} aprobados, {f} no aprobados',
  'Missed deadlines': 'Plazos incumplidos', 'No report within 14 days': 'Sin informe en 14 días',
  'Value examined': 'Valor examinado', 'Purchase prices of reported horses': 'Precios de los caballos informados',
  'Counted by the escrow contract from the ledger. Nobody can edit this record.':
    'Lo cuenta el contrato de escrow a partir del registro. Nadie puede modificar este historial.',
  'New vet, no examinations yet': 'Veterinario nuevo, todavía sin exámenes',
  '{n} examinations, {m} missed deadlines': '{n} exámenes, {m} plazos incumplidos', 'Accept escrow': 'Aceptar escrow',
  'Declined by the seller, refunded to the buyer': 'Rechazado por el vendedor, reembolsado al comprador',
  'Not accepted by the seller within 14 days, refunded to the buyer': 'No aceptado por el vendedor en 14 días, reembolsado al comprador',
  'Only vets whose licence Polo Coin has checked are listed. Choose one you and the seller trust: the seller has to accept your choice.':
    'Solo aparecen veterinarios cuya matrícula verificó Polo Coin. Elige uno en quien confíen tú y el vendedor: el vendedor debe aceptar tu elección.',
  'The patron’s bonus moves into the contract': 'El bono del patrón pasa al contrato',
  'The organiser records the result': 'El organizador registra el resultado',
  'Won: paid to the player. Lost: back to the patron': 'Ganado: se paga al jugador. Perdido: vuelve al patrón',
  'Patron': 'Patrón', 'Player': 'Jugador', 'Organiser': 'Organizador', 'Match': 'Partido',
  'Paid to player': 'Pagado al jugador', 'Waiting for the result': 'Esperando el resultado',
  'Match won': 'Partido ganado', 'Match lost': 'Partido perdido',
  'Record: won': 'Registrar: ganado', 'Record: lost': 'Registrar: perdido', 'Record the result': 'Registrar el resultado', 'Record': 'Registrar',
  'No win bonuses yet.': 'Todavía no hay bonos.', 'Promise a win bonus': 'Prometer un bono por victoria',
  'Lock {x} PC as win bonus': 'Bloquear {x} PC como bono',
  // Receive, standing orders
  'Receive': 'Recibir', 'Standing orders': 'Pagos recurrentes',
  'Show this code at the tournament. The payer scans it with the phone and the payment opens with everything filled in.':
    'Muestra este código en el torneo. Quien paga lo escanea con el teléfono y el pago se abre con todo completado.',
  'Link': 'Enlace', 'Copy link': 'Copiar enlace', 'Link copied': 'Enlace copiado', 'Any amount': 'Monto libre',
  'Payment link from {name}. Check the amount and send.': 'Enlace de pago de {name}. Revisa el monto y envía.',
  'Your standing orders': 'Tus pagos recurrentes', 'Standing orders paying you': 'Pagos recurrentes a tu favor',
  'New standing order': 'Nuevo pago recurrente', 'How often': 'Frecuencia', 'Weekly': 'Semanal', 'Monthly': 'Mensual',
  'weekly': 'semanal', 'monthly': 'mensual', 'next': 'próximo', 'cancelled': 'cancelado',
  'Set up and pay first instalment': 'Crear y pagar la primera cuota', 'Standing order set up': 'Pago recurrente creado',
  'Pay next now': 'Pagar la próxima ahora', 'Stop': 'Detener',
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
