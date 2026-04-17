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
  viewport?: PreviewViewport;
};

type PreviewViewportPreset = 'desktop' | 'tablet' | 'mobile' | 'ultrawide' | 'free';

type PreviewViewport = {
  height?: number;
  label: string;
  preset: PreviewViewportPreset;
  width?: number;
};

const DEFAULT_PREVIEW_WIDTH = 520;
const MIN_PREVIEW_WIDTH = 360;
const MAX_PREVIEW_WIDTH_RATIO = 0.8;
const RESIZE_HANDLE_WIDTH = 12;
const PREVIEW_STAGE_PADDING = 24;

const PREVIEW_VIEWPORTS: PreviewViewport[] = [
  { preset: 'desktop', label: 'Desktop 16:9', width: 1440, height: 810 },
  { preset: 'mobile', label: 'Phone 9:16', width: 390, height: 844 },
  { preset: 'tablet', label: 'Tablet 4:3', width: 1024, height: 768 },
  { preset: 'ultrawide', label: 'Desktop 21:9', width: 1680, height: 720 },
  { preset: 'free', label: 'Free aspect' },
];

function DesktopPreviewIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" aria-hidden="true">
      <rect x="3" y="5" width="18" height="12" rx="2" stroke="currentColor" strokeWidth="1.75" />
      <path d="M9 19h6" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
      <path d="M12 17v2" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
    </svg>
  );
}

function PhonePreviewIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" aria-hidden="true">
      <rect x="7" y="2.75" width="10" height="18.5" rx="2.5" stroke="currentColor" strokeWidth="1.75" />
      <path d="M10.5 5.75h3" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
      <circle cx="12" cy="18.2" r="0.9" fill="currentColor" />
    </svg>
  );
}

function TabletPreviewIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" aria-hidden="true">
      <rect x="4.5" y="3.5" width="15" height="17" rx="2.5" stroke="currentColor" strokeWidth="1.75" />
      <circle cx="12" cy="17.5" r="0.9" fill="currentColor" />
    </svg>
  );
}

function UltrawidePreviewIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" aria-hidden="true">
      <rect x="2" y="7" width="20" height="10" rx="2" stroke="currentColor" strokeWidth="1.75" />
      <path d="M8.5 19h7" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
    </svg>
  );
}

function FreePreviewIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" aria-hidden="true">
      <path d="M8 4H4v4" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M16 4h4v4" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M20 16v4h-4" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M8 20H4v-4" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function getViewportIcon(preset: PreviewViewportPreset) {
  switch (preset) {
    case 'desktop':
      return <DesktopPreviewIcon />;
    case 'mobile':
      return <PhonePreviewIcon />;
    case 'tablet':
      return <TabletPreviewIcon />;
    case 'ultrawide':
      return <UltrawidePreviewIcon />;
    case 'free':
      return <FreePreviewIcon />;
  }
}

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
  const stageRef = useRef<HTMLDivElement | null>(null);
  const [viewport, setViewport] = useState<PreviewViewport>(PREVIEW_VIEWPORTS[0]);
  const [stageSize, setStageSize] = useState({ width: 0, height: 0 });
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
      viewport,
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
  }, [previewHref, previewPathname, sanitizedData, title, viewport]);

  useEffect(() => {
    if (previewHref) {
      const timer = window.setTimeout(() => {
        publishPreview();
      }, 300);
      return () => window.clearTimeout(timer);
    }
  }, [previewHref, publishPreview]);

  useEffect(() => {
    const stage = stageRef.current;
    if (!stage || typeof ResizeObserver === 'undefined') {
      return;
    }

    const updateSize = () => {
      setStageSize({
        width: stage.clientWidth,
        height: stage.clientHeight,
      });
    };

    updateSize();

    const observer = new ResizeObserver(updateSize);
    observer.observe(stage);
    return () => observer.disconnect();
  }, []);

  const scaledViewport = useMemo(() => {
    if (viewport.preset === 'free' || !viewport.width || !viewport.height) {
      return null;
    }

    const availableWidth = Math.max(0, stageSize.width - PREVIEW_STAGE_PADDING * 2);
    const availableHeight = Math.max(0, stageSize.height - PREVIEW_STAGE_PADDING * 2);

    if (!availableWidth || !availableHeight) {
      return {
        height: viewport.height,
        scale: 1,
        width: viewport.width,
      };
    }

    const scale = Math.min(
      availableWidth / viewport.width,
      availableHeight / viewport.height
    );

    return {
      width: Math.max(1, Math.floor(viewport.width * scale)),
      height: Math.max(1, Math.floor(viewport.height * scale)),
      scale,
    };
  }, [stageSize.height, stageSize.width, viewport]);

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
          justifyContent="space-between"
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
          <Flex gap="xsmall" wrap justifyContent="end">
            {PREVIEW_VIEWPORTS.map(option => (
              <TooltipTrigger key={option.preset}>
                <ActionButton
                  prominence={viewport.preset === option.preset ? 'high' : 'low'}
                  onPress={() => setViewport(option)}
                  aria-label={option.label}
                >
                  {getViewportIcon(option.preset)}
                </ActionButton>
                <Tooltip>{option.label}</Tooltip>
              </TooltipTrigger>
            ))}
          </Flex>
        </Flex>
        <Box
          ref={stageRef}
          UNSAFE_className={css({
            flex: 1,
            minHeight: 0,
            overflow: 'auto',
            padding: tokenSchema.size.space.large,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background:
              'linear-gradient(180deg, #f8fafc 0%, #eef2ff 45%, #f8fafc 100%)',
          })}
        >
          {viewport.preset === 'free' ? (
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
                boxShadow: '0 24px 60px rgba(15, 23, 42, 0.14)',
              })}
            />
          ) : (
            <Box
              UNSAFE_className={css({
                flexShrink: 0,
                overflow: 'visible',
              })}
              style={{
                width: `${scaledViewport?.width ?? viewport.width}px`,
                height: `${scaledViewport?.height ?? viewport.height}px`,
              }}
            >
              <iframe
                ref={iframeRef}
                title={title || 'Preview'}
                src={iframeHref}
                width={viewport.width}
                height={viewport.height}
                onLoad={publishPreview}
                className={css({
                  border: `1px solid ${tokenSchema.color.border.neutral}`,
                  borderRadius: tokenSchema.size.radius.large,
                  backgroundColor: tokenSchema.color.background.canvas,
                  boxShadow: '0 24px 60px rgba(15, 23, 42, 0.14)',
                  transformOrigin: 'top left',
                })}
                style={{
                  width: `${viewport.width}px`,
                  height: `${viewport.height}px`,
                  transform: `scale(${scaledViewport?.scale ?? 1})`,
                }}
              />
            </Box>
          )}
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
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [currentWidth, setCurrentWidth] = useState(
    typeof previewWidth === 'number' ? previewWidth : DEFAULT_PREVIEW_WIDTH
  );

  useEffect(() => {
    if (typeof previewWidth === 'number') {
      setCurrentWidth(previewWidth);
    }
  }, [previewWidth]);

  const startResize = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsDragging(true);
    const startX = event.clientX;
    const startWidth = currentWidth;

    const handlePointerMove = (moveEvent: PointerEvent) => {
      const maxWidth = Math.max(
        MIN_PREVIEW_WIDTH,
        Math.floor(window.innerWidth * MAX_PREVIEW_WIDTH_RATIO)
      );
      const nextWidth = Math.min(
        maxWidth,
        Math.max(MIN_PREVIEW_WIDTH, startWidth - (moveEvent.clientX - startX))
      );
      setCurrentWidth(nextWidth);
    };

    const handlePointerUp = () => {
      setIsDragging(false);
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
    };

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
  }, [currentWidth]);

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
            role="separator"
            aria-orientation="vertical"
            aria-label="Resize preview panel"
            onPointerDown={startResize}
            UNSAFE_className={css({
              width: `${RESIZE_HANDLE_WIDTH}px`,
              minWidth: `${RESIZE_HANDLE_WIDTH}px`,
              cursor: 'col-resize',
              backgroundColor: tokenSchema.color.background.canvas,
              position: 'relative',
              flexShrink: 0,
              alignSelf: 'stretch',
              touchAction: 'none',
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
            })}
            style={{
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
