import { useLayoutEffect, useRef, useState, type CSSProperties } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from './button';

interface ExpandableTextProps {
  text: string;
  maxLength?: number;
  /** When set, clamps by visible lines (better for tall multi-line descriptions). */
  maxLines?: number;
  className?: string;
  showMoreText?: string;
  showLessText?: string;
}

function lineClampStyle(maxLines: number): CSSProperties {
  return {
    display: '-webkit-box',
    WebkitLineClamp: maxLines,
    WebkitBoxOrient: 'vertical',
    overflow: 'hidden',
  };
}

export function ExpandableText({
  text,
  maxLength = 150,
  maxLines,
  className = '',
  showMoreText = 'Show more',
  showLessText = 'Show less',
}: ExpandableTextProps) {
  const safeText = text || '';
  const [isExpanded, setIsExpanded] = useState(false);
  const textRef = useRef<HTMLParagraphElement>(null);
  const [isOverflowing, setIsOverflowing] = useState(false);

  const useLineClamp = maxLines != null && maxLines > 0;

  useLayoutEffect(() => {
    if (!useLineClamp || isExpanded) return;

    const el = textRef.current;
    if (!el) return;

    const measure = () => {
      setIsOverflowing(el.scrollHeight > el.clientHeight + 1);
    };

    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, [safeText, maxLines, isExpanded, useLineClamp, className]);

  const toggleButton = (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      onClick={() => setIsExpanded((prev) => !prev)}
      className="group mt-3 h-auto transform rounded-lg p-2 text-primary transition-all duration-300 hover:scale-105 hover:bg-primary/10 hover:text-primary/80"
    >
      <span className="flex items-center gap-1">
        {isExpanded ? (
          <>
            {showLessText}
            <ChevronUp className="ml-1 h-4 w-4 transition-transform duration-300 group-hover:scale-110" />
          </>
        ) : (
          <>
            {showMoreText}
            <ChevronDown className="ml-1 h-4 w-4 transition-transform duration-300 group-hover:scale-110" />
          </>
        )}
      </span>
    </Button>
  );

  if (useLineClamp) {
    const showToggle = isExpanded || isOverflowing;

    return (
      <div>
        <p
          ref={textRef}
          className={cn(
            className,
            'transition-all duration-500 ease-in-out',
            isExpanded ? 'opacity-100' : 'opacity-90'
          )}
          style={!isExpanded ? lineClampStyle(maxLines!) : undefined}
        >
          {safeText}
        </p>
        {showToggle ? toggleButton : null}
      </div>
    );
  }

  const shouldTruncate = safeText.length > maxLength;
  const displayText = isExpanded ? safeText : safeText.slice(0, maxLength) + (shouldTruncate ? '...' : '');

  if (!shouldTruncate) {
    return <p className={className}>{safeText}</p>;
  }

  return (
    <div>
      <p
        className={cn(
          className,
          'transition-all duration-500 ease-in-out',
          isExpanded ? 'opacity-100' : 'opacity-90'
        )}
        style={{
          animation: isExpanded ? 'fadeIn 0.5s ease-in-out' : undefined,
        }}
      >
        {displayText}
      </p>
      {toggleButton}
      <style>{`
        @keyframes fadeIn {
          from {
            opacity: 0;
            transform: translateY(-5px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>
    </div>
  );
}
