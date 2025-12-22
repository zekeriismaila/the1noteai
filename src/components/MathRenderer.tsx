import { useEffect, useRef } from "react";
import katex from "katex";
import "katex/dist/katex.min.css";

interface MathRendererProps {
  content: string;
}

export default function MathRenderer({ content }: MathRendererProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    // Process the content and render math
    const processed = processContent(content);
    containerRef.current.innerHTML = processed;
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
