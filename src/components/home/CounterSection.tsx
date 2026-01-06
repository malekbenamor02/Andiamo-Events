import { useState, useEffect } from 'react';

interface CounterSectionProps {
  language: 'en' | 'fr';
}

const CounterSection = ({ language }: CounterSectionProps) => {
  const [counters, setCounters] = useState({ events: 0, members: 0, followers: 0 });
  const [hasAnimated, setHasAnimated] = useState(false);
  const targetCounts = { events: 20, members: 40, followers: 45000 };

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
  }, [hasAnimated]);

  const animateCounters = () => {
    const duration = 4000; // 2 seconds in milliseconds
    const steps = 60;
    const stepDuration = duration / steps;
    let step = 0;
    const timer = setInterval(() => {
      step++;
      const progress = step / steps;
      setCounters({
        events: Math.floor(targetCounts.events * progress),
        members: Math.floor(targetCounts.members * progress),
        followers: Math.floor(targetCounts.followers * progress)
      });
      if (step >= steps) {
        clearInterval(timer);
        setCounters(targetCounts);
      }
    }, stepDuration);
  };

  return (
    <section id="counter-section" className="py-20 bg-gradient-dark">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-12">
          <h2 className="text-4xl font-heading font-black mb-4 text-white uppercase">
            {language === 'en' ? 'Our Impact' : 'Notre Impact'}
          </h2>
          <p className="text-xl text-white/80 uppercase">
            {language === 'en'
              ? 'Join thousands of party-goers across Tunisia'
              : 'Rejoignez des milliers de fêtards à travers la Tunisie'}
          </p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <div className="text-center">
            <div className="text-5xl md:text-6xl font-heading font-bold text-primary mb-2">
              {counters.events.toLocaleString()}+
            </div>
            <p className="text-xl text-white/80">
              {language === 'en' ? 'Events' : 'Événements'}
            </p>
          </div>
          <div className="text-center">
            <div className="text-5xl md:text-6xl font-heading font-bold text-primary mb-2">
              {counters.members.toLocaleString()}+
            </div>
            <p className="text-xl text-white/80">
              {language === 'en' ? 'Members' : 'Membres'}
            </p>
          </div>
          <div className="text-center">
            <div className="text-5xl md:text-6xl font-heading font-bold text-primary mb-2">
              {counters.followers.toLocaleString()}+
            </div>
            <p className="text-xl text-white/80">
              {language === 'en' ? 'Followers' : 'Abonnés'}
            </p>
          </div>
        </div>
      </div>
    </section>
  );
};

export default CounterSection; 