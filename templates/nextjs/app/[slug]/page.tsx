import '../styles.css';
import { reader } from '../reader';
import {
  getPageSlug,
  normalizePageSlug,
} from '../../page-builder';
import { renderPageBlocks } from '../renderBlocks';

export default async function Post(props: {
  params: Promise<{ slug: string }>;
}) {
  const params = await props.params;
  const { slug } = params;
  const normalizedSlug = normalizePageSlug(slug);

  const pages = (await reader.singletons.pages.read())?.items ?? [];
  const homepage = pages.find(page => page.isHomepage) ?? pages[0];
  const homepageSlug = homepage
    ? normalizePageSlug(getPageSlug(homepage.slug))
    : undefined;
  if (homepageSlug && normalizedSlug === homepageSlug) {
    return <div>Page not found!</div>;
  }
  const page = pages.find(
    page => normalizePageSlug(getPageSlug(page.slug)) === normalizedSlug
  );

  if (page) {
    return (
      <main style={{ maxWidth: 1240, margin: '0 auto', padding: '56px 32px' }}>
        <h1 style={{ marginBottom: 24 }}>{page.title}</h1>
        {renderPageBlocks(page.blocks as any)}
      </main>
    );
  }

  return <div>Page not found!</div>;
}

export async function generateStaticParams() {
  const pages = (await reader.singletons.pages.read())?.items ?? [];
  const homepage = pages.find(page => page.isHomepage) ?? pages[0];
  const homepageSlug = homepage
    ? normalizePageSlug(getPageSlug(homepage.slug))
    : undefined;
  const pageSlugs = pages.map(page => ({
    slug: normalizePageSlug(getPageSlug(page.slug)),
  }));
  return pageSlugs.filter(page => page.slug !== homepageSlug);
}
