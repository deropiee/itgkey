import '../../styles.css';
import React from 'react';
import Markdoc from '@markdoc/markdoc';
import { reader } from '../../reader';
import { markdocConfig } from '../../../keystatic.config';
import { renderPageBlocks } from '../../renderBlocks';

export default async function PostPage(props: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await props.params;
  const post = await reader.collections.posts.read(slug);

  if (!post) {
    return <div>Post not found!</div>;
  }

  const { node } = await post.content();
  const errors = Markdoc.validate(node, markdocConfig);
  if (errors.length) {
    console.error(errors);
    throw new Error('Invalid content');
  }
  const renderable = Markdoc.transform(node, markdocConfig);

  return (
    <main style={{ maxWidth: 1240, margin: '0 auto', padding: '56px 32px' }}>
      <h1>{post.title}</h1>
      {renderPageBlocks(post.blocks as any)}
      <div>{Markdoc.renderers.react(renderable, React)}</div>
    </main>
  );
}

export async function generateStaticParams() {
  const slugs = await reader.collections.posts.list();
  return slugs.map(slug => ({ slug }));
}
