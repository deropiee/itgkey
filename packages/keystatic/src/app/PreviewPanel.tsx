import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { ActionButton, ToggleButton } from '@keystar/ui/button';
import { Icon } from '@keystar/ui/icon';
import { eyeIcon } from '@keystar/ui/icon/icons/eyeIcon';
import { eyeOffIcon } from '@keystar/ui/icon/icons/eyeOffIcon';
import { chevronLeftIcon } from '@keystar/ui/icon/icons/chevronLeftIcon';
import { chevronRightIcon } from '@keystar/ui/icon/icons/chevronRightIcon';
import { Box, Flex, VStack, Divider } from '@keystar/ui/layout';
import { Text, Heading } from '@keystar/ui/typography';
import { css, tokenSchema } from '@keystar/ui/style';
import { Tooltip, TooltipTrigger } from '@keystar/ui/tooltip';

type PreviewPanelProps = {
  data: Record<string, unknown>;
  schema: Record<string, unknown>;
  href?: string;
  title?: string;
};

const PREVIEW_QUERY_PARAM = '__itg_preview';
const PREVIEW_STORAGE_PREFIX = 'itg-preview:';

type PreviewMessage = {
  data: Record<string, unknown>;
  pathname: string;
  source: 'itg-preview';
  timestamp: number;
  title?: string;
};

const DEFAULT_PREVIEW_WIDTH = 520;
const MIN_PREVIEW_WIDTH = 360;
const MAX_PREVIEW_WIDTH_RATIO = 0.8;
const RESIZE_HANDLE_WIDTH = 12;

function useDebouncedValue<T>(value: T, delay = 300) {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedValue(value), delay);
    return () => window.clearTimeout(timer);
  }, [delay, value]);

  return debouncedValue;
}

function getPreviewPathname(href: string) {
  return getPreviewUrl(href).pathname || '/';
}

function getPreviewIframeHref(href: string) {
  const url = getPreviewUrl(href);
  url.searchParams.set(PREVIEW_QUERY_PARAM, '1');
  return `${url.pathname}${url.search}${url.hash}`;
}

function getPreviewStorageKey(pathname: string) {
  return `${PREVIEW_STORAGE_PREFIX}${pathname || '/'}`;
}

function getPreviewUrl(href: string) {
  return new URL(
    href,
    typeof window === 'undefined' ? 'http://localhost' : window.location.origin
  );
}

function sanitizePreviewValue(
  value: unknown,
  seen = new WeakSet<object>(),
  depth = 0
): unknown {
  if (
    value === null ||
    value === undefined ||
    typeof value === 'string' ||
    typeof value === 'number' ||
    typeof value === 'boolean'
  ) {
    return value;
  }

  if (typeof value === 'bigint') {
    return value.toString();
  }

  if (typeof value === 'function' || typeof value === 'symbol') {
    return undefined;
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  if (value instanceof Uint8Array) {
    return Array.from(value);
  }

  if (Array.isArray(value)) {
    if (depth > 8) return '[truncated]';
    return value
      .map(item => sanitizePreviewValue(item, seen, depth + 1))
      .filter(item => item !== undefined);
  }

  if (typeof value === 'object') {
    if (seen.has(value)) return '[circular]';
    seen.add(value);

    if ('$$typeof' in value || '_owner' in value) {
      return '[component]';
    }

    if (depth > 8) return '[truncated]';

    const output: Record<string, unknown> = {};
    for (const [key, entry] of Object.entries(value as Record<string, unknown>)) {
      const sanitized = sanitizePreviewValue(entry, seen, depth + 1);
      if (sanitized !== undefined) {
        output[key] = sanitized;
      }
    }
    return output;
  }

  return String(value);
}

// Render a preview of the entry data - with depth limit to prevent stack overflow
function renderValue(value: unknown, depth = 0, maxDepth = 3): React.ReactNode {
  // Prevent infinite recursion
  if (depth > maxDepth) {
    return <Text color="neutralSecondary">[nested]</Text>;
  }

  if (value === null || value === undefined) {
    return <Text color="neutralSecondary">—</Text>;
  }

  if (typeof value === 'boolean') {
    return (
      <Text color={value ? 'positive' : 'neutral'}>{value ? 'Yes' : 'No'}</Text>
    );
  }

  if (typeof value === 'number') {
    return <Text color="accent">{value}</Text>;
  }

  if (typeof value === 'string') {
    if (value.length > 100) {
      return <Text>{value.substring(0, 100)}...</Text>;
    }
    return <Text>{value}</Text>;
  }

  // Skip complex objects that might cause recursion (like functions, symbols, etc)
  if (typeof value === 'function' || typeof value === 'symbol') {
    return <Text color="neutralSecondary">[{typeof value}]</Text>;
  }

  if (Array.isArray(value)) {
    if (value.length === 0) {
      return <Text color="neutralSecondary">Empty list</Text>;
    }
    return (
      <VStack gap="xsmall" paddingStart="regular">
        {value.slice(0, 3).map((item, i) => (
          <Flex key={i} gap="small" alignItems="start">
            <Text color="neutralSecondary">{i + 1}.</Text>
            {renderValue(item, depth + 1, maxDepth)}
          </Flex>
        ))}
        {value.length > 3 && (
          <Text color="neutralSecondary">...and {value.length - 3} more</Text>
        )}
      </VStack>
    );
  }

  if (typeof value === 'object') {
    // Skip objects that look like React elements or have circular refs
    if ('$$typeof' in (value as object) || '_owner' in (value as object)) {
      return <Text color="neutralSecondary">[component]</Text>;
    }

    try {
      const entries = Object.entries(value as Record<string, unknown>);
      if (entries.length === 0) {
        return <Text color="neutralSecondary">Empty object</Text>;
      }
      // Only show simple fields, skip complex nested objects at shallow render
      const simpleEntries = entries
        .filter(([, val]) => typeof val !== 'object' || val === null)
        .slice(0, 5);

      if (simpleEntries.length === 0) {
        return <Text color="neutralSecondary">[{entries.length} fields]</Text>;
      }

      return (
        <VStack gap="xsmall" paddingStart={depth > 0 ? 'regular' : undefined}>
          {simpleEntries.map(([key, val]) => (
            <Flex key={key} gap="small" alignItems="start" wrap>
              <Text weight="medium" color="neutralSecondary">
                {key}:
              </Text>
              {renderValue(val, depth + 1, maxDepth)}
            </Flex>
          ))}
          {entries.length > simpleEntries.length && (
            <Text color="neutralSecondary">
              ...and {entries.length - simpleEntries.length} more fields
            </Text>
          )}
        </VStack>
      );
    } catch {
      return <Text color="neutralSecondary">[object]</Text>;
    }
  }

  return <Text>{String(value)}</Text>;
}

export function PreviewPanel({ data, href, title }: PreviewPanelProps) {
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const debouncedHref = useDebouncedValue(href, 300);
  const previewHref = debouncedHref ?? href;
  const sanitizedData = useMemo(
    () => sanitizePreviewValue(data) as Record<string, unknown>,
    [data]
  );
  const previewPathname = useMemo(
    () => (previewHref ? getPreviewPathname(previewHref) : undefined),
    [previewHref]
  );
  const iframeHref = useMemo(
    () => (previewHref ? getPreviewIframeHref(previewHref) : undefined),
    [previewHref]
  );
  const publishPreview = useCallback(() => {
    if (!previewHref || !previewPathname) {
      return;
    }

    const payload: PreviewMessage = {
      data: sanitizedData,
      pathname: previewPathname,
      source: 'itg-preview',
      timestamp: Date.now(),
      title,
    };
    const storageKey = getPreviewStorageKey(previewPathname);

    try {
      window.localStorage.setItem(storageKey, JSON.stringify(payload));
    } catch {}

    if ('BroadcastChannel' in window) {
      const channel = new BroadcastChannel(storageKey);
      channel.postMessage(payload);
      channel.close();
    }

    iframeRef.current?.contentWindow?.postMessage(payload, window.location.origin);
  }, [previewHref, previewPathname, sanitizedData, title]);

  useEffect(() => {
    if (previewHref) {
      const timer = window.setTimeout(() => {
        publishPreview();
      }, 300);
      return () => window.clearTimeout(timer);
    }
  }, [previewHref, publishPreview]);

  if (previewHref) {
    return (
      <Box
        UNSAFE_className={css({
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          minHeight: 0,
        })}
      >
        <Flex
          alignItems="center"
          gap="regular"
          padding="regular"
          UNSAFE_className={css({
            borderBottom: `1px solid ${tokenSchema.color.border.neutral}`,
            backgroundColor: tokenSchema.color.background.surface,
          })}
        >
          <VStack gap="xsmall" minWidth={0}>
            <Heading size="small">{title || 'Preview'}</Heading>
            <Text color="neutralSecondary" size="small" truncate>
              {previewHref}
            </Text>
          </VStack>
        </Flex>
        <Box
          UNSAFE_className={css({
            flex: 1,
            minHeight: 0,
            overflow: 'hidden',
            padding: tokenSchema.size.space.large,
            backgroundColor: tokenSchema.color.background.canvas,
          })}
        >
          <iframe
            ref={iframeRef}
            title={title || 'Preview'}
            src={iframeHref}
            onLoad={publishPreview}
            className={css({
              border: `1px solid ${tokenSchema.color.border.neutral}`,
              borderRadius: tokenSchema.size.radius.large,
              width: '100%',
              height: '100%',
              minHeight: 0,
              backgroundColor: tokenSchema.color.background.canvas,
            })}
          />
        </Box>
      </Box>
    );
  }

  return (
    <Box
      padding="large"
      UNSAFE_className={css({
        height: '100%',
        overflowY: 'auto',
      })}
    >
      <VStack gap="large">
        <Heading size="small">{title || 'Preview'}</Heading>
        <Divider />
        <VStack gap="medium">
          {Object.entries(data).map(([key, value]) => (
            <Box
              key={key}
              UNSAFE_className={css({
                padding: tokenSchema.size.space.regular,
                backgroundColor: tokenSchema.color.background.surface,
                borderRadius: tokenSchema.size.radius.regular,
                border: `1px solid ${tokenSchema.color.border.neutral}`,
              })}
            >
              <VStack gap="small">
                <Text
                  weight="semibold"
                  size="small"
                  color="accent"
                  UNSAFE_className={css({
                    textTransform: 'capitalize',
                  })}
                >
                  {key.replace(/([A-Z])/g, ' $1').replace(/_/g, ' ')}
                </Text>
                {renderValue(value)}
              </VStack>
            </Box>
          ))}
        </VStack>
      </VStack>
    </Box>
  );
}

type PreviewToggleProps = {
  isPreviewOpen: boolean;
  onToggle: () => void;
};

export function PreviewToggle({ isPreviewOpen, onToggle }: PreviewToggleProps) {
  return (
    <TooltipTrigger>
      <ToggleButton
        isSelected={isPreviewOpen}
        onChange={onToggle}
        aria-label={isPreviewOpen ? 'Hide preview' : 'Show preview'}
      >
        <Icon src={isPreviewOpen ? eyeOffIcon : eyeIcon} />
      </ToggleButton>
      <Tooltip>{isPreviewOpen ? 'Hide preview' : 'Show preview'}</Tooltip>
    </TooltipTrigger>
  );
}

type SplitEditorProps = {
  children: React.ReactNode;
  preview: React.ReactNode;
  isPreviewOpen: boolean;
  previewWidth?: number | string;
};

export function SplitEditor({
  children,
  preview,
  isPreviewOpen,
  previewWidth = DEFAULT_PREVIEW_WIDTH,
}: SplitEditorProps) {
  const resizeHandleRef = useRef<HTMLDivElement | null>(null);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [currentWidth, setCurrentWidth] = useState(
    typeof previewWidth === 'number' ? previewWidth : DEFAULT_PREVIEW_WIDTH
  );
  const dragStateRef = useRef<{
    pointerId: number;
    startWidth: number;
    startX: number;
  } | null>(null);

  useEffect(() => {
    if (typeof previewWidth === 'number') {
      setCurrentWidth(previewWidth);
    }
  }, [previewWidth]);

  const stopResize = useCallback(() => {
    dragStateRef.current = null;
    setIsDragging(false);
    document.body.style.cursor = '';
    document.body.style.userSelect = '';
  }, []);

  const onPointerDownResize = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    event.preventDefault();
    dragStateRef.current = {
      pointerId: event.pointerId,
      startWidth: currentWidth,
      startX: event.clientX,
    };
    resizeHandleRef.current?.setPointerCapture(event.pointerId);
    setIsDragging(true);
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
  }, [currentWidth]);

  const onPointerMoveResize = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    const dragState = dragStateRef.current;
    if (!dragState || dragState.pointerId !== event.pointerId) {
      return;
    }

    const maxWidth = Math.max(
      MIN_PREVIEW_WIDTH,
      Math.floor(window.innerWidth * MAX_PREVIEW_WIDTH_RATIO)
    );
    const nextWidth = Math.min(
      maxWidth,
      Math.max(
        MIN_PREVIEW_WIDTH,
        dragState.startWidth - (event.clientX - dragState.startX)
      )
    );

    setCurrentWidth(nextWidth);
  }, []);

  const onPointerUpResize = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    if (dragStateRef.current?.pointerId !== event.pointerId) {
      return;
    }
    resizeHandleRef.current?.releasePointerCapture(event.pointerId);
    stopResize();
  }, [stopResize]);

  useEffect(() => {
    return () => {
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
  }, []);

  if (!isPreviewOpen) {
    return <>{children}</>;
  }

  return (
    <Flex height="100%" minHeight={0}>
      <Box flex minWidth={0}>
        {children}
      </Box>
      {!isCollapsed && (
        <>
          <Box
            ref={resizeHandleRef}
            role="separator"
            aria-orientation="vertical"
            aria-label="Resize preview panel"
            onPointerDown={onPointerDownResize}
            onPointerMove={onPointerMoveResize}
            onPointerUp={onPointerUpResize}
            onPointerCancel={onPointerUpResize}
            UNSAFE_className={css({
              width: `${RESIZE_HANDLE_WIDTH}px`,
              minWidth: `${RESIZE_HANDLE_WIDTH}px`,
              cursor: 'col-resize',
              backgroundColor: tokenSchema.color.background.canvas,
              position: 'relative',
              flexShrink: 0,
              alignSelf: 'stretch',
              userSelect: 'none',
              zIndex: 2,
              ':before': {
                content: '""',
                position: 'absolute',
                top: 0,
                bottom: 0,
                left: '50%',
                width: '2px',
                transform: 'translateX(-50%)',
                backgroundColor: isDragging
                  ? tokenSchema.color.foreground.accent
                  : tokenSchema.color.border.neutral,
              },
              ':after': {
                content: '""',
                position: 'absolute',
                top: 0,
                bottom: 0,
                left: '-6px',
                right: '-6px',
              },
            })}
          />
          <Box
            UNSAFE_className={css({
              minWidth: `${MIN_PREVIEW_WIDTH}px`,
              maxWidth: '80vw',
              backgroundColor: tokenSchema.color.background.canvas,
              borderLeft: `1px solid ${tokenSchema.color.border.neutral}`,
              position: 'relative',
              flex: '0 0 auto',
            })}
            UNSAFE_style={{
              flexBasis: `${currentWidth}px`,
              width: `${currentWidth}px`,
            }}
          >
            <Flex
              padding="small"
              gap="xsmall"
              UNSAFE_className={css({
                position: 'absolute',
                top: 0,
                right: 0,
                zIndex: 1,
              })}
            >
              <TooltipTrigger>
                <ActionButton
                  prominence="low"
                  onPress={() => setIsCollapsed(true)}
                >
                  <Icon src={chevronRightIcon} />
                </ActionButton>
                <Tooltip>Collapse preview</Tooltip>
              </TooltipTrigger>
            </Flex>
            {preview}
          </Box>
        </>
      )}
      {isCollapsed && (
        <Box
          UNSAFE_className={css({
            width: '32px',
            backgroundColor: tokenSchema.color.background.canvas,
            borderLeft: `1px solid ${tokenSchema.color.border.neutral}`,
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'center',
            paddingTop: tokenSchema.size.space.regular,
          })}
        >
          <TooltipTrigger>
            <ActionButton
              prominence="low"
              onPress={() => setIsCollapsed(false)}
            >
              <Icon src={chevronLeftIcon} />
            </ActionButton>
            <Tooltip>Expand preview</Tooltip>
          </TooltipTrigger>
        </Box>
      )}
    </Flex>
  );
}
