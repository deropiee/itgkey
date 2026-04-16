import '../styles.css';
import { reader } from '../reader';
import {
  getPageSlug,
  normalizePageSlug,
} from '../../page-builder';
import { LivePreviewPage } from '../LivePreviewPage';

export default async function Post(props: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await props.params;
  const searchParams = await props.searchParams;
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
      <LivePreviewPage
        initialBlocks={(page.blocks as any) ?? []}
        initialTitle={page.title}
      />
    );
  }

  if (searchParams.__itg_preview === '1') {
    return <LivePreviewPage initialBlocks={[]} initialTitle={slug} />;
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
