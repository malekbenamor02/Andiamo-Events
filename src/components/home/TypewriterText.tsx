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
  const [showCursor, setShowCursor] = useState(true);

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

  // Cursor blink animation
  useEffect(() => {
    const cursorInterval = setInterval(() => {
      setShowCursor((prev) => !prev);
    }, 530);

    return () => clearInterval(cursorInterval);
  }, []);

  // Don't uppercase Arabic text, only ASCII text
  const formattedText = isArabic ? displayText : displayText.toUpperCase();

  return (
    <span className={`${className} ${isArabic ? 'arabic-inline' : ''}`}>
      {formattedText}
      <span className={`inline-block w-[2px] h-[1em] bg-current ${isArabic ? 'ms-1.5' : 'ml-1.5'} align-middle ${showCursor ? 'opacity-100' : 'opacity-0'} transition-opacity duration-200`} style={{ animation: 'blink 1s infinite' }}>
        |
      </span>
    </span>
  );
};

export default TypewriterText;

