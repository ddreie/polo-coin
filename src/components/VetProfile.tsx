import type { VetStats } from '../api';
import { dateShort, money0 } from '../format';
import { useT } from '../i18n';

/** A vet's public profile: licence and track record, so buyers and sellers can judge whom to trust. */
export function VetProfile({ name, org, licence, authority, stats }: {
  name: string; org?: string | null; licence?: string | null; authority?: string | null; stats: VetStats;
}) {
  const { t, lang } = useT();
  const isNew = stats.reports === 0;
  return (
    <section className="vet-profile" aria-label={t('Vet profile')}>
      <header>
        <strong>{name}</strong>
        {org && org !== '—' && <span>{org}</span>}
        <span className="vet-verified">
          {t('Verified by Polo Coin')}{stats.verified_at ? ` ${t('since {d}', { d: dateShort(stats.verified_at, lang) })}` : ''}
          {licence && <> · {t('Licence')} {licence}{authority ? `, ${authority}` : ''}</>}
        </span>
      </header>
      {isNew ? (
        <p className="muted">{t('New on Polo Coin: no examinations reported yet.')}</p>
      ) : (
        <dl className="vet-stats">
          <div><dt>{t('Examinations')}</dt><dd>{stats.reports}</dd><small>{t('{p} passed, {f} failed', { p: String(stats.passed), f: String(stats.failed) })}</small></div>
          <div><dt>{t('Missed deadlines')}</dt><dd>{stats.missed}</dd><small>{t('No report within 14 days')}</small></div>
          <div><dt>{t('Value examined')}</dt><dd>PC {money0(stats.volume)}</dd><small>{t('Purchase prices of reported horses')}</small></div>
        </dl>
      )}
      <p className="vet-note">{t('Counted by the escrow contract from the ledger. Nobody can edit this record.')}</p>
    </section>
  );
}

/** One-line version for escrow cards. */
export function vetSummary(stats: VetStats, t: (k: string, v?: Record<string, string>) => string) {
  if (stats.reports === 0) return t('New vet, no examinations yet');
  return t('{n} examinations, {m} missed deadlines', { n: String(stats.reports), m: String(stats.missed) });
}
