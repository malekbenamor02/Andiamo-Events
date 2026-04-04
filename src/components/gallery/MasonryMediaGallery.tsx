import {
  useLayoutEffect,
  useRef,
  useState,
  useEffect,
  useCallback,
  memo,
  type CSSProperties,
} from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { Play, Maximize2 } from "lucide-react";
import { cn } from "@/lib/utils";

if (typeof window !== "undefined") {
  gsap.registerPlugin(ScrollTrigger);
}

export type MasonryGalleryMedia = {
  type: "image" | "video";
  url: string;
};

type MasonryMediaGalleryProps = {
  items: MasonryGalleryMedia[];
  eventId: string;
  eventName: string;
  onItemClick: (index: number) => void;
  className?: string;
  /** Optional credit on each tile (“Event by : …”) when set in admin */
  creditLine?: string;
  language?: "en" | "fr";
};

function useMasonryColumns() {
  const [cols, setCols] = useState(2);

  useEffect(() => {
    const mqXl = window.matchMedia("(min-width: 1280px)");
    const mqLg = window.matchMedia("(min-width: 1024px)");
    const mqSm = window.matchMedia("(min-width: 640px)");

    const update = () => {
      if (mqXl.matches) setCols(4);
      else if (mqLg.matches) setCols(3);
      else if (mqSm.matches) setCols(2);
      else setCols(1);
    };

    update();
    mqXl.addEventListener("change", update);
    mqLg.addEventListener("change", update);
    mqSm.addEventListener("change", update);
    return () => {
      mqXl.removeEventListener("change", update);
      mqLg.removeEventListener("change", update);
      mqSm.removeEventListener("change", update);
    };
  }, []);

  return cols;
}

function useNearViewport(rootMargin = "280px") {
  const ref = useRef<HTMLDivElement>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const obs = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setReady(true);
          obs.disconnect();
        }
      },
      { rootMargin, threshold: 0 }
    );

    obs.observe(el);
    return () => obs.disconnect();
  }, [rootMargin]);

  return { ref, ready };
}

const GAP_PX = 6;

function packMasonryColumns(container: HTMLElement, columnCount: number) {
  const nodes = Array.from(
    container.querySelectorAll<HTMLElement>(".masonry-item")
  );
  if (nodes.length === 0) {
    container.style.height = "0px";
    return;
  }

  const w = container.clientWidth;
  if (w <= 0) return;

  const colW = Math.max(
    0,
    (w - GAP_PX * (columnCount - 1)) / columnCount
  );

  nodes.forEach((el) => {
    el.style.position = "relative";
    el.style.left = "";
    el.style.top = "";
    el.style.width = `${colW}px`;
    el.style.boxSizing = "border-box";
  });

  const measuredHeights = nodes.map((el) => el.offsetHeight);
  const colHeights = new Array(columnCount).fill(0);

  nodes.forEach((el, i) => {
    const col = colHeights.indexOf(Math.min(...colHeights));
    el.style.position = "absolute";
    el.style.left = `${col * (colW + GAP_PX)}px`;
    el.style.top = `${colHeights[col]}px`;
    el.style.width = `${colW}px`;
    colHeights[col] += measuredHeights[i] + GAP_PX;
  });

  container.style.height = `${Math.max(...colHeights, 0)}px`;
}

type TileProps = {
  media: MasonryGalleryMedia;
  index: number;
  eventId: string;
  eventName: string;
  onItemClick: (index: number) => void;
  onMediaLoaded?: () => void;
  creditLine?: string;
  eventByLabel: string;
};

const MasonryTile = memo(function MasonryTile({
  media,
  index,
  eventId,
  eventName,
  onItemClick,
  onMediaLoaded,
  creditLine,
  eventByLabel,
}: TileProps) {
  const itemRef = useRef<HTMLDivElement>(null);
  const { ref: lazyRef, ready } = useNearViewport();

  useEffect(() => {
    const el = itemRef.current;
    if (!el) return;

    const onEnter = () => {
      gsap.to(el, {
        scale: 1.03,
        y: -6,
        duration: 0.4,
        ease: "power2.out",
        overwrite: "auto",
      });
    };
    const onLeave = () => {
      gsap.to(el, {
        scale: 1,
        y: 0,
        duration: 0.5,
        ease: "power3.out",
        overwrite: "auto",
      });
    };

    el.addEventListener("mouseenter", onEnter);
    el.addEventListener("mouseleave", onLeave);
    return () => {
      el.removeEventListener("mouseenter", onEnter);
      el.removeEventListener("mouseleave", onLeave);
    };
  }, []);

  return (
    <div
      ref={lazyRef}
      className="masonry-item [contain:layout_style]"
    >
      <div
        ref={itemRef}
        role="button"
        tabIndex={0}
        onMouseDown={(e) => {
          if (e.button === 0) e.preventDefault();
        }}
        onClick={() => onItemClick(index)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            onItemClick(index);
          }
        }}
        className={cn(
          "group relative cursor-pointer overflow-hidden rounded-2xl bg-black/20",
          "outline-none ring-offset-background transition-shadow focus-visible:ring-2 focus-visible:ring-primary"
        )}
        style={
          {
            willChange: "transform",
          } as CSSProperties
        }
      >
        {!ready ? (
          <div
            className="min-h-[12rem] w-full animate-pulse bg-gradient-to-br from-primary/15 to-accent/10"
            aria-hidden
          />
        ) : media.type === "video" ? (
          <div className="relative w-full">
            <video
              src={media.url}
              className="block w-full object-cover"
              style={{ maxHeight: "min(70vh, 520px)" }}
              muted
              playsInline
              loop
              preload="metadata"
              onLoadedData={onMediaLoaded}
            />
            <div className="pointer-events-none absolute inset-0 z-[4] flex items-center justify-center bg-black/25 transition-colors group-hover:bg-black/35">
              <Play className="h-12 w-12 text-white/85 opacity-90 drop-shadow-lg" />
            </div>
          </div>
        ) : (
          <>
            <img
              src={media.url}
              alt={`${eventName} – ${index + 1}`}
              className="block h-auto w-full object-cover"
              loading="lazy"
              decoding="async"
              width={800}
              height={600}
              onLoad={onMediaLoaded}
            />
          </>
        )}

        {ready && creditLine ? (
          <div className="pointer-events-none absolute inset-x-0 bottom-0 z-[5] bg-gradient-to-t from-black/80 via-black/45 to-transparent px-2 pb-2.5 pt-10 sm:pb-3 sm:pt-12">
            <p className="max-w-full text-center text-[0.6rem] font-medium uppercase leading-snug tracking-[0.14em] text-white/90 sm:text-[0.65rem]">
              {eventByLabel} {creditLine}
            </p>
          </div>
        ) : null}

        {ready && (
          <div className="pointer-events-none absolute inset-0 z-[8] flex items-center justify-center bg-black/0 transition-colors duration-300 group-hover:bg-black/30">
            <div className="opacity-0 transition-opacity duration-300 group-hover:opacity-100">
              <Maximize2 className="h-8 w-8 text-white drop-shadow-md" />
            </div>
          </div>
        )}
      </div>
    </div>
  );
});

export function MasonryMediaGallery({
  items,
  eventId,
  eventName,
  onItemClick,
  className,
  creditLine,
  language = "en",
}: MasonryMediaGalleryProps) {
  const eventByLabel =
    language === "fr" ? "Événement par :" : "Event by :";
  const sectionRef = useRef<HTMLElement>(null);
  const innerRef = useRef<HTMLDivElement>(null);
  const cols = useMasonryColumns();
  const [layoutVersion, setLayoutVersion] = useState(0);
  const layoutDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const itemsKey = items.map((m) => `${m.type}:${m.url}`).join("|");

  const bumpLayout = useCallback(() => {
    if (layoutDebounceRef.current) {
      clearTimeout(layoutDebounceRef.current);
    }
    layoutDebounceRef.current = setTimeout(() => {
      setLayoutVersion((v) => v + 1);
      ScrollTrigger.refresh();
    }, 48);
  }, []);

  useLayoutEffect(() => {
    const inner = innerRef.current;
    if (!inner || items.length === 0) return;
    packMasonryColumns(inner, cols);
    ScrollTrigger.refresh();
  }, [layoutVersion, cols, itemsKey, items.length]);

  useLayoutEffect(() => {
    const section = sectionRef.current;
    const inner = innerRef.current;
    if (!section || !inner || items.length === 0) return;

    const reduced =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const ctx = gsap.context(() => {
      const elements = gsap.utils.toArray<HTMLElement>(
        inner.querySelectorAll(".masonry-item")
      );

      gsap.set(elements, {
        opacity: 0,
        filter: reduced ? "blur(0px)" : "blur(14px)",
      });

      ScrollTrigger.create({
        trigger: section,
        start: "top 88%",
        once: true,
        onEnter: () => {
          gsap.to(elements, {
            opacity: 1,
            filter: "blur(0px)",
            duration: reduced ? 0.35 : 0.72,
            ease: reduced ? "power1.out" : "power3.out",
            stagger: {
              each: reduced ? 0.03 : 0.065,
              from: "start",
            },
            onComplete: () => {
              gsap.set(elements, { clearProps: "filter" });
            },
          });
        },
      });
    }, section);

    return () => {
      ctx.revert();
    };
  }, [eventId, itemsKey, items.length]);

  useEffect(() => {
    const onResize = () => {
      setLayoutVersion((v) => v + 1);
      ScrollTrigger.refresh();
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  if (items.length === 0) return null;

  return (
    <section ref={sectionRef} className={cn("w-full", className)}>
      <div ref={innerRef} className="relative w-full">
        {items.map((media, index) => (
          <MasonryTile
            key={`${eventId}-${index}-${media.url.slice(-24)}`}
            media={media}
            index={index}
            eventId={eventId}
            eventName={eventName}
            onItemClick={onItemClick}
            onMediaLoaded={bumpLayout}
            creditLine={creditLine}
            eventByLabel={eventByLabel}
          />
        ))}
      </div>
    </section>
  );
}
