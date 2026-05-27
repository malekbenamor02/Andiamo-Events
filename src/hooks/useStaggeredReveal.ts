import { useEffect, useRef, useState } from 'react';

interface UseStaggeredRevealOptions {
  threshold?: number;
  rootMargin?: string;
  staggerMs?: number;
}

export function useStaggeredReveal(
  itemCount: number,
  { threshold = 0.12, rootMargin = '0px 0px -48px 0px', staggerMs = 90 }: UseStaggeredRevealOptions = {}
) {
  const ref = useRef<HTMLDivElement>(null);
  const [revealed, setRevealed] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setRevealed(true);
          observer.disconnect();
        }
      },
      { threshold, rootMargin }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [threshold, rootMargin]);

  const getDelay = (index: number) => (revealed ? index * staggerMs : 0);

  return { ref, revealed, getDelay, itemCount };
}
