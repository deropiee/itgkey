'use client';

import { useEffect } from 'react';

const CMS_FLAG = 'itg-cms-enabled';

export function CmsSessionBeacon() {
  useEffect(() => {
    window.localStorage.setItem(CMS_FLAG, '1');
  }, []);

  return null;
}
