import { GraduationCap } from 'lucide-react';
import type { AcademyLanguage } from '@/types/academy';

interface AcademyPageDisabledProps {
  language: AcademyLanguage;
  message: string;
}

export default function AcademyPageDisabled({ language, message }: AcademyPageDisabledProps) {
  const title =
    language === 'en' ? 'Registrations temporarily closed' : 'Inscriptions temporairement fermées';

  return (
    <div className="min-h-[60vh] flex items-center justify-center px-4 py-16">
      <div className="max-w-lg w-full text-center rounded-2xl border border-border/60 bg-card/80 backdrop-blur-sm p-10 shadow-lg">
        <GraduationCap className="w-14 h-14 text-primary mx-auto mb-6 opacity-90" aria-hidden />
        <h1 className="text-2xl font-heading font-bold text-foreground mb-4">{title}</h1>
        <p className="text-muted-foreground whitespace-pre-line leading-relaxed">{message}</p>
      </div>
    </div>
  );
}
