import type { ReactNode } from 'react';
import { reader } from './reader';
import { getPageSlug, normalizePageSlug } from '../page-builder';
import { FrontendNav } from './FrontendNav';
import { CmsWidget } from './CmsWidget';

export default async function RootLayout({ children }: { children: ReactNode }) {
  const pages = (await reader.singletons.pages.read())?.items ?? [];
  const posts = await reader.collections.posts.all();
  const settings = await reader.singletons.settings.read().catch(() => null);
  const homepage = pages.find(page => page.isHomepage) ?? pages[0];
  const pageMap = new Map(
    pages.map(page => [normalizePageSlug(getPageSlug(page.slug)), page.title])
  );
  const pageEditMap = Object.fromEntries(
    pages.map(page => {
      const slug = normalizePageSlug(getPageSlug(page.slug));
      return [slug, `/keystatic/page/${encodeURIComponent(slug)}`];
    })
  );
  const postEditMap = Object.fromEntries(
    posts.map(post => [
      post.slug,
      `/keystatic/collection/posts/item/${encodeURIComponent(post.slug)}`,
    ])
  );
  const navItems =
    settings?.navigation
      ?.filter(
        item =>
          item.visible &&
          pageMap.has(normalizePageSlug(getPageSlug(item.slug as any)))
      )
      .map(item => {
        const slug = normalizePageSlug(getPageSlug(item.slug as any));
        return {
          href: slug ? `/${slug}` : '/',
          label: item.title || pageMap.get(slug) || slug,
        };
      }) ?? [];

  return (
    <html lang="en">
      <body>
        <FrontendNav items={navItems} />
        {children}
        <CmsWidget
          homepageSlug={
            homepage ? normalizePageSlug(getPageSlug(homepage.slug)) : undefined
          }
          pageEditMap={pageEditMap}
          postEditMap={postEditMap}
        />
      </body>
    </html>
  );
}
