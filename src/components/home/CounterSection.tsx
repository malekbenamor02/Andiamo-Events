import { useCallback, useEffect, useState } from 'react';

interface CounterSectionProps {
  language: 'en' | 'fr';
}

const TARGET_COUNTS = { events: 20, members: 40, followers: 65000 };

const CounterSection = ({ language }: CounterSectionProps) => {
  const [counters, setCounters] = useState({ events: 0, members: 0, followers: 0 });
  const [hasAnimated, setHasAnimated] = useState(false);

  const animateCounters = useCallback(() => {
    const duration = 4000;
    const steps = 60;
    const stepDuration = duration / steps;
    let step = 0;

    const timer = setInterval(() => {
      step++;
      const progress = step / steps;
      setCounters({
        events: Math.floor(TARGET_COUNTS.events * progress),
        members: Math.floor(TARGET_COUNTS.members * progress),
        followers: Math.floor(TARGET_COUNTS.followers * progress),
      });

      if (step >= steps) {
        clearInterval(timer);
        setCounters(TARGET_COUNTS);
      }
    }, stepDuration);
  }, []);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting && !hasAnimated) {
            setHasAnimated(true);
            animateCounters();
          }
        });
      },
      { threshold: 0.5 }
    );
    const counterSection = document.getElementById('counter-section');
    if (counterSection) observer.observe(counterSection);
    return () => observer.disconnect();
  }, [animateCounters, hasAnimated]);

  return (
    <section id="counter-section" className="bg-gradient-dark py-16 md:py-20">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mb-10 text-center md:mb-12">
          <h2 className="mb-3 font-heading text-3xl font-bold uppercase tracking-wide text-foreground md:text-4xl">
            {language === 'en' ? 'Our Impact' : 'Notre Impact'}
          </h2>
          <p className="mx-auto max-w-2xl text-base uppercase tracking-wide text-muted-foreground md:text-lg">
            {language === 'en'
              ? 'Join thousands of party-goers across Tunisia'
              : 'Rejoignez des milliers de fêtards à travers la Tunisie'}
          </p>
        </div>

        <div className="grid grid-cols-1 gap-10 md:grid-cols-3 md:gap-8">
          <div className="text-center">
            <div className="font-heading text-5xl font-bold tabular-nums text-primary md:text-6xl">
              {counters.events.toLocaleString()}+
            </div>
            <p className="mt-2 text-lg text-muted-foreground md:text-xl">
              {language === 'en' ? 'Events' : 'Événements'}
            </p>
          </div>
          <div className="text-center">
            <div className="font-heading text-5xl font-bold tabular-nums text-primary md:text-6xl">
              {counters.members.toLocaleString()}+
            </div>
            <p className="mt-2 text-lg text-muted-foreground md:text-xl">
              {language === 'en' ? 'Members' : 'Membres'}
            </p>
          </div>
          <div className="text-center">
            <div className="font-heading text-5xl font-bold tabular-nums text-primary md:text-6xl">
              {counters.followers.toLocaleString()}+
            </div>
            <p className="mt-2 text-lg text-muted-foreground md:text-xl">
              {language === 'en' ? 'Followers' : 'Abonnés'}
            </p>
          </div>
        </div>
      </div>
    </section>
  );
};

export default CounterSection;
