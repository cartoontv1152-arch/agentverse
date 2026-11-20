import { Fragment } from "react";

/**
 * Small, safe Markdown subset renderer (no HTML injection): paragraphs, bullet and numbered
 * lists, headings as bold lines, bold, italic, inline code, links,
 * bare URLs, @mentions and [n] citations. Everything renders as React elements.
 */

export interface MarkdownOptions {
  /** Mention tokens to highlight, e.g. ["Researcher", "Asha Rao"] */
  mentions?: { label: string; kind: "user" | "agent" }[];
  /** Citation numbers that have a source; rendered as links to `#src-<scope>-<n>` */
  citations?: Map<number, string>;
}

const INLINE = /(\*\*[^*\n]+\*\*|`[^`\n]+`|\[[^\]\n]+\]\(https?:\/\/[^\s)]+\)|https?:\/\/[^\s<>()]+[^\s<>().,;:!?'"]|\*[^*\n]+\*|_[^_\n]+_|\[\d{1,2}(?:\s*,\s*\d{1,2})*\])/g;

function renderInline(text: string, opts: MarkdownOptions, keyPrefix: string): React.ReactNode[] {
  const out: React.ReactNode[] = [];
  let last = 0;
  let i = 0;
  for (const match of text.matchAll(INLINE)) {
    const value = match[0];
    const index = match.index ?? 0;
    if (index > last) out.push(...renderMentions(text.slice(last, index), opts, `${keyPrefix}-t${i}`));
    const key = `${keyPrefix}-m${i++}`;
    if (value.startsWith("**")) out.push(<strong key={key}>{value.slice(2, -2)}</strong>);
    else if (value.startsWith("`")) out.push(<code key={key}>{value.slice(1, -1)}</code>);
    else if (value.startsWith("[") && value.includes("](")) {
      const m = value.match(/^\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)$/);
      out.push(
        m ? (
          <a key={key} href={m[2]} target="_blank" rel="noopener noreferrer nofollow">
            {m[1]}
          </a>
        ) : (
          value
        ),
      );
    } else if (/^\[\d{1,2}(?:\s*,\s*\d{1,2})*\]$/.test(value)) {
      const numbers = value.slice(1, -1).split(",").map((n) => Number(n.trim()));
      const linked = numbers.filter((n) => opts.citations?.has(n));
      if (linked.length === 0) out.push(<Fragment key={key}>{value}</Fragment>);
      else
        out.push(
          <Fragment key={key}>
            {linked.map((n) => (
              <a key={n} href={opts.citations!.get(n)} target="_blank" rel="noopener noreferrer nofollow" className="!no-underline" aria-label={`Source ${n}`}>
                <sup className="ml-0.5 rounded-chip bg-accent/12 px-1 text-[0.7em] font-semibold text-accent">{n}</sup>
              </a>
            ))}
          </Fragment>,
        );
    } else if (value.startsWith("http")) {
      out.push(
        <a key={key} href={value} target="_blank" rel="noopener noreferrer nofollow" className="break-all">
          {value}
        </a>,
      );
    } else if ((value.startsWith("*") || value.startsWith("_")) && value.length > 2) {
      out.push(<em key={key}>{value.slice(1, -1)}</em>);
    } else out.push(value);
    last = index + value.length;
  }
  if (last < text.length) out.push(...renderMentions(text.slice(last), opts, `${keyPrefix}-end`));
  return out;
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function renderMentions(text: string, opts: MarkdownOptions, keyPrefix: string): React.ReactNode[] {
  const mentions = (opts.mentions ?? []).filter((m) => m.label).sort((a, b) => b.label.length - a.label.length);
  if (mentions.length === 0 || !text.includes("@")) return [text];
  const pattern = new RegExp(`@(${mentions.map((m) => escapeRegExp(m.label)).join("|")})(?![\\w])`, "gi");
  const out: React.ReactNode[] = [];
  let last = 0;
  let i = 0;
  for (const match of text.matchAll(pattern)) {
    const index = match.index ?? 0;
    if (index > last) out.push(text.slice(last, index));
    const found = mentions.find((m) => m.label.toLowerCase() === match[1].toLowerCase());
    out.push(
      <span
        key={`${keyPrefix}-@${i++}`}
        className={
          found?.kind === "agent"
            ? "rounded-chip bg-accent/12 px-1 font-medium text-accent"
            : "rounded-full bg-ink/8 px-1.5 font-medium text-ink"
        }
      >
        @{match[1]}
      </span>,
    );
    last = index + match[0].length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

export function Markdown({ text, options = {} }: { text: string; options?: MarkdownOptions }) {
  const lines = text.replace(/\r\n/g, "\n").split("\n");
  const blocks: React.ReactNode[] = [];
  let para: string[] = [];
  let list: { ordered: boolean; items: string[] } | null = null;

  const flushPara = () => {
    if (para.length) {
      const k = `p${blocks.length}`;
      blocks.push(
        <p key={k} className="whitespace-pre-wrap break-words">
          {para.map((line, i) => (
            <Fragment key={i}>
              {i > 0 ? "\n" : null}
              {renderInline(line, options, `${k}-${i}`)}
            </Fragment>
          ))}
        </p>,
      );
      para = [];
    }
  };
  const flushList = () => {
    if (list) {
      const k = `l${blocks.length}`;
      const Tag = list.ordered ? "ol" : "ul";
      blocks.push(
        <Tag key={k}>
          {list.items.map((item, i) => (
            <li key={i} className="break-words">
              {renderInline(item, options, `${k}-${i}`)}
            </li>
          ))}
        </Tag>,
      );
      list = null;
    }
  };

  for (const raw of lines) {
    const line = raw.trimEnd();
    const bullet = line.match(/^\s*[-*•]\s+(.*)$/);
    const ordered = line.match(/^\s*\d+[.)]\s+(.*)$/);
    const heading = line.match(/^#{1,4}\s+(.*)$/);
    if (bullet || ordered) {
      flushPara();
      const isOrdered = Boolean(ordered);
      if (!list || list.ordered !== isOrdered) {
        flushList();
        list = { ordered: isOrdered, items: [] };
      }
      list.items.push((bullet ?? ordered)![1]);
    } else if (heading) {
      flushPara();
      flushList();
      blocks.push(
        <p key={`h${blocks.length}`} className="font-semibold">
          {renderInline(heading[1], options, `h${blocks.length}`)}
        </p>,
      );
    } else if (line.trim() === "") {
      flushPara();
      flushList();
    } else {
      flushList();
      para.push(line);
    }
  }
  flushPara();
  flushList();
  return <div className="prose-chat">{blocks}</div>;
}
