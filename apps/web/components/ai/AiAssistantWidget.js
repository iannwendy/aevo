'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Sparkles, X, Send, Bot, ArrowUpRight } from 'lucide-react';
import { aiApi } from '../../lib/api';
import { useI18n } from '../../lib/i18n';
import { FALLBACK_PRODUCT_IMAGE, formatPrice, handleImageError } from '../../lib/utils';

export default function AiAssistantWidget() {
  const pathname = usePathname() || '/';
  const { locale, t } = useI18n();
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [messages, setMessages] = useState([]);
  const [suggestedPrompts, setSuggestedPrompts] = useState([]);

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

  const defaultPrompts =
    locale === 'vi'
      ? [
          'Laptop lập trình dưới 35 triệu',
          'Màn hình 4K đồ họa tốt nhất',
          'Card đồ họa RTX chiến game 4K',
        ]
      : [
          'Best laptop for coding under 35M VND',
          '4K OLED monitor for creators',
          'RTX graphics card for 4K gaming',
        ];

  const activePrompts = suggestedPrompts.length > 0 ? suggestedPrompts : defaultPrompts;

  const sendQuery = async (rawText) => {
    const text = String(rawText ?? input ?? '').trim();
    if (!text || loading) return;

    const userMsg = {
      id: `user-${Date.now()}`,
      role: 'user',
      text,
    };

    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setLoading(true);

    try {
      const res = await aiApi.chat({ message: text, locale });
      const data = res.data || {};
      const botMsg = {
        id: `bot-${Date.now()}`,
        role: 'assistant',
        text: data.reply || '',
        recommendations: Array.isArray(data.recommendations) ? data.recommendations : [],
      };
      setMessages((prev) => [...prev, botMsg]);
      if (Array.isArray(data.suggestedPrompts) && data.suggestedPrompts.length > 0) {
        setSuggestedPrompts(data.suggestedPrompts);
      }
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          id: `err-${Date.now()}`,
          role: 'assistant',
          text:
            locale === 'vi'
              ? 'Xin lỗi, trợ lý AI đang tạm bận. Vui lòng thử lại sau giây lát.'
              : 'Sorry, the AI Hardware Advisor is momentarily busy. Please try again.',
          recommendations: [],
        },
      ]);
    } finally {
      setLoading(false);
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
          className="inline-flex items-center gap-2 px-4 h-11 rounded-full bg-primary text-primary-foreground border border-border shadow-md hover:shadow-lg hover:-translate-y-0.5 active:scale-95 transition-all duration-200 focus-ring text-small font-medium"
        >
          <Sparkles size={16} aria-hidden="true" />
          <span className="hidden sm:inline">{t('ai.advisorBadge')}</span>
        </button>
      ) : (
        <div
          data-testid="ai-chatbot-panel"
          role="dialog"
          aria-label={t('ai.advisorTitle')}
          className="w-[calc(100vw-2.5rem)] sm:w-[380px] max-h-[560px] flex flex-col rounded-2xl bg-surface border border-border shadow-xl overflow-hidden animate-scale-in"
        >
          {/* Header */}
          <div className="px-4 py-3.5 border-b border-border bg-canvas flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-primary text-primary-foreground flex items-center justify-center shrink-0">
                <Bot size={16} />
              </div>
              <div>
                <div className="text-small font-medium text-ink leading-tight">
                  {t('ai.advisorBadge')}
                </div>
                <div className="text-[11px] text-secondary">{t('ai.advisorSubtitle')}</div>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              data-testid="ai-chatbot-close"
              aria-label={t('ai.closeChatAria')}
              className="w-8 h-8 rounded-lg inline-flex items-center justify-center text-secondary hover:text-ink hover:bg-surface transition-colors"
            >
              <X size={16} />
            </button>
          </div>

          {/* Messages Feed */}
          <div
            data-testid="ai-chatbot-messages"
            className="flex-1 overflow-y-auto p-4 space-y-3 max-h-[340px]"
          >
            <div className="p-3 rounded-xl bg-canvas border border-border text-caption text-ink leading-relaxed">
              {t('ai.welcomeMessage')}
            </div>

            {messages.map((msg) => (
              <div
                key={msg.id}
                data-testid={msg.role === 'user' ? 'ai-chat-user-msg' : 'ai-chat-bot-msg'}
                className={`space-y-2 ${msg.role === 'user' ? 'flex justify-end' : ''}`}
              >
                <div
                  className={
                    msg.role === 'user'
                      ? 'inline-block max-w-[85%] px-3.5 py-2.5 rounded-2xl bg-primary text-primary-foreground text-caption'
                      : 'p-3 rounded-xl bg-canvas border border-border text-caption text-ink leading-relaxed'
                  }
                >
                  {msg.text}
                </div>

                {Array.isArray(msg.recommendations) && msg.recommendations.length > 0 && (
                  <div
                    data-testid="ai-chat-recommendations"
                    className="space-y-2 pt-1"
                  >
                    <div className="text-[10px] font-mono uppercase tracking-wider text-secondary px-1">
                      {t('ai.recommendedProducts')} ({msg.recommendations.length})
                    </div>
                    {msg.recommendations.map((rec) => (
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
                          className="w-11 h-11 rounded-lg object-contain bg-canvas p-1 shrink-0"
                        />
                        <div className="min-w-0 flex-1">
                          <div className="text-caption font-medium text-ink truncate group-hover:underline">
                            {rec.name}
                          </div>
                          <div className="text-[11px] font-mono text-secondary">
                            {rec.brand} · {formatPrice(rec.price)}
                          </div>
                        </div>
                        <ArrowUpRight
                          size={14}
                          className="text-secondary group-hover:text-ink shrink-0"
                        />
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            ))}

            {loading && (
              <div
                data-testid="ai-chatbot-loading"
                className="p-3 rounded-xl bg-canvas border border-border text-caption text-secondary animate-pulse"
              >
                {t('ai.thinking')}
              </div>
            )}
          </div>

          {/* Quick Prompt Chips */}
          <div className="px-4 py-2 border-t border-border bg-canvas/50 flex items-center gap-1.5 overflow-x-auto">
            {activePrompts.slice(0, 3).map((promptText) => (
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
