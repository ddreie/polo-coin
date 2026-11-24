import { ButtonLink, PageHero } from '../ui';

export function NotFound() {
  return (
    <PageHero eyebrow="404" title="Out of bounds" lede="This page does not exist. The ball went wide of the posts.">
      <ButtonLink to="/" variant="accent">Back to the start</ButtonLink>
    </PageHero>
  );
}
