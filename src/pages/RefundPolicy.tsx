interface RefundPolicyProps {
  language: 'en' | 'fr';
}

const RefundPolicy = ({ language }: RefundPolicyProps) => {
  return (
    <div className="pt-16 min-h-screen bg-background">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="prose prose-lg max-w-none">
          <h1 className="text-4xl md:text-5xl font-heading font-bold text-gradient-neon mb-8">
            📄 PAGE 2 — REFUND & CANCELLATION POLICY
          </h1>
          <p className="text-muted-foreground mb-8">(/refund-policy)</p>

          <div className="mb-12">
            <h2 className="text-3xl font-semibold text-primary mb-6">🇫🇷 POLITIQUE DE REMBOURSEMENT & ANNULATION</h2>

            <div className="space-y-6 text-foreground/80 leading-relaxed">
              <div>
                <h3 className="text-xl font-semibold text-primary mb-2">9. Politique de remboursement</h3>
                <p>Sauf mention contraire explicite, les billets ne sont ni échangeables ni remboursables, y compris en cas :</p>
                <ul className="list-disc pl-6 space-y-2">
                  <li>d'empêchement personnel,</li>
                  <li>de retard,</li>
                  <li>d'absence le jour de l'événement.</li>
                </ul>
                <p>Toute contestation de paiement initiée auprès de la banque ou du prestataire de paiement sans contact préalable avec l'Organisateur pourra entraîner le refus de la demande.</p>
              </div>

              <div>
                <h3 className="text-xl font-semibold text-primary mb-2">10. Annulation ou report d'événement</h3>
                <p>En cas d'annulation ou de report d'un événement par l'Organisateur, les modalités applicables (remboursement, report ou avoir) seront communiquées par les canaux officiels d'Andiamo Events.</p>
                <p>Aucun frais annexe (transport, hébergement, restauration ou autres) ne pourra être réclamé à l'Organisateur.</p>
              </div>
            </div>
          </div>

          <div className="mb-12">
            <h2 className="text-3xl font-semibold text-primary mb-6">🇬🇧 REFUND & CANCELLATION POLICY</h2>

            <div className="space-y-6 text-foreground/80 leading-relaxed">
              <div>
                <h3 className="text-xl font-semibold text-primary mb-2">9. Refund Policy</h3>
                <p>Unless explicitly stated otherwise, tickets are neither exchangeable nor refundable, including in cases of:</p>
                <ul className="list-disc pl-6 space-y-2">
                  <li>personal inability to attend,</li>
                  <li>lateness,</li>
                  <li>absence on the day of the event.</li>
                </ul>
                <p>Any payment dispute initiated with the bank or the payment service provider without prior contact with the Organizer may result in refusal of the request.</p>
              </div>

              <div>
                <h3 className="text-xl font-semibold text-primary mb-2">10. Event Cancellation or Postponement</h3>
                <p>In the event of cancellation or postponement of an event by the Organizer, the applicable terms (refund, postponement, or credit) will be communicated through Andiamo Events' official channels.</p>
                <p>No additional expenses (transportation, accommodation, catering, or others) may be claimed from the Organizer.</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default RefundPolicy;
