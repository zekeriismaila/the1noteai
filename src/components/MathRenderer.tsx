import { useEffect, useRef } from "react";
import katex from "katex";
import DOMPurify from "dompurify";
import "katex/dist/katex.min.css";

interface MathRendererProps {
  content: string;
}

// Configure DOMPurify to allow KaTeX-generated elements
const sanitizeConfig = {
  ALLOWED_TAGS: [
    'div', 'span', 'strong', 'em', 'br', 'p',
    // KaTeX-specific elements
    'math', 'semantics', 'mrow', 'mi', 'mo', 'mn', 'msup', 'msub', 
    'mfrac', 'mover', 'munder', 'munderover', 'msqrt', 'mroot',
    'mtable', 'mtr', 'mtd', 'mtext', 'mspace', 'annotation',
    'svg', 'line', 'path', 'g', 'rect'
  ],
  ALLOWED_ATTR: [
    'class', 'style', 'xmlns', 'width', 'height', 'viewBox',
    'preserveAspectRatio', 'd', 'x', 'y', 'x1', 'x2', 'y1', 'y2',
    'fill', 'stroke', 'stroke-width', 'transform', 'encoding',
    'mathvariant', 'stretchy', 'fence', 'separator', 'accent',
    'lspace', 'rspace', 'displaystyle', 'scriptlevel'
  ],
  ALLOW_DATA_ATTR: false,
  ALLOW_UNKNOWN_PROTOCOLS: false,
};

export default function MathRenderer({ content }: MathRendererProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    // Process the content and render math, then sanitize
    const processed = processContent(content);
    containerRef.current.innerHTML = DOMPurify.sanitize(processed, sanitizeConfig);
  }, [content]);

  const processContent = (text: string): string => {
    // Replace display math ($$...$$)
    let result = text.replace(/\$\$([\s\S]*?)\$\$/g, (_, math) => {
      try {
        return `<div class="math-block">${katex.renderToString(math.trim(), {
          displayMode: true,
          throwOnError: false,
        })}</div>`;
      } catch (e) {
        return `<div class="math-block text-destructive">${math}</div>`;
      }
    });

    // Replace inline math ($...$)
    result = result.replace(/\$([^\$\n]+?)\$/g, (_, math) => {
      try {
        return katex.renderToString(math.trim(), {
          displayMode: false,
          throwOnError: false,
        });
      } catch (e) {
        return `<span class="text-destructive">${math}</span>`;
      }
    });

    // Replace LaTeX-style \[ ... \] for display math
    result = result.replace(/\\\[([\s\S]*?)\\\]/g, (_, math) => {
      try {
        return `<div class="math-block">${katex.renderToString(math.trim(), {
          displayMode: true,
          throwOnError: false,
        })}</div>`;
      } catch (e) {
        return `<div class="math-block text-destructive">${math}</div>`;
      }
    });

    // Replace LaTeX-style \( ... \) for inline math
    result = result.replace(/\\\(([\s\S]*?)\\\)/g, (_, math) => {
      try {
        return katex.renderToString(math.trim(), {
          displayMode: false,
          throwOnError: false,
        });
      } catch (e) {
        return `<span class="text-destructive">${math}</span>`;
      }
    });

    // Process step-by-step solutions
    result = result.replace(/\*\*Given:\*\*/gi, '<div class="solution-step"><span class="solution-step-label">Given</span>');
    result = result.replace(/\*\*Formula:\*\*/gi, '</div><div class="solution-step"><span class="solution-step-label">Formula</span>');
    result = result.replace(/\*\*Solution:\*\*/gi, '</div><div class="solution-step"><span class="solution-step-label">Solution</span>');
    result = result.replace(/\*\*Step (\d+):\*\*/gi, '</div><div class="solution-step"><span class="solution-step-label">Step $1</span>');
    result = result.replace(/\*\*Answer:\*\*/gi, '</div><div class="solution-step"><span class="solution-step-label">Answer</span>');

    // Clean up any unclosed divs
    const openDivs = (result.match(/<div class="solution-step">/g) || []).length;
    const closeDivs = (result.match(/<\/div>/g) || []).length;
    if (openDivs > closeDivs) {
      result += "</div>".repeat(openDivs - closeDivs);
    }

    // Process markdown-style bold
    result = result.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');

    // Process markdown-style italic
    result = result.replace(/\*(.+?)\*/g, '<em>$1</em>');

    // Process newlines
    result = result.replace(/\n/g, '<br>');

    return result;
  };

  return (
    <div 
      ref={containerRef} 
      className="math-content prose prose-sm max-w-none dark:prose-invert"
    />
  );
}
