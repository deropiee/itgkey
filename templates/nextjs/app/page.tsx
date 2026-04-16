import { reader } from './reader';
import './styles.css';
import { renderPageBlocks } from './renderBlocks';

export default async function Homepage() {
  const pages = (await reader.singletons.pages.read())?.items ?? [];
  const homepage = pages.find(page => page.isHomepage) ?? pages[0];

  if (!homepage) {
    return <div>No homepage configured.</div>;
  }

  return (
    <main style={{ maxWidth: 1240, margin: '0 auto', padding: '56px 32px' }}>
      <h1 style={{ marginBottom: 24 }}>{homepage.title}</h1>
      {renderPageBlocks(homepage.blocks as any)}
    </main>
  );
}
