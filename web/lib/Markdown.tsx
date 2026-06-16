// Rendu markdown stylisé (dark, sobre) pour la prévisualisation des fichiers de config.
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { Components } from "react-markdown";

const C: Components = {
  h1: ({ children }) => <h1 className="mb-3 mt-1 text-xl font-bold text-white/95">{children}</h1>,
  h2: ({ children }) => <h2 className="mb-2 mt-5 border-b border-white/[0.06] pb-1 text-base font-semibold text-white/90">{children}</h2>,
  h3: ({ children }) => <h3 className="mb-1.5 mt-4 text-[13px] font-semibold uppercase tracking-wide text-emerald-200/80">{children}</h3>,
  p: ({ children }) => <p className="mb-3 text-[13px] leading-relaxed text-white/70">{children}</p>,
  ul: ({ children }) => <ul className="mb-3 ml-4 list-disc space-y-1 text-[13px] text-white/70 marker:text-white/30">{children}</ul>,
  ol: ({ children }) => <ol className="mb-3 ml-4 list-decimal space-y-1 text-[13px] text-white/70 marker:text-white/30">{children}</ol>,
  li: ({ children }) => <li className="leading-relaxed">{children}</li>,
  strong: ({ children }) => <strong className="font-semibold text-white/90">{children}</strong>,
  em: ({ children }) => <em className="text-white/80">{children}</em>,
  a: ({ children, href }) => <a href={href} className="text-sky-300 underline decoration-sky-300/30 hover:decoration-sky-300">{children}</a>,
  code: ({ children }) => <code className="rounded bg-white/[0.07] px-1 py-0.5 font-mono text-[12px] text-fuchsia-200/90">{children}</code>,
  pre: ({ children }) => <pre className="mb-3 overflow-x-auto rounded-lg border border-white/[0.06] bg-black/30 p-3 text-[12px] text-white/75">{children}</pre>,
  blockquote: ({ children }) => <blockquote className="mb-3 border-l-2 border-emerald-400/30 pl-3 italic text-white/55">{children}</blockquote>,
  hr: () => <hr className="my-4 border-white/[0.06]" />,
  table: ({ children }) => <table className="mb-3 w-full border-collapse text-[12px]">{children}</table>,
  th: ({ children }) => <th className="border border-white/10 bg-white/[0.03] px-2 py-1 text-left text-white/80">{children}</th>,
  td: ({ children }) => <td className="border border-white/[0.06] px-2 py-1 text-white/65">{children}</td>,
};

export function Markdown({ content }: { content: string }): React.JSX.Element {
  return <ReactMarkdown remarkPlugins={[remarkGfm]} components={C}>{content}</ReactMarkdown>;
}
