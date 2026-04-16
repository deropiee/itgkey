import { reader } from './reader';
import './styles.css';
import { LivePreviewPage } from './LivePreviewPage';

export default async function Homepage() {
  const pages = (await reader.singletons.pages.read())?.items ?? [];
  const homepage = pages.find(page => page.isHomepage) ?? pages[0];

  if (!homepage) {
    return <div>No homepage configured.</div>;
  }

  return (
    <LivePreviewPage
      initialBlocks={(homepage.blocks as any) ?? []}
      initialTitle={homepage.title}
    />
  );
}
