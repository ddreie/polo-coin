const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** Where the same Argentine professionals play during the year (months are 1-based, inclusive). */
const SEASONS: { where: string; what: string; from: number; to: number; tone: 'ar' | 'us' | 'eu' | 'snow'; pilot?: string }[] = [
  { where: 'United States', what: 'Florida winter season, Wellington', from: 1, to: 4, tone: 'us', pilot: 'Pilot 2 · winter 2029' },
  { where: 'Switzerland', what: 'Snow polo, St. Moritz', from: 1, to: 2, tone: 'snow' },
  { where: 'Europe', what: 'England, Sotogrande, Gstaad', from: 5, to: 9, tone: 'eu', pilot: 'Pilot 1 · summer 2028' },
  { where: 'Argentina', what: 'Home season, Triple Crown in Palermo', from: 9, to: 12, tone: 'ar' },
];

/** One year of polo: the same players move from the US to Europe and home to Argentina. */
export default function SeasonCalendar() {
  return (
    <figure className="seasons">
      <div className="seasons-grid" role="table" aria-label="Polo seasons by month">
        <div className="seasons-head" role="row">
          <span role="columnheader" />
          {MONTHS.map((m) => <span key={m} role="columnheader">{m}</span>)}
        </div>
        {SEASONS.map((s) => (
          <div key={s.where + s.from} className="seasons-row" role="row">
            <span className="seasons-label" role="rowheader"><strong>{s.where}</strong><small>{s.what}</small></span>
            <span className={`seasons-bar seasons-${s.tone}`} style={{ gridColumn: `${s.from + 1} / ${s.to + 2}` }} role="cell">
              {s.pilot && <em>{s.pilot}</em>}
            </span>
          </div>
        ))}
      </div>
      <figcaption>
        Many Argentine professionals play the US season in winter and the European season in summer before going home
        for the Argentine season. A pilot in both foreign seasons reaches the same players, grooms and breeders twice,
        with patrons on two continents.
      </figcaption>
    </figure>
  );
}
