import { useState, useEffect } from 'react';

interface TypewriterTextProps {
  texts: string[];
  speed?: number;
  deleteSpeed?: number;
  pauseTime?: number;
  className?: string;
}

const TypewriterText = ({ 
  texts, 
  speed = 80, 
  deleteSpeed = 40, 
  pauseTime = 2500,
  className = '' 
}: TypewriterTextProps) => {
  const [currentTextIndex, setCurrentTextIndex] = useState(0);
  const [displayText, setDisplayText] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);

  // Check if current text contains Arabic characters
  const isArabic = /[\u0600-\u06FF]/.test(texts[currentTextIndex] || '');

  useEffect(() => {
    let timeout: NodeJS.Timeout;
    const currentText = texts[currentTextIndex];

    if (!isDeleting) {
      // Typing
      if (displayText.length < currentText.length) {
        timeout = setTimeout(() => {
          setDisplayText(currentText.slice(0, displayText.length + 1));
        }, speed);
      } else {
        // Finished typing, pause then start deleting
        timeout = setTimeout(() => {
          setIsDeleting(true);
        }, pauseTime);
      }
    } else {
      // Deleting
      if (displayText.length > 0) {
        timeout = setTimeout(() => {
          setDisplayText(currentText.slice(0, displayText.length - 1));
        }, deleteSpeed);
      } else {
        // Finished deleting, move to next text
        setIsDeleting(false);
        setCurrentTextIndex((prev) => (prev + 1) % texts.length);
      }
    }

    return () => clearTimeout(timeout);
  }, [displayText, isDeleting, currentTextIndex, texts, speed, deleteSpeed, pauseTime]);

  // Don't uppercase Arabic text, only ASCII text
  const formattedText = isArabic ? displayText : displayText.toUpperCase();

  return (
    <span className={`${className} ${isArabic ? 'arabic-inline' : ''}`}>
      {formattedText}
      <span 
        className={`inline-block w-[2px] h-[1em] ${isArabic ? 'ms-1.5' : 'ml-1.5'} align-middle bg-white`}
        style={{ 
          animation: 'blink 1s step-end infinite'
        }}
      />
    </span>
  );
};

export default TypewriterText;

