import { useState } from 'react';
import { Button } from './button';
import { ChevronDown, ChevronUp } from 'lucide-react';

interface ExpandableTextProps {
  text: string;
  maxLength?: number;
  className?: string;
  showMoreText?: string;
  showLessText?: string;
}

export function ExpandableText({
  text,
  maxLength = 150,
  className = '',
  showMoreText = 'Show more',
  showLessText = 'Show less'
}: ExpandableTextProps) {
  const safeText = text || '';
  const [isExpanded, setIsExpanded] = useState(false);
  
  const shouldTruncate = safeText.length > maxLength;
  const displayText = isExpanded ? safeText : safeText.slice(0, maxLength) + (shouldTruncate ? '...' : '');

  if (!shouldTruncate) {
    return <p className={className}>{safeText}</p>;
  }

  return (
    <div>
      <p 
        className={`${className} transition-all duration-500 ease-in-out ${
          isExpanded ? 'opacity-100' : 'opacity-90'
        }`}
        style={{
          animation: isExpanded ? 'fadeIn 0.5s ease-in-out' : 'none'
        }}
      >
        {displayText}
      </p>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={() => setIsExpanded(!isExpanded)}
        className="mt-3 h-auto p-2 text-primary hover:text-primary/80 hover:bg-primary/10 transition-all duration-300 rounded-lg group transform hover:scale-105"
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