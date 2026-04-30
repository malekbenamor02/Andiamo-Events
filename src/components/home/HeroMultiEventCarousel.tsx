import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Calendar } from "lucide-react";
import useEmblaCarousel from "embla-carousel-react";
import { Button } from "@/components/ui/button";
import { cn, generateSlug } from "@/lib/utils";
import type { Event } from "@/hooks/useEvents";

function passPurchaseSlug(event: Event): string {
  const raw = typeof event.slug === "string" ? event.slug.trim() : "";
  return raw || generateSlug(event.name);
}

const AUTOPLAY_MS = 6000;

interface HeroMultiEventCarouselProps {
  events: Event[];
  language: "en" | "fr";
  onCriticalMediaLoaded?: () => void;
}

export function HeroMultiEventCarousel({
  events,
  language,
  onCriticalMediaLoaded,
}: HeroMultiEventCarouselProps) {
  const [emblaRef, emblaApi] = useEmblaCarousel({
    loop: events.length > 1,
    align: "start",
  });
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [firstSlideReady, setFirstSlideReady] = useState(false);
  const firstSlideNotified = useRef(false);
  const [reduceMotion, setReduceMotion] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const apply = () => setReduceMotion(mq.matches);
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, []);

  useEffect(() => {
    firstSlideNotified.current = false;
    setFirstSlideReady(false);
  }, [events]);

  const notifyCriticalOnce = useCallback(() => {
    if (firstSlideNotified.current) return;
    firstSlideNotified.current = true;
    setFirstSlideReady(true);
    onCriticalMediaLoaded?.();
  }, [onCriticalMediaLoaded]);

  useEffect(() => {
    if (events.length === 0) {
      notifyCriticalOnce();
      return;
    }

    const t = setTimeout(() => {
      notifyCriticalOnce();
    }, 5000);

    if (firstSlideReady) {
      clearTimeout(t);
      return () => clearTimeout(t);
    }

    return () => clearTimeout(t);
  }, [events.length, firstSlideReady, notifyCriticalOnce]);

  const onFirstPosterSettled = useCallback(() => {
    notifyCriticalOnce();
  }, [notifyCriticalOnce]);

  useEffect(() => {
    if (!emblaApi) return;

    const onSelect = () => {
      setSelectedIndex(emblaApi.selectedScrollSnap());
    };
    onSelect();
    emblaApi.on("reInit", onSelect);
    emblaApi.on("select", onSelect);
    return () => {
      emblaApi.off("select", onSelect);
      emblaApi.off("reInit", onSelect);
    };
  }, [emblaApi]);

  useEffect(() => {
    if (!emblaApi || reduceMotion || events.length < 2) return;

    const id = window.setInterval(() => {
      emblaApi.scrollNext();
    }, AUTOPLAY_MS);

    return () => window.clearInterval(id);
  }, [emblaApi, reduceMotion, events.length]);

  const eventsKey = events.map((e) => e.id).join("|");
  useEffect(() => {
    if (!emblaApi) return;
    emblaApi.reInit({ loop: events.length > 1, align: "start" });
  }, [emblaApi, eventsKey, events.length]);

  return (
    <>
      <div className="absolute inset-0 z-0 h-full w-full overflow-hidden" ref={emblaRef}>
        <div className="flex h-full">
          {events.map((event, index) => {
            const slug = passPurchaseSlug(event);
            const poster = event.poster_url?.trim();
            return (
              <div
                key={event.id}
                className="min-w-0 shrink-0 grow-0 basis-full h-full"
              >
                <div className="relative h-full w-full min-h-0 bg-gradient-dark">
                  {poster ? (
                    <img
                      src={poster}
                      alt={event.name}
                      className="absolute inset-0 h-full w-full min-h-0 object-cover object-center"
                      loading={index === 0 ? "eager" : "lazy"}
                      fetchPriority={index === 0 ? "high" : "low"}
                      decoding="async"
                      onLoad={index === 0 ? onFirstPosterSettled : undefined}
                      onError={index === 0 ? onFirstPosterSettled : undefined}
                    />
                  ) : (
                    <div className="absolute inset-0 bg-gradient-dark" />
                  )}
                  {!poster && index === 0 ? (
                    <EffectOnce onRun={onFirstPosterSettled} />
                  ) : null}
                  <div
                    className="absolute inset-0 z-[1]"
                    style={{
                      background:
                        "linear-gradient(rgba(0,0,0,0.25), rgba(0,0,0,0.45))",
                    }}
                  />
                  <div className="absolute inset-0 z-[2] flex flex-col items-center justify-end pb-10 md:pb-14 px-4">
                    <Button
                      asChild
                      variant="default"
                      size="lg"
                      className="text-base sm:text-lg px-6 sm:px-8 py-3 sm:py-4 hover:scale-110 active:scale-95 transition-all duration-300 relative overflow-hidden group font-normal"
                      style={{
                        backgroundColor: "#E21836",
                        color: "#FFFFFF",
                        boxShadow: "0 0 30px rgba(226, 24, 54, 0.6)",
                        fontWeight: 400,
                      }}
                    >
                      <Link to={`/${slug}`}>
                        <span className="relative z-10 flex items-center justify-center">
                          <Calendar className="w-5 h-5 mr-2 transition-transform duration-300 group-hover:scale-110" />
                          {language === "en" ? "Book Now" : "Réserver un Pass"}
                        </span>
                      </Link>
                    </Button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {events.length > 1 ? (
        <div className="absolute bottom-3 md:bottom-4 left-1/2 z-20 flex -translate-x-1/2 gap-2">
          {events.map((e, i) => (
            <button
              key={e.id}
              type="button"
              aria-label={`Show event ${i + 1}`}
              onClick={() => emblaApi?.scrollTo(i)}
              className={cn(
                "h-3 w-3 rounded-full transition-all duration-300",
                i === selectedIndex
                  ? "scale-125 bg-primary"
                  : "bg-white/30 hover:bg-white/50"
              )}
            />
          ))}
        </div>
      ) : null}
    </>
  );
}

function EffectOnce({ onRun }: { onRun: () => void }) {
  const ran = useRef(false);
  useEffect(() => {
    if (ran.current) return;
    ran.current = true;
    onRun();
  }, [onRun]);
  return null;
}
