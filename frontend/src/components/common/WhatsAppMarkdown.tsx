import React, { useState } from 'react';
import { Copy, Check, ExternalLink } from 'lucide-react';

interface WhatsAppMarkdownProps {
  content: string;
  className?: string;
  compact?: boolean;
}

interface InlineToken {
  type: 'text' | 'bold' | 'italic' | 'strike' | 'code' | 'url';
  content: string;
  raw?: string;
}

/**
 * Tokenizes a single line of text according to WhatsApp markdown rules:
 * - Code: `code`
 * - URL: https://... or http://... or www....
 * - Bold: *bold* (word/boundary sensitive)
 * - Italic: _italic_ (avoiding snake_case)
 * - Strikethrough: ~strike~
 */
function parseInline(text: string): InlineToken[] {
  const tokens: InlineToken[] = [];
  let remaining = text;

  const patterns = [
    { type: 'code' as const, regex: /^`([^`\n]+)`/ },
    { type: 'url' as const, regex: /^(https?:\/\/[^\s<)]+|www\.[^\s<)]+)/ },
    { type: 'bold' as const, regex: /^\*([^\s*](?:[^*\n]*?[^\s*])?)\*/ },
    { type: 'strike' as const, regex: /^~([^\s~](?:[^~\n]*?[^\s~])?)~/ },
    { type: 'italic' as const, regex: /^_([^\s_](?:[^_\n]*?[^\s_])?)_/ },
  ];

  while (remaining.length > 0) {
    let matched = false;

    for (const { type, regex } of patterns) {
      const match = remaining.match(regex);
      if (match) {
        // WhatsApp guard: _ must not be surrounded by alphanumeric characters (e.g. snake_case)
        if (type === 'italic') {
          const prevChar = text[text.length - remaining.length - 1];
          if (prevChar && /\w/.test(prevChar)) {
            continue;
          }
          const nextChar = remaining[match[0].length];
          if (nextChar && /\w/.test(nextChar)) {
            continue;
          }
        }

        matched = true;
        tokens.push({ type, raw: match[0], content: match[1] });
        remaining = remaining.slice(match[0].length);
        break;
      }
    }

    if (!matched) {
      const nextSpecial = remaining.search(/[`*~_]|https?:\/\/|www\./);
      if (nextSpecial === -1) {
        tokens.push({ type: 'text', content: remaining });
        break;
      } else if (nextSpecial === 0) {
        tokens.push({ type: 'text', content: remaining[0] });
        remaining = remaining.slice(1);
      } else {
        tokens.push({ type: 'text', content: remaining.slice(0, nextSpecial) });
        remaining = remaining.slice(nextSpecial);
      }
    }
  }

  return tokens;
}

/**
 * Recursively renders inline tokens into React nodes
 */
function renderInlineTokens(tokens: InlineToken[], keyPrefix = ''): React.ReactNode[] {
  return tokens.map((token, idx) => {
    const key = `${keyPrefix}-${idx}`;

    switch (token.type) {
      case 'bold': {
        // Recursively parse any nested formats inside bold (e.g. *_bold italic_*)
        const innerTokens = parseInline(token.content);
        const hasNested = innerTokens.length > 1 || innerTokens[0]?.type !== 'text';
        return (
          <strong key={key} className="font-bold text-slate-900 dark:text-white">
            {hasNested ? renderInlineTokens(innerTokens, `${key}-b`) : token.content}
          </strong>
        );
      }

      case 'italic': {
        const innerTokens = parseInline(token.content);
        const hasNested = innerTokens.length > 1 || innerTokens[0]?.type !== 'text';
        return (
          <em key={key} className="italic text-slate-800 dark:text-slate-200">
            {hasNested ? renderInlineTokens(innerTokens, `${key}-i`) : token.content}
          </em>
        );
      }

      case 'strike': {
        const innerTokens = parseInline(token.content);
        const hasNested = innerTokens.length > 1 || innerTokens[0]?.type !== 'text';
        return (
          <del key={key} className="line-through text-slate-400 dark:text-slate-500 opacity-80">
            {hasNested ? renderInlineTokens(innerTokens, `${key}-s`) : token.content}
          </del>
        );
      }

      case 'code':
        return (
          <code
            key={key}
            className="px-1.5 py-0.5 mx-0.5 rounded-md bg-slate-200/80 dark:bg-slate-800 text-[11px] font-mono font-medium text-emerald-700 dark:text-emerald-400 border border-slate-300/60 dark:border-slate-700/60 select-all"
          >
            {token.content}
          </code>
        );

      case 'url': {
        const href = token.content.startsWith('http') ? token.content : `https://${token.content}`;
        return (
          <a
            key={key}
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="text-emerald-600 dark:text-emerald-400 hover:text-emerald-700 dark:hover:text-emerald-300 underline underline-offset-2 inline-flex items-center gap-0.5 font-medium transition-colors break-all"
          >
            <span>{token.content}</span>
            <ExternalLink className="w-2.5 h-2.5 opacity-70 shrink-0 inline" />
          </a>
        );
      }

      case 'text':
      default:
        return <React.Fragment key={key}>{token.content}</React.Fragment>;
    }
  });
}

/**
 * Standalone Copyable Code Block component
 */
const CodeBlock: React.FC<{ code: string; language?: string }> = ({ code, language }) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = (e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(code).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <div className="my-2 rounded-xl overflow-hidden border border-slate-200 dark:border-slate-800 bg-slate-900 text-slate-100 font-mono text-xs shadow-inner">
      <div className="flex items-center justify-between px-3 py-1.5 bg-slate-800/80 border-b border-slate-700/60 text-[10px] text-slate-400">
        <span className="font-semibold uppercase tracking-wider">{language || 'code'}</span>
        <button
          type="button"
          onClick={handleCopy}
          className="flex items-center gap-1 hover:text-white transition-colors cursor-pointer"
          title="Copy code"
        >
          {copied ? (
            <>
              <Check className="w-3 h-3 text-emerald-400" />
              <span className="text-emerald-400 font-sans">Copied</span>
            </>
          ) : (
            <>
              <Copy className="w-3 h-3" />
              <span className="font-sans">Copy</span>
            </>
          )}
        </button>
      </div>
      <pre className="p-3 overflow-x-auto leading-relaxed select-text font-mono text-[11px] whitespace-pre">
        <code>{code}</code>
      </pre>
    </div>
  );
};

export const WhatsAppMarkdown: React.FC<WhatsAppMarkdownProps> = ({
  content,
  className = '',
  compact = false
}) => {
  if (!content) return null;

  // COMPACT MODE: (for message tables / previews)
  if (compact) {
    // In compact mode, strip multiline fences to single-line representation
    const simplified = content
      .replace(/```(?:[a-zA-Z0-9_-]+)?\n?([\s\S]*?)```/g, '`$1`')
      .replace(/\n+/g, ' ');
    const tokens = parseInline(simplified);
    return <span className={className}>{renderInlineTokens(tokens, 'compact')}</span>;
  }

  // FULL MODE: parse code blocks, blockquotes, lists, paragraphs
  // 1. Split by multiline code fences: ```lang\n...```
  const codeBlockRegex = /```(?:([a-zA-Z0-9_-]+)\n)?([\s\S]*?)```/g;
  const segments: Array<{ isCode: boolean; language?: string; text: string }> = [];

  let lastIdx = 0;
  let cbMatch: RegExpExecArray | null;

  while ((cbMatch = codeBlockRegex.exec(content)) !== null) {
    if (cbMatch.index > lastIdx) {
      segments.push({
        isCode: false,
        text: content.substring(lastIdx, cbMatch.index)
      });
    }
    segments.push({
      isCode: true,
      language: cbMatch[1],
      text: cbMatch[2]
    });
    lastIdx = codeBlockRegex.lastIndex;
  }

  if (lastIdx < content.length) {
    segments.push({
      isCode: false,
      text: content.substring(lastIdx)
    });
  }

  return (
    <div className={`space-y-1.5 leading-relaxed break-words select-text ${className}`}>
      {segments.map((seg, segIdx) => {
        if (seg.isCode) {
          return <CodeBlock key={`seg-cb-${segIdx}`} code={seg.text} language={seg.language} />;
        }

        // Process line by line
        const lines = seg.text.split('\n');
        const renderedLines: React.ReactNode[] = [];

        let currentQuote: string[] = [];
        let currentBulletList: string[] = [];
        let currentNumList: Array<{ num: string; text: string }> = [];

        const flushQuote = (key: string) => {
          if (currentQuote.length === 0) return;
          renderedLines.push(
            <blockquote
              key={key}
              className="my-1.5 pl-3 py-1 border-l-2 border-emerald-500/80 bg-emerald-500/5 dark:bg-emerald-500/10 rounded-r-lg text-slate-700 dark:text-slate-300 italic text-xs space-y-1"
            >
              {currentQuote.map((qLine, qIdx) => (
                <div key={`${key}-q-${qIdx}`}>
                  {renderInlineTokens(parseInline(qLine), `${key}-qline-${qIdx}`)}
                </div>
              ))}
            </blockquote>
          );
          currentQuote = [];
        };

        const flushBulletList = (key: string) => {
          if (currentBulletList.length === 0) return;
          renderedLines.push(
            <ul key={key} className="my-1 space-y-1 pl-1">
              {currentBulletList.map((item, bIdx) => (
                <li key={`${key}-b-${bIdx}`} className="flex items-start gap-2 text-xs">
                  <span className="text-emerald-500 dark:text-emerald-400 font-bold select-none shrink-0 mt-0.5">•</span>
                  <div className="flex-1 min-w-0">
                    {renderInlineTokens(parseInline(item), `${key}-bitem-${bIdx}`)}
                  </div>
                </li>
              ))}
            </ul>
          );
          currentBulletList = [];
        };

        const flushNumList = (key: string) => {
          if (currentNumList.length === 0) return;
          renderedLines.push(
            <ol key={key} className="my-1 space-y-1 pl-1">
              {currentNumList.map((item, nIdx) => (
                <li key={`${key}-n-${nIdx}`} className="flex items-start gap-2 text-xs">
                  <span className="font-mono text-emerald-600 dark:text-emerald-400 font-semibold select-none shrink-0 min-w-[1.2rem] text-[11px] mt-0.5">
                    {item.num}.
                  </span>
                  <div className="flex-1 min-w-0">
                    {renderInlineTokens(parseInline(item.text), `${key}-nitem-${nIdx}`)}
                  </div>
                </li>
              ))}
            </ol>
          );
          currentNumList = [];
        };

        const flushAllBlocks = (lineIdx: number) => {
          flushQuote(`fq-${segIdx}-${lineIdx}`);
          flushBulletList(`fb-${segIdx}-${lineIdx}`);
          flushNumList(`fn-${segIdx}-${lineIdx}`);
        };

        lines.forEach((line, lineIdx) => {
          // Check Blockquote: > text
          const quoteMatch = line.match(/^>\s?(.*)$/);
          if (quoteMatch) {
            flushBulletList(`fb-pre-q-${segIdx}-${lineIdx}`);
            flushNumList(`fn-pre-q-${segIdx}-${lineIdx}`);
            currentQuote.push(quoteMatch[1]);
            return;
          } else {
            flushQuote(`fq-post-${segIdx}-${lineIdx}`);
          }

          // Check Bullet list: - text or * text
          const bulletMatch = line.match(/^[-*]\s+(.*)$/);
          if (bulletMatch) {
            flushNumList(`fn-pre-b-${segIdx}-${lineIdx}`);
            currentBulletList.push(bulletMatch[1]);
            return;
          } else {
            flushBulletList(`fb-post-${segIdx}-${lineIdx}`);
          }

          // Check Numbered list: 1. text
          const numMatch = line.match(/^(\d+)\.\s+(.*)$/);
          if (numMatch) {
            currentNumList.push({ num: numMatch[1], text: numMatch[2] });
            return;
          } else {
            flushNumList(`fn-post-${segIdx}-${lineIdx}`);
          }

          // Empty line:
          if (!line.trim()) {
            flushAllBlocks(lineIdx);
            renderedLines.push(<div key={`empty-${segIdx}-${lineIdx}`} className="h-2" />);
            return;
          }

          // Normal Paragraph Line:
          const tokens = parseInline(line);
          renderedLines.push(
            <div key={`p-${segIdx}-${lineIdx}`} className="text-xs">
              {renderInlineTokens(tokens, `line-${segIdx}-${lineIdx}`)}
            </div>
          );
        });

        // Flush any remaining active blocks at end of segment
        flushAllBlocks(lines.length);

        return (
          <React.Fragment key={`seg-${segIdx}`}>
            {renderedLines}
          </React.Fragment>
        );
      })}
    </div>
  );
};
