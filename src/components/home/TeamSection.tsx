import placeholder from '/public/placeholder.svg';

interface TeamSectionProps {
  language: 'en' | 'fr';
}

const TeamSection = ({ language }: TeamSectionProps) => {
  return (
    <section className="py-20 bg-gradient-dark">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-12">
          <h2 className="text-4xl font-orbitron font-bold mb-4 text-gradient-neon">Meet the Team</h2>
          <p className="text-lg text-muted-foreground">The people behind Andiamo Events</p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-8">
          <div className="bg-card rounded-xl shadow-lg p-6 flex flex-col items-center transition-all duration-300 hover:scale-105 hover:shadow-xl hover:bg-card/80 cursor-pointer group">
            <img src={placeholder} alt="Mouayed Chakir" className="w-28 h-28 rounded-full object-cover mb-4 border-4 border-primary/30 transition-all duration-300 group-hover:border-primary group-hover:scale-110" />
            <h3 className="font-bold text-xl text-primary transition-colors duration-300 hover:text-primary/80">Mouayed Chakir</h3>
            <p className="text-muted-foreground mb-2 transition-colors duration-300 group-hover:text-foreground/70">Co-Founder & CEO</p>
          </div>
          <div className="bg-card rounded-xl shadow-lg p-6 flex flex-col items-center transition-all duration-300 hover:scale-105 hover:shadow-xl hover:bg-card/80 cursor-pointer group">
            <img src={placeholder} alt="Sirine Chamli" className="w-28 h-28 rounded-full object-cover mb-4 border-4 border-primary/30 transition-all duration-300 group-hover:border-primary group-hover:scale-110" />
            <h3 className="font-bold text-xl text-primary transition-colors duration-300 hover:text-primary/80">Sirine Chamli</h3>
            <p className="text-muted-foreground mb-2 transition-colors duration-300 group-hover:text-foreground/70">CEO</p>
          </div>
          <div className="bg-card rounded-xl shadow-lg p-6 flex flex-col items-center transition-all duration-300 hover:scale-105 hover:shadow-xl hover:bg-card/80 cursor-pointer group">
            <img src={placeholder} alt="Mawadda" className="w-28 h-28 rounded-full object-cover mb-4 border-4 border-primary/30 transition-all duration-300 group-hover:border-primary group-hover:scale-110" />
            <h3 className="font-bold text-xl text-primary transition-colors duration-300 hover:text-primary/80">Mawadda</h3>
            <p className="text-muted-foreground mb-2 transition-colors duration-300 group-hover:text-foreground/70">Marketing Manager</p>
          </div>
          <div className="bg-card rounded-xl shadow-lg p-6 flex flex-col items-center transition-all duration-300 hover:scale-105 hover:shadow-xl hover:bg-card/80 cursor-pointer group">
            <img src={placeholder} alt="Malek Ben Amor" className="w-28 h-28 rounded-full object-cover mb-4 border-4 border-primary/30 transition-all duration-300 group-hover:border-primary group-hover:scale-110" />
            <h3 className="font-bold text-xl text-primary transition-colors duration-300 hover:text-primary/80">Malek Ben Amor</h3>
            <p className="text-muted-foreground mb-2 transition-colors duration-300 group-hover:text-foreground/70">Developer & Technical Lead</p>
          </div>
        </div>
      </div>
    </section>
  );
};

export default TeamSection; 