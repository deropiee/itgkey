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
  const homepageSlug = homepage
    ? normalizePageSlug(getPageSlug(homepage.slug))
    : undefined;
  const pageMap = new Map(
    pages.map(page => [normalizePageSlug(getPageSlug(page.slug)), page.title])
  );
  const postMap = new Map(posts.map(post => [`posts/${post.slug}`, post.title]));
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
      ?.filter(item => item.visible !== false)
      .map(item => {
        const slug = normalizePageSlug(String(item.slug ?? ''));
        return {
          href: !slug || slug === homepageSlug ? '/' : `/${slug}`,
          label: item.title || pageMap.get(slug) || postMap.get(slug) || slug,
        };
      }) ?? [];

  return (
    <html lang="en">
      <body>
        <FrontendNav items={navItems} />
        {children}
        <CmsWidget
          homepageSlug={homepageSlug}
          pageEditMap={pageEditMap}
          postEditMap={postEditMap}
        />
      </body>
    </html>
  );
}
