'use client';

import type { ReactNode } from 'react';
import { useEffect, useState } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import { pageShellStyles, renderPageBlocks } from './renderBlocks';

const PREVIEW_QUERY_PARAM = '__itg_preview';
const PREVIEW_STORAGE_PREFIX = 'itg-preview:';

type PreviewMessage = {
  data: Record<string, unknown>;
  pathname: string;
  source: 'itg-preview';
  timestamp: number;
  title?: string;
};

function getPreviewStorageKey(pathname: string) {
  return `${PREVIEW_STORAGE_PREFIX}${pathname || '/'}`;
}

function readStoredPreview(pathname: string) {
  try {
    const raw = window.localStorage.getItem(getPreviewStorageKey(pathname));
    if (!raw) {
      return null;
    }
    return JSON.parse(raw) as PreviewMessage;
  } catch {
    return null;
  }
}

function isPreviewMessage(
  value: unknown,
  pathname: string
): value is PreviewMessage {
  return (
    !!value &&
    typeof value === 'object' &&
    'source' in value &&
    'pathname' in value &&
    'data' in value &&
    (value as PreviewMessage).source === 'itg-preview' &&
    (value as PreviewMessage).pathname === pathname
  );
}

export function LivePreviewPage(props: {
  children?: ReactNode;
  initialBlocks: any[];
  initialTitle: string;
}) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [previewData, setPreviewData] = useState<Record<string, unknown> | null>(
    null
  );
  const isPreview = searchParams.get(PREVIEW_QUERY_PARAM) === '1';

  useEffect(() => {
    if (!isPreview) {
      setPreviewData(null);
      return;
    }

    const applyMessage = (message: unknown) => {
      if (!isPreviewMessage(message, pathname)) {
        return;
      }
      setPreviewData(message.data);
    };

    applyMessage(readStoredPreview(pathname));

    const storageKey = getPreviewStorageKey(pathname);
    const onMessage = (event: MessageEvent) => applyMessage(event.data);
    window.addEventListener('message', onMessage);

    if ('BroadcastChannel' in window) {
      const channel = new BroadcastChannel(storageKey);
      channel.onmessage = event => applyMessage(event.data);
      return () => {
        window.removeEventListener('message', onMessage);
        channel.close();
      };
    }

    return () => {
      window.removeEventListener('message', onMessage);
    };
  }, [isPreview, pathname]);

  const title =
    typeof previewData?.title === 'string' && previewData.title.trim()
      ? previewData.title
      : props.initialTitle;
  const blocks = Array.isArray(previewData?.blocks)
    ? (previewData.blocks as any[])
    : props.initialBlocks;

  return (
    <main style={pageShellStyles}>
      <h1 style={{ marginBottom: 24 }}>{title}</h1>
      {renderPageBlocks(blocks)}
      {props.children ? <div>{props.children}</div> : null}
    </main>
  );
}
