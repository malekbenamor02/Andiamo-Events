import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Instagram } from 'lucide-react';

interface TeamSectionProps {
  language: 'en' | 'fr';
}

const TeamSection = ({ language }: TeamSectionProps) => {
  const [team, setTeam] = useState([]);

  useEffect(() => {
    const fetchTeam = async () => {
      const { data, error } = await supabase
        .from('team_members')
        .select('*')
        .order('created_at', { ascending: true });
      if (!error && data) setTeam(data);
    };
    fetchTeam();
  }, []);

  return (
    <section className="py-20 bg-gradient-dark">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-12">
          <h2 className="text-4xl font-heading font-bold mb-4 text-gradient-neon">Meet the Team</h2>
          <p className="text-lg text-muted-foreground">The people behind Andiamo Events</p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-8">
          {team.map(member => (
            <div 
              key={member.id} 
              className="bg-card rounded-xl shadow-lg p-6 flex flex-col items-center transition-all duration-300 hover:scale-105 hover:shadow-xl hover:bg-card/80 cursor-pointer group"
            >
              <img src={member.photo_url || '/placeholder.svg'} alt={member.name} className="w-28 h-28 rounded-full object-cover mb-4 border-4 border-primary/30 transition-all duration-300 group-hover:border-primary group-hover:scale-110" />
              <h3 className="font-bold text-xl text-primary transition-colors duration-300 hover:text-primary/80">{member.name}</h3>
              <p className="text-muted-foreground mb-2 transition-colors duration-300 group-hover:text-foreground/70">{member.role}</p>
              {member.bio && <p className="text-xs text-muted-foreground mb-2 text-center">{member.bio}</p>}
              {member.social_url && (
                <a href={member.social_url} target="_blank" rel="noopener noreferrer" className="flex justify-center items-center text-primary hover:text-pink-500 mt-1">
                  <Instagram className="w-5 h-5" />
                </a>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default TeamSection; 