import { Link } from 'react-router-dom';
import type { SitePage as Page } from '../site';
import { ButtonLink, PageHero, Section } from '../ui';

/** Content page shell. Each page gets its own component in P3 of the redesign; until then this shows its intro. */
export default function SitePage({ page }: { page: Page }) {
  return (
    <>
      <PageHero eyebrow={page.label} title={page.title} lede={page.lede}>
        <ButtonLink to="/login" variant="accent">Try the demo</ButtonLink>
        <ButtonLink to="/how-it-works" variant="on-dark">How it works</ButtonLink>
      </PageHero>
      <Section>
        <p className="muted">This page is being built as part of the redesign. Meanwhile, <Link to="/">see the overview</Link>.</p>
      </Section>
    </>
  );
}

export function NotFound() {
  return (
    <>
      <PageHero eyebrow="404" title="Out of bounds" lede="This page does not exist. The ball went wide of the posts." >
        <ButtonLink to="/" variant="accent">Back to the start</ButtonLink>
      </PageHero>
    </>
  );
}
