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
    <div className={className}>
      <p>{displayText}</p>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => setIsExpanded(!isExpanded)}
        className="mt-2 h-auto p-0 text-primary hover:text-primary/80 hover:bg-transparent"
      >
        {isExpanded ? (
          <>
            {showLessText}
            <ChevronUp className="ml-1 h-4 w-4" />
          </>
        ) : (
          <>
            {showMoreText}
            <ChevronDown className="ml-1 h-4 w-4" />
          </>
        )}
      </Button>
    </div>
  );
} 