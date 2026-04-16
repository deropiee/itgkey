import '../../styles.css';
import React from 'react';
import Markdoc from '@markdoc/markdoc';
import { reader } from '../../reader';
import { markdocConfig } from '../../../keystatic.config';
import { LivePreviewPage } from '../../LivePreviewPage';

export default async function PostPage(props: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { slug } = await props.params;
  const searchParams = await props.searchParams;
  const post = await reader.collections.posts.read(slug);

  if (!post) {
    if (searchParams.__itg_preview === '1') {
      return <LivePreviewPage initialBlocks={[]} initialTitle={slug} />;
    }
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
    <LivePreviewPage
      initialBlocks={(post.blocks as any) ?? []}
      initialTitle={post.title}
    >
      <div>{Markdoc.renderers.react(renderable, React)}</div>
    </LivePreviewPage>
  );
}

export async function generateStaticParams() {
  const slugs = await reader.collections.posts.list();
  return slugs.map(slug => ({ slug }));
}
