import type { Components } from "react-markdown";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "cnfast";

const components: Components = {
  p: ({ children }) => (
    <p className="mb-2 leading-relaxed last:mb-0">{children}</p>
  ),
  ul: ({ children }) => (
    <ul className="mb-2 list-disc space-y-1 pl-4 last:mb-0">{children}</ul>
  ),
  ol: ({ children }) => (
    <ol className="mb-2 list-decimal space-y-1 pl-4 last:mb-0">{children}</ol>
  ),
  li: ({ children }) => <li className="leading-relaxed">{children}</li>,
  strong: ({ children }) => (
    <strong className="font-semibold text-foreground">{children}</strong>
  ),
  h1: ({ children }) => (
    <p className="mb-2 font-semibold last:mb-0">{children}</p>
  ),
  h2: ({ children }) => (
    <p className="mb-2 font-semibold last:mb-0">{children}</p>
  ),
  h3: ({ children }) => (
    <p className="mb-1.5 font-semibold last:mb-0">{children}</p>
  ),
  em: ({ children }) => <em>{children}</em>,
  code: ({ children }) => (
    <code className="rounded-sm bg-background/80 px-1 py-0.5 font-mono text-xs">
      {children}
    </code>
  ),
  a: ({ href, children }) => (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="text-monitor underline underline-offset-2 dark:text-warning"
    >
      {children}
    </a>
  ),
  table: ({ children }) => (
    <Table className="mb-2 text-xs last:mb-0">{children}</Table>
  ),
  thead: ({ children }) => <TableHeader>{children}</TableHeader>,
  tbody: ({ children }) => <TableBody>{children}</TableBody>,
  tr: ({ children }) => <TableRow>{children}</TableRow>,
  th: ({ children }) => (
    <TableHead className="h-auto whitespace-normal py-1.5">
      {children}
    </TableHead>
  ),
  td: ({ children }) => (
    <TableCell className="whitespace-normal">{children}</TableCell>
  ),
};

type ChatMarkdownProps = {
  content: string;
  className?: string;
};

export function ChatMarkdown({ content, className }: ChatMarkdownProps) {
  return (
    <div className={cn("min-w-0 wrap-break-word", className)}>
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
        {content}
      </ReactMarkdown>
    </div>
  );
}
