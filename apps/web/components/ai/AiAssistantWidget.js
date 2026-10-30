'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Sparkles,
  X,
  Send,
  Bot,
  ArrowUpRight,
  Maximize2,
  Minimize2,
  RotateCcw,
  Copy,
  Check,
  ShoppingBag,
  Star,
  Cpu,
  Scale,
  Tag,
  PackageSearch,
  Square,
} from 'lucide-react';
import { aiApi, cartApi } from '../../lib/api';
import { useI18n } from '../../lib/i18n';
import { FALLBACK_PRODUCT_IMAGE, formatPrice, handleImageError } from '../../lib/utils';

const STORAGE_KEY = 'aevo_ai_chat_history_v2';

// Balance unclosed ** or ` tokens during live word-by-word streaming so raw syntax never flickers
function normalizeStreamingInlineText(raw = '') {
  let text = String(raw || '');
  const boldCount = (text.match(/\*\*/g) || []).length;
  if (boldCount % 2 === 1) {
    text += '**';
  }
  const codeCount = (text.match(/`/g) || []).length;
  if (codeCount % 2 === 1) {
    text += '`';
  }
  return text;
}

function renderInlineFormatting(rawText, keyPrefix = 'inline') {
  if (!rawText) return null;
  const text = normalizeStreamingInlineText(rawText);
  const pattern = /(\[[^\]]+\]\([^)]+\)|`[^`]+`|\*\*[^*]+\*\*|\*[^*]+\*)/g;
  const parts = String(text).split(pattern);

  return parts.map((part, idx) => {
    const key = `${keyPrefix}-${idx}`;
    if (!part) return null;

    if (part.startsWith('[') && part.includes('](') && part.endsWith(')')) {
      const match = part.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
      if (match) {
        return (
          <Link
            key={key}
            href={match[2]}
            className="font-medium underline underline-offset-2 hover:opacity-80 transition-opacity"
          >
            {match[1]}
          </Link>
        );
      }
    }

    if (part.startsWith('`') && part.endsWith('`') && part.length > 2) {
      return (
        <code
          key={key}
          className="px-1.5 py-0.5 mx-0.5 rounded-md bg-surface border border-border font-mono text-[11px] text-ink"
        >
          {part.slice(1, -1)}
        </code>
      );
    }

    if (part.startsWith('**') && part.endsWith('**') && part.length > 4) {
      return (
        <strong key={key} className="font-semibold text-ink">
          {part.slice(2, -2)}
        </strong>
      );
    }

    if (part.startsWith('*') && part.endsWith('*') && part.length > 2) {
      return (
        <em key={key} className="italic text-secondary">
          {part.slice(1, -1)}
        </em>
      );
    }

    return <span key={key}>{part}</span>;
  });
}

function StreamingCursor() {
  return (
    <span
      aria-hidden="true"
      className="inline-block w-[6px] h-[13px] ml-1 align-middle bg-ink animate-pulse rounded-[1px]"
    />
  );
}

function renderRichMarkdown(markdownText = '', isStreaming = false) {
  const lines = String(markdownText || '').split('\n');
  const blocks = [];
  let i = 0;

  while (i < lines.length) {
    const rawLine = lines[i];
    const trimmed = rawLine.trim();

    if (!trimmed) {
      i += 1;
      continue;
    }

    // 1. Markdown Table block (starts with | and next line is | --- |)
    if (
      trimmed.startsWith('|') &&
      i + 1 < lines.length &&
      lines[i + 1].trim().startsWith('|') &&
      lines[i + 1].includes('---')
    ) {
      const cleanHeader = trimmed.endsWith('|') ? trimmed.slice(1, -1) : trimmed.slice(1);
      const headerCells = cleanHeader.split('|').map((c) => c.trim());
      i += 2; // Skip header and separator row
      const bodyRows = [];
      while (i < lines.length && lines[i].trim().startsWith('|')) {
        const rowTrim = lines[i].trim();
        const cleanRow = rowTrim.endsWith('|') ? rowTrim.slice(1, -1) : rowTrim.slice(1);
        const rowCells = cleanRow.split('|').map((c) => c.trim());
        bodyRows.push(rowCells);
        i += 1;
      }

      blocks.push(
        <div
          key={`tbl-${i}`}
          className="my-2 overflow-x-auto rounded-xl border border-border bg-surface"
        >
          <table className="w-full text-left border-collapse text-[11px]">
            <thead>
              <tr className="border-b border-border bg-canvas">
                {headerCells.map((hCell, cIdx) => (
                  <th
                    key={`th-${cIdx}`}
                    className="px-2.5 py-2 font-semibold text-ink whitespace-nowrap"
                  >
                    {renderInlineFormatting(hCell, `th-${i}-${cIdx}`)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {bodyRows.map((row, rIdx) => (
                <tr key={`tr-${rIdx}`} className="hover:bg-canvas/50 transition-colors">
                  {row.map((cell, cIdx) => (
                    <td key={`td-${rIdx}-${cIdx}`} className="px-2.5 py-1.5 text-ink align-top">
                      {renderInlineFormatting(cell, `td-${i}-${rIdx}-${cIdx}`)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
      continue;
    }

    // Skip partial table header line while waiting for the separator line during streaming
    if (isStreaming && trimmed.startsWith('|') && i === lines.length - 1) {
      i += 1;
      continue;
    }

    // 2. Headings (### or ####)
    if (trimmed.startsWith('### ')) {
      const isLast = isStreaming && i === lines.length - 1;
      blocks.push(
        <h4
          key={`h3-${i}`}
          className="text-[13px] font-semibold text-ink tracking-tight pt-1 pb-0.5"
        >
          {renderInlineFormatting(trimmed.slice(4), `h3-${i}`)}
          {isLast && <StreamingCursor />}
        </h4>
      );
      i += 1;
      continue;
    }

    if (trimmed.startsWith('#### ')) {
      const isLast = isStreaming && i === lines.length - 1;
      blocks.push(
        <h5
          key={`h4-${i}`}
          className="text-[11.5px] font-semibold uppercase tracking-wider text-secondary pt-1"
        >
          {renderInlineFormatting(trimmed.slice(5), `h4-${i}`)}
          {isLast && <StreamingCursor />}
        </h5>
      );
      i += 1;
      continue;
    }

    // 3. Blockquote / Callout (> ...)
    if (trimmed.startsWith('> ')) {
      const isLast = isStreaming && i === lines.length - 1;
      blocks.push(
        <div
          key={`quote-${i}`}
          className="my-1.5 p-2.5 rounded-xl bg-surface border border-border text-[11.5px] text-ink leading-relaxed"
        >
          {renderInlineFormatting(trimmed.slice(2), `quote-${i}`)}
          {isLast && <StreamingCursor />}
        </div>
      );
      i += 1;
      continue;
    }

    // 4. Unordered or Ordered List items
    if (/^(\d+\.|-|•)\s+/.test(trimmed)) {
      const listItems = [];
      while (i < lines.length) {
        const curRaw = lines[i];
        const curTrim = curRaw.trim();
        if (!curTrim) break;
        if (/^(\d+\.|-|•)\s+/.test(curTrim)) {
          const isSubItem = /^\s{2,}(-|•)\s+/.test(curRaw);
          const cleanItem = curTrim.replace(/^(\d+\.|-|•)\s+/, '');
          listItems.push({ text: cleanItem, isSubItem, lineIdx: i });
          i += 1;
        } else {
          break;
        }
      }

      blocks.push(
        <ul key={`list-${i}`} className="space-y-1.5 my-1">
          {listItems.map((item, idx) => {
            const isLastItem =
              isStreaming && idx === listItems.length - 1 && item.lineIdx === lines.length - 1;
            return (
              <li
                key={`li-${item.lineIdx}`}
                className={`flex items-start gap-2 text-[12.5px] leading-relaxed ${
                  item.isSubItem ? 'pl-4 text-[11.5px] text-secondary' : 'text-ink'
                }`}
              >
                <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-ink/50 shrink-0" />
                <div className="flex-1 min-w-0">
                  {renderInlineFormatting(item.text, `li-${item.lineIdx}`)}
                  {isLastItem && <StreamingCursor />}
                </div>
              </li>
            );
          })}
        </ul>
      );
      continue;
    }

    // 5. Standard paragraph
    const isLast = isStreaming && i === lines.length - 1;
    blocks.push(
      <p key={`p-${i}`} className="text-[12.5px] text-ink leading-relaxed">
        {renderInlineFormatting(trimmed, `p-${i}`)}
        {isLast && <StreamingCursor />}
      </p>
    );
    i += 1;
  }

  return <div className="space-y-2">{blocks}</div>;
}

export default function AiAssistantWidget() {
  const pathname = usePathname() || '/';
  const { locale, t } = useI18n();
  const [open, setOpen] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [thinkingStep, setThinkingStep] = useState(0);
  const [messages, setMessages] = useState([]);
  const [streamingState, setStreamingState] = useState(null); // { id, fullText, visibleText }
  const [suggestedPrompts, setSuggestedPrompts] = useState([]);
  const [copiedId, setCopiedId] = useState(null);
  const [addedMap, setAddedMap] = useState({});
  const feedRef = useRef(null);
  const streamTimerRef = useRef(null);

  // Restore session conversation on mount
  useEffect(() => {
    try {
      const saved = sessionStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setMessages(parsed);
        }
      }
    } catch {
      // Ignore storage read errors
    }
  }, []);

  // Cleanup any running stream timer on unmount
  useEffect(() => {
    return () => {
      if (streamTimerRef.current) {
        clearInterval(streamTimerRef.current);
      }
    };
  }, []);

  // Multi-stage thinking step rotator while loading
  useEffect(() => {
    if (!loading) {
      setThinkingStep(0);
      return;
    }
    const interval = setInterval(() => {
      setThinkingStep((prev) => (prev + 1) % 3);
    }, 180);
    return () => clearInterval(interval);
  }, [loading]);

  // Word-by-word streaming engine
  useEffect(() => {
    if (!streamingState) return;

    const { id, fullText } = streamingState;
    // Tokenize into words while preserving exact whitespace & newlines
    const tokens = String(fullText || '').match(/\S+\s*/g) || [fullText];
    let currentIdx = 0;
    // Stream 2-3 words per frame at 22ms (~90-120 words/sec, ~1.1-1.5s total duration)
    const wordsPerTick = tokens.length > 110 ? 3 : 2;

    if (streamTimerRef.current) {
      clearInterval(streamTimerRef.current);
    }

    streamTimerRef.current = setInterval(() => {
      currentIdx = Math.min(tokens.length, currentIdx + wordsPerTick);
      const nextSlice = tokens.slice(0, currentIdx).join('');

      setStreamingState((prev) => (prev && prev.id === id ? { ...prev, visibleText: nextSlice } : prev));

      if (feedRef.current) {
        feedRef.current.scrollTop = feedRef.current.scrollHeight;
      }

      if (currentIdx >= tokens.length) {
        clearInterval(streamTimerRef.current);
        streamTimerRef.current = null;
        setStreamingState(null);
      }
    }, 22);

    return () => {
      if (streamTimerRef.current) {
        clearInterval(streamTimerRef.current);
        streamTimerRef.current = null;
      }
    };
  }, [streamingState?.id]);

  // Persist session conversation & auto-scroll feed
  useEffect(() => {
    try {
      if (messages.length > 0) {
        sessionStorage.setItem(STORAGE_KEY, JSON.stringify(messages.slice(-16)));
      }
    } catch {
      // Ignore storage write errors
    }
    if (feedRef.current) {
      feedRef.current.scrollTop = feedRef.current.scrollHeight;
    }
  }, [messages, loading, open]);

  // Hide on admin & auth pages so Admin remains strictly within specification
  if (
    pathname.startsWith('/admin') ||
    pathname.startsWith('/login') ||
    pathname.startsWith('/register') ||
    pathname.startsWith('/forgot-password') ||
    pathname.startsWith('/reset-password')
  ) {
    return null;
  }

  const productSlugMatch = pathname.match(/^\/products\/([^/?#]+)/);
  const currentProductSlug = productSlugMatch ? decodeURIComponent(productSlugMatch[1]) : null;

  const thinkingLabels =
    locale === 'vi'
      ? [
          'Đang phân tích ngữ cảnh & nhu cầu...',
          'Đang truy vấn kho hàng Elasticsearch BM25...',
          'Đang tổng hợp cấu hình tối ưu...',
        ]
      : [
          'Analyzing workflow & intent...',
          'Querying Elasticsearch BM25 catalog...',
          'Synthesizing optimal configurations...',
        ];

  const defaultPrompts =
    locale === 'vi'
      ? [
          'Laptop lập trình dưới 35 triệu',
          'So sánh MacBook Pro M5 và MacBook Air M5',
          'Màn hình 4K đồ họa tốt nhất',
          'Xem mã giảm giá đang hoạt động',
        ]
      : [
          'Best laptop for coding under 35M VND',
          'Compare MacBook Pro M5 vs MacBook Air M5',
          '4K OLED monitor for creators',
          'Show active discount codes',
        ];

  const activePrompts = suggestedPrompts.length > 0 ? suggestedPrompts : defaultPrompts;

  const quickCapabilities =
    locale === 'vi'
      ? [
          {
            icon: Cpu,
            label: 'Tư vấn cấu hình',
            prompt: 'Tư vấn cho mình laptop lập trình dưới 45 triệu',
          },
          {
            icon: Scale,
            label: 'So sánh trực diện',
            prompt: 'So sánh MacBook Pro M5 và MacBook Air M5',
          },
          {
            icon: Tag,
            label: 'Mã giảm giá & Loyalty',
            prompt: 'Có mã giảm giá nào đang dùng được không?',
          },
          {
            icon: PackageSearch,
            label: 'Chính sách & Đơn hàng',
            prompt: 'Chính sách bảo hành, vận chuyển và thanh toán như thế nào?',
          },
        ]
      : [
          {
            icon: Cpu,
            label: 'Hardware Match',
            prompt: 'Recommend a laptop for coding under 45M VND',
          },
          {
            icon: Scale,
            label: 'Compare Specs',
            prompt: 'Compare MacBook Pro M5 vs MacBook Air M5',
          },
          {
            icon: Tag,
            label: 'Promo Codes',
            prompt: 'What discount codes and loyalty rewards are available?',
          },
          {
            icon: PackageSearch,
            label: 'Policies & Orders',
            prompt: 'What are AEVO warranty, free shipping, and payment policies?',
          },
        ];

  const stopStreamingImmediately = () => {
    if (streamTimerRef.current) {
      clearInterval(streamTimerRef.current);
      streamTimerRef.current = null;
    }
    setStreamingState(null);
  };

  const handleResetChat = () => {
    stopStreamingImmediately();
    setMessages([]);
    setSuggestedPrompts([]);
    try {
      sessionStorage.removeItem(STORAGE_KEY);
    } catch {
      // ignore
    }
  };

  const handleCopyMessage = async (msgId, rawText) => {
    try {
      await navigator.clipboard.writeText(rawText);
      setCopiedId(msgId);
      setTimeout(() => setCopiedId(null), 1800);
    } catch {
      // ignore clipboard errors
    }
  };

  const handleQuickAddToCart = async (e, rec) => {
    e.preventDefault();
    e.stopPropagation();
    if (!rec.defaultVariantId || addedMap[rec.id]) return;

    try {
      setAddedMap((prev) => ({ ...prev, [rec.id]: 'loading' }));
      await cartApi.addItem({ variantId: rec.defaultVariantId, quantity: 1 });
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('aevo:cart-updated'));
      }
      setAddedMap((prev) => ({ ...prev, [rec.id]: 'done' }));
      setTimeout(() => {
        setAddedMap((prev) => ({ ...prev, [rec.id]: null }));
      }, 2200);
    } catch {
      setAddedMap((prev) => ({ ...prev, [rec.id]: null }));
    }
  };

  const sendQuery = async (rawText) => {
    const text = String(rawText ?? input ?? '').trim();
    if (!text || loading) return;

    stopStreamingImmediately();

    const userMsg = {
      id: `user-${Date.now()}`,
      role: 'user',
      text,
    };

    const historyForApi = messages.slice(-6).map((m) => ({
      role: m.role,
      text: m.text,
      intent: m.intent,
      recommendations: Array.isArray(m.recommendations)
        ? m.recommendations.map((r) => ({
            id: r.id,
            name: r.name,
            slug: r.slug,
            categorySlug: r.categorySlug,
            price: r.price,
          }))
        : [],
    }));

    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setLoading(true);

    const requestStart = Date.now();

    try {
      const res = await aiApi.chat({
        message: text,
        locale,
        history: historyForApi,
        pageContext: {
          pathname,
          productSlug: currentProductSlug,
        },
      });

      // Ensure a brief, natural thinking transition (~420ms) before word-by-word streaming starts
      const elapsed = Date.now() - requestStart;
      if (elapsed < 420) {
        await new Promise((r) => setTimeout(r, 420 - elapsed));
      }

      const data = res.data || {};
      const botMsgId = `bot-${Date.now()}`;
      const replyText = data.reply || '';
      const botMsg = {
        id: botMsgId,
        role: 'assistant',
        text: replyText,
        actionBadge: data.actionBadge || null,
        intent: data.intent || null,
        recommendations: Array.isArray(data.recommendations) ? data.recommendations : [],
      };

      setLoading(false);
      setMessages((prev) => [...prev, botMsg]);
      if (replyText) {
        setStreamingState({
          id: botMsgId,
          fullText: replyText,
          visibleText: '',
        });
      }
      if (Array.isArray(data.suggestedPrompts) && data.suggestedPrompts.length > 0) {
        setSuggestedPrompts(data.suggestedPrompts);
      }
    } catch {
      setLoading(false);
      const errId = `err-${Date.now()}`;
      const errText =
        locale === 'vi'
          ? 'Xin lỗi, trợ lý AI đang tạm bận. Vui lòng thử lại sau giây lát.'
          : 'Sorry, the AI Hardware Advisor is momentarily busy. Please try again.';
      setMessages((prev) => [
        ...prev,
        {
          id: errId,
          role: 'assistant',
          text: errText,
          recommendations: [],
        },
      ]);
      setStreamingState({
        id: errId,
        fullText: errText,
        visibleText: '',
      });
    }
  };

  return (
    <div className="fixed bottom-5 right-5 z-40" data-testid="ai-assistant-container">
      {!open ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          data-testid="ai-chatbot-trigger"
          aria-label={t('ai.openChatAria')}
          className="inline-flex items-center gap-2.5 px-4 h-11 rounded-full bg-primary text-primary-foreground border border-border shadow-md hover:shadow-lg hover:-translate-y-0.5 active:scale-95 transition-all duration-200 focus-ring text-small font-medium"
        >
          <Sparkles size={16} aria-hidden="true" />
          <span className="hidden sm:inline">{t('ai.advisorBadge')}</span>
        </button>
      ) : (
        <div
          data-testid="ai-chatbot-panel"
          role="dialog"
          aria-label={t('ai.advisorTitle')}
          className={`w-[calc(100vw-2rem)] ${
            expanded
              ? 'sm:w-[540px] max-h-[82vh] sm:max-h-[680px]'
              : 'sm:w-[410px] max-h-[78vh] sm:max-h-[600px]'
          } flex flex-col rounded-2xl bg-surface border border-border shadow-2xl overflow-hidden animate-scale-in transition-all duration-200`}
        >
          {/* Header */}
          <div className="px-4 py-3 border-b border-border bg-canvas flex items-center justify-between gap-2">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-8 h-8 rounded-xl bg-primary text-primary-foreground flex items-center justify-center shrink-0">
                <Bot size={16} />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="text-small font-medium text-ink truncate">
                    {t('ai.advisorBadge')}
                  </span>
                  <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-surface border border-border text-[9.5px] font-mono text-secondary">
                    <span
                      className={`w-1.5 h-1.5 rounded-full ${
                        loading || streamingState ? 'bg-amber-500 animate-ping' : 'bg-emerald-500'
                      }`}
                    />
                    AI v2
                  </span>
                </div>
                <div className="text-[11px] text-secondary truncate">{t('ai.advisorSubtitle')}</div>
              </div>
            </div>

            <div className="flex items-center gap-1 shrink-0">
              {messages.length > 0 && (
                <button
                  type="button"
                  onClick={handleResetChat}
                  title={locale === 'vi' ? 'Làm mới cuộc trò chuyện' : 'Reset conversation'}
                  aria-label={locale === 'vi' ? 'Làm mới cuộc trò chuyện' : 'Reset conversation'}
                  className="w-7 h-7 rounded-lg inline-flex items-center justify-center text-secondary hover:text-ink hover:bg-surface transition-colors"
                >
                  <RotateCcw size={13.5} />
                </button>
              )}
              <button
                type="button"
                onClick={() => setExpanded((prev) => !prev)}
                title={
                  expanded
                    ? locale === 'vi'
                      ? 'Thu gọn khung chat'
                      : 'Compact view'
                    : locale === 'vi'
                    ? 'Mở rộng khung chat'
                    : 'Expand view'
                }
                aria-label={expanded ? 'Compact view' : 'Expand view'}
                className="hidden sm:inline-flex w-7 h-7 rounded-lg items-center justify-center text-secondary hover:text-ink hover:bg-surface transition-colors"
              >
                {expanded ? <Minimize2 size={13.5} /> : <Maximize2 size={13.5} />}
              </button>
              <button
                type="button"
                onClick={() => setOpen(false)}
                data-testid="ai-chatbot-close"
                aria-label={t('ai.closeChatAria')}
                className="w-7 h-7 rounded-lg inline-flex items-center justify-center text-secondary hover:text-ink hover:bg-surface transition-colors"
              >
                <X size={15} />
              </button>
            </div>
          </div>

          {/* Contextual Product Page Bar if viewing a product */}
          {currentProductSlug && (
            <div className="px-4 py-1.5 bg-surface border-b border-border flex items-center justify-between gap-2 text-[11px]">
              <span className="text-secondary truncate">
                {locale === 'vi' ? 'Đang xem:' : 'Viewing:'}{' '}
                <strong className="text-ink font-mono">{currentProductSlug}</strong>
              </span>
              <button
                type="button"
                onClick={() =>
                  sendQuery(
                    locale === 'vi'
                      ? `Phân tích cấu hình, giá các phiên bản và ưu điểm của sản phẩm này (${currentProductSlug})`
                      : `Analyze configurations, variant pricing, and highlights of this product (${currentProductSlug})`
                  )
                }
                className="shrink-0 font-medium text-ink underline underline-offset-2 hover:opacity-80"
              >
                {locale === 'vi' ? 'Tư vấn máy này →' : 'Ask about this →'}
              </button>
            </div>
          )}

          {/* Messages Feed */}
          <div
            ref={feedRef}
            data-testid="ai-chatbot-messages"
            className={`flex-1 overflow-y-auto p-4 space-y-3.5 ${
              expanded ? 'max-h-[480px]' : 'max-h-[380px]'
            }`}
          >
            {/* Welcome Card & Quick Capability Grid */}
            <div className="p-3.5 rounded-xl bg-canvas border border-border space-y-3">
              <div className="text-[12.5px] text-ink leading-relaxed">{t('ai.welcomeMessage')}</div>
              {messages.length === 0 && (
                <div className="grid grid-cols-2 gap-1.5 pt-0.5">
                  {quickCapabilities.map((cap) => {
                    const IconComp = cap.icon;
                    return (
                      <button
                        key={cap.label}
                        type="button"
                        onClick={() => sendQuery(cap.prompt)}
                        className="flex items-center gap-2 p-2 rounded-lg bg-surface border border-border hover:border-ink/40 text-left transition-all group"
                      >
                        <IconComp
                          size={13}
                          className="text-secondary group-hover:text-ink shrink-0"
                        />
                        <span className="text-[11px] font-medium text-ink truncate">
                          {cap.label}
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {messages.map((msg) => {
              const isThisMsgStreaming = Boolean(streamingState && streamingState.id === msg.id);
              const displayedText = isThisMsgStreaming ? streamingState.visibleText : msg.text;

              return (
                <div
                  key={msg.id}
                  data-testid={msg.role === 'user' ? 'ai-chat-user-msg' : 'ai-chat-bot-msg'}
                  className={`space-y-2 ${msg.role === 'user' ? 'flex justify-end' : ''}`}
                >
                  {msg.role === 'user' ? (
                    <div className="inline-block max-w-[85%] px-3.5 py-2.5 rounded-2xl bg-primary text-primary-foreground text-[12.5px] leading-relaxed">
                      {msg.text}
                    </div>
                  ) : (
                    <div className="p-3.5 rounded-xl bg-canvas border border-border space-y-2">
                      {/* Bot Message Top Bar: Action Badge + Stop/Copy Button */}
                      <div className="flex items-center justify-between gap-2 pb-1 border-b border-border/60">
                        <span className="inline-flex items-center gap-1 text-[10px] font-mono uppercase tracking-wider text-secondary">
                          <Sparkles
                            size={10}
                            className={isThisMsgStreaming ? 'animate-spin' : ''}
                          />
                          {msg.actionBadge ||
                            (locale === 'vi' ? 'AEVO Intelligence' : 'AEVO Advisor')}
                        </span>

                        {isThisMsgStreaming ? (
                          <button
                            type="button"
                            onClick={stopStreamingImmediately}
                            className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-surface border border-border text-[10px] font-medium text-ink hover:opacity-80 transition-opacity"
                          >
                            <Square size={8} className="fill-current" />
                            <span>{locale === 'vi' ? 'Hiện hết' : 'Skip'}</span>
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => handleCopyMessage(msg.id, msg.text)}
                            title={locale === 'vi' ? 'Sao chép câu trả lời' : 'Copy response'}
                            aria-label={locale === 'vi' ? 'Sao chép câu trả lời' : 'Copy response'}
                            className="inline-flex items-center gap-1 text-[10px] text-secondary hover:text-ink transition-colors"
                          >
                            {copiedId === msg.id ? (
                              <>
                                <Check size={11} />
                                <span>{locale === 'vi' ? 'Đã chép' : 'Copied'}</span>
                              </>
                            ) : (
                              <Copy size={11} />
                            )}
                          </button>
                        )}
                      </div>

                      {/* Rich Markdown Content (streamed word-by-word) */}
                      {renderRichMarkdown(displayedText, isThisMsgStreaming)}
                    </div>
                  )}

                  {/* Product Recommendations Cards */}
                  {Array.isArray(msg.recommendations) && msg.recommendations.length > 0 && (
                    <div data-testid="ai-chat-recommendations" className="space-y-2 pt-1">
                      <div className="flex items-center justify-between px-1">
                        <div className="text-[10px] font-mono uppercase tracking-wider text-secondary">
                          {t('ai.recommendedProducts')} ({msg.recommendations.length})
                        </div>
                        {msg.recommendations.length >= 2 && (
                          <button
                            type="button"
                            onClick={() =>
                              sendQuery(
                                locale === 'vi'
                                  ? `So sánh ${msg.recommendations[0].name} và ${msg.recommendations[1].name}`
                                  : `Compare ${msg.recommendations[0].name} vs ${msg.recommendations[1].name}`
                              )
                            }
                            className="inline-flex items-center gap-1 text-[10.5px] font-medium text-ink hover:underline"
                          >
                            <Scale size={11} />
                            <span>
                              {locale === 'vi' ? 'So sánh 2 mẫu đầu' : 'Compare top 2'}
                            </span>
                          </button>
                        )}
                      </div>

                      {msg.recommendations.map((rec) => {
                        const addStatus = addedMap[rec.id];
                        return (
                          <Link
                            key={rec.id}
                            href={`/products/${rec.slug}`}
                            data-testid="ai-recommended-product-card"
                            className="flex items-center gap-3 p-2.5 rounded-xl bg-surface border border-border hover:border-ink/40 transition-all group"
                          >
                            <img
                              src={rec.image || FALLBACK_PRODUCT_IMAGE}
                              alt={rec.name}
                              onError={handleImageError}
                              className="w-12 h-12 rounded-lg object-contain bg-canvas p-1 shrink-0"
                            />
                            <div className="min-w-0 flex-1 space-y-0.5">
                              <div className="flex items-center gap-1.5">
                                <span className="text-[10px] font-mono uppercase text-secondary">
                                  {rec.brand}
                                </span>
                                {rec.averageRating > 0 && (
                                  <span className="inline-flex items-center gap-0.5 text-[10px] font-mono text-secondary">
                                    · <Star size={9} className="fill-current" /> {rec.averageRating}
                                  </span>
                                )}
                                {rec.discountPercent > 0 && (
                                  <span className="px-1.5 py-0.2 rounded bg-canvas border border-border text-[9.5px] font-mono text-ink">
                                    -{rec.discountPercent}%
                                  </span>
                                )}
                              </div>

                              <div className="text-caption font-medium text-ink truncate group-hover:underline">
                                {rec.name}
                              </div>

                              {rec.matchedVariantName && (
                                <div className="text-[10.5px] text-secondary truncate">
                                  {rec.matchedVariantName}
                                </div>
                              )}

                              <div className="flex items-center gap-2 pt-0.5">
                                <span className="text-[11.5px] font-mono font-semibold text-ink">
                                  {formatPrice(rec.price)}
                                </span>
                                {rec.comparePrice > rec.price && (
                                  <span className="text-[10px] font-mono text-secondary line-through">
                                    {formatPrice(rec.comparePrice)}
                                  </span>
                                )}
                              </div>
                            </div>

                            <div className="flex flex-col items-end gap-1.5 shrink-0">
                              {rec.defaultVariantId && (
                                <button
                                  type="button"
                                  onClick={(e) => handleQuickAddToCart(e, rec)}
                                  className="px-2 py-1 rounded-lg bg-canvas border border-border hover:bg-primary hover:text-primary-foreground text-[10.5px] font-medium text-ink inline-flex items-center gap-1 transition-colors"
                                >
                                  {addStatus === 'done' ? (
                                    <>
                                      <Check size={11} />
                                      <span>{locale === 'vi' ? 'Đã thêm' : 'Added'}</span>
                                    </>
                                  ) : (
                                    <>
                                      <ShoppingBag size={11} />
                                      <span>{locale === 'vi' ? '+ Giỏ' : '+ Add'}</span>
                                    </>
                                  )}
                                </button>
                              )}
                              <ArrowUpRight
                                size={13}
                                className="text-secondary group-hover:text-ink"
                              />
                            </div>
                          </Link>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}

            {loading && (
              <div
                data-testid="ai-chatbot-loading"
                className="p-3.5 rounded-xl bg-canvas border border-border flex items-center justify-between gap-2.5 text-caption text-secondary"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <Sparkles size={14} className="shrink-0 animate-spin text-ink" />
                  <span className="truncate">{thinkingLabels[thinkingStep] || t('ai.thinking')}</span>
                </div>
                <span className="flex items-center gap-1 shrink-0">
                  <span className="w-1.5 h-1.5 rounded-full bg-ink/60 animate-bounce" />
                  <span className="w-1.5 h-1.5 rounded-full bg-ink/40 animate-bounce [animation-delay:120ms]" />
                  <span className="w-1.5 h-1.5 rounded-full bg-ink/20 animate-bounce [animation-delay:240ms]" />
                </span>
              </div>
            )}
          </div>

          {/* Quick Prompt Chips */}
          <div className="px-3.5 py-2 border-t border-border bg-canvas/50 flex items-center gap-1.5 overflow-x-auto">
            {activePrompts.slice(0, 4).map((promptText) => (
              <button
                key={promptText}
                type="button"
                onClick={() => sendQuery(promptText)}
                data-testid="ai-quick-prompt"
                className="shrink-0 px-2.5 py-1 rounded-full bg-surface border border-border text-[11px] text-secondary hover:text-ink hover:border-ink transition-colors"
              >
                {promptText}
              </button>
            ))}
          </div>

          {/* Input Bar */}
          <div className="p-3 border-t border-border bg-surface flex items-center gap-2">
            <label htmlFor="ai-chatbot-input" className="sr-only">
              {t('ai.advisorTitle')}
            </label>
            <input
              id="ai-chatbot-input"
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  sendQuery(input);
                }
              }}
              placeholder={t('ai.inputPlaceholder')}
              data-testid="ai-chatbot-input"
              className="flex-1 h-10 px-3 rounded-xl border border-border bg-canvas text-caption text-ink placeholder:text-secondary focus-ring"
            />
            <button
              type="button"
              disabled={loading || !input.trim()}
              onClick={() => sendQuery(input)}
              data-testid="ai-chatbot-send"
              aria-label={t('ai.sendBtn')}
              className="h-10 px-3.5 rounded-xl bg-primary text-primary-foreground text-caption font-medium inline-flex items-center gap-1.5 disabled:opacity-50 hover:bg-primary/90 transition-all"
            >
              <Send size={13} />
              <span>{t('ai.sendBtn')}</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
