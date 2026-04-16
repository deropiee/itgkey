'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';

const CMS_FLAG = 'itg-cms-enabled';

type CmsWidgetProps = {
  homepageSlug?: string;
  pageEditMap: Record<string, string>;
  postEditMap: Record<string, string>;
};

export function CmsWidget(props: CmsWidgetProps) {
  const pathname = usePathname();
  const [enabled, setEnabled] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    setEnabled(window.localStorage.getItem(CMS_FLAG) === '1');
  }, []);

  const editHref = useMemo(() => {
    const normalizedPath = pathname.replace(/^\/+|\/+$/g, '');
    if (!normalizedPath) {
      return props.homepageSlug ? props.pageEditMap[props.homepageSlug] : undefined;
    }
    if (normalizedPath.startsWith('posts/')) {
      return props.postEditMap[normalizedPath.slice('posts/'.length)];
    }
    return props.pageEditMap[normalizedPath];
  }, [pathname, props.homepageSlug, props.pageEditMap, props.postEditMap]);

  if (!enabled || pathname.startsWith('/keystatic')) {
    return null;
  }

  return (
    <div className="itg-widget">
      {open ? (
        <div className="itg-widget__panel">
          {editHref ? (
            <Link href={editHref} className="itg-widget__link">
              Edit this page
            </Link>
          ) : null}
          <Link
            href="/keystatic"
            className="itg-widget__link itg-widget__link--secondary"
          >
            Open CMS
          </Link>
        </div>
      ) : null}
      <button
        type="button"
        className="itg-widget__button"
        onClick={() => setOpen(value => !value)}
      >
        itg
      </button>
    </div>
  );
}
