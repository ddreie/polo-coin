import { useEffect, useRef, useState } from 'react';

/** The 3D gold coin of the home page. Three.js is loaded only here, after the page is visible.
 *  Without WebGL the flat logo is shown instead. With "reduce motion" the coin is rendered once and stands still. */
export default function Coin() {
  const host = useRef<HTMLDivElement>(null);
  const [failed, setFailed] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let scene: { dispose(): void } | undefined;
    let cancelled = false;
    const still = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    import('./coin3d')
      .then(({ mountCoin }) => mountCoin(host.current!, { still }))
      .then((s) => { if (cancelled) s.dispose(); else { scene = s; setReady(true); } })
      .catch(() => { if (!cancelled) setFailed(true); });
    return () => { cancelled = true; scene?.dispose(); };
  }, []);

  return (
    <div className={`coin${ready ? ' is-ready' : ''}`} ref={host} role="img" aria-label="The Polo Coin, a gold coin with two crossed polo mallets and an orange ball">
      {failed && <img className="coin-fallback" src="/brand/mark-on-dark.svg" alt="" />}
    </div>
  );
}
