type MarkdownContentProps = {
  content: string;
  className?: string;
  stripFirstH1?: boolean;
};

type Block =
  | { type: 'heading'; level: 1 | 2 | 3; text: string }
  | { type: 'list'; items: string[] }
  | { type: 'paragraph'; text: string };

function parseBlocks(content: string): Block[] {
  const normalized = content.replace(/\r\n/g, '\n').trim();
  if (!normalized) return [];

  const lines = normalized.split('\n');
  const blocks: Block[] = [];
  let paragraphLines: string[] = [];
  let listItems: string[] = [];

  const flushParagraph = () => {
    if (!paragraphLines.length) return;
    blocks.push({ type: 'paragraph', text: paragraphLines.join(' ') });
    paragraphLines = [];
  };

  const flushList = () => {
    if (!listItems.length) return;
    blocks.push({ type: 'list', items: listItems });
    listItems = [];
  };

  for (const rawLine of lines) {
    const line = rawLine.trim();

    if (!line) {
      flushParagraph();
      flushList();
      continue;
    }

    const heading3 = line.match(/^###\s+(.+)$/);
    const heading2 = line.match(/^##\s+(.+)$/);
    const heading1 = line.match(/^#\s+(.+)$/);
    const listItem = line.match(/^[-*]\s+(.+)$/);

    if (heading3 || heading2 || heading1) {
      flushParagraph();
      flushList();
      const level = heading3 ? 3 : heading2 ? 2 : 1;
      const text = (heading3?.[1] || heading2?.[1] || heading1?.[1] || '').trim();
      blocks.push({ type: 'heading', level: level as 1 | 2 | 3, text });
      continue;
    }

    if (listItem) {
      flushParagraph();
      listItems.push(listItem[1].trim());
      continue;
    }

    flushList();
    paragraphLines.push(line);
  }

  flushParagraph();
  flushList();

  return blocks;
}

function renderInline(text: string) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g).filter(Boolean);

  return parts.map((part, index) => {
    const strongMatch = part.match(/^\*\*([^*]+)\*\*$/);
    if (strongMatch) {
      return <strong key={index} className="font-semibold text-gray-900">{strongMatch[1]}</strong>;
    }
    return <span key={index}>{part}</span>;
  });
}

export function MarkdownContent({ content, className, stripFirstH1 = false }: MarkdownContentProps) {
  let blocks = parseBlocks(content);

  if (stripFirstH1 && blocks[0]?.type === 'heading' && blocks[0].level === 1) {
    blocks = blocks.slice(1);
  }

  return (
    <div className={className}>
      {blocks.map((block, index) => {
        if (block.type === 'heading') {
          if (block.level === 1) {
            return <h4 key={index} className="text-lg font-semibold text-gray-900 mt-5 first:mt-0 mb-2">{block.text}</h4>;
          }
          if (block.level === 2) {
            return <h5 key={index} className="text-base font-semibold text-gray-900 mt-4 first:mt-0 mb-2">{block.text}</h5>;
          }
          return <h6 key={index} className="text-sm font-semibold uppercase tracking-wide text-gray-700 mt-4 first:mt-0 mb-2">{block.text}</h6>;
        }

        if (block.type === 'list') {
          return (
            <ul key={index} className="list-disc pl-5 space-y-1 text-gray-700">
              {block.items.map((item, itemIndex) => (
                <li key={itemIndex}>{renderInline(item)}</li>
              ))}
            </ul>
          );
        }

        return (
          <p key={index} className="text-gray-700 leading-relaxed">
            {renderInline(block.text)}
          </p>
        );
      })}
    </div>
  );
}
