interface TermsProps {
  language: 'en' | 'fr';
}

const Terms = ({ language }: TermsProps) => {
  return (
    <div className="pt-16 min-h-screen bg-background">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="prose prose-lg max-w-none">
          <h1 className="text-4xl md:text-5xl font-heading font-bold text-gradient-neon mb-8">
            📄 PAGE 1 — TERMS OF SERVICE
          </h1>
          <p className="text-muted-foreground mb-8">(/terms)</p>

          <div className="mb-12">
            <h2 className="text-3xl font-semibold text-primary mb-6">🇫🇷 CONDITIONS GÉNÉRALES DE VENTE (CGV)</h2>
            <p className="text-lg font-semibold mb-4">Andiamo Events</p>

            <div className="space-y-6 text-foreground/80 leading-relaxed">
              <div>
                <h3 className="text-xl font-semibold text-primary mb-2">1. Organisation</h3>
                <p>Les événements proposés sur le site Andiamo Events sont organisés par Born To Lead (BTL), ci-après dénommé « l'Organisateur ».</p>
                <p>📧 Contact : contact@andiamoevents.com</p>
              </div>

              <div>
                <h3 className="text-xl font-semibold text-primary mb-2">2. Objet</h3>
                <p>Les présentes Conditions Générales de Vente (CGV) ont pour objet de définir les conditions de vente, de paiement et d'utilisation des billets et services proposés par Andiamo Events via son site web et ses canaux officiels.</p>
                <p>Toute commande implique l'acceptation pleine, entière et sans réserve des présentes CGV.</p>
              </div>

              <div>
                <h3 className="text-xl font-semibold text-primary mb-2">3. Produits et services</h3>
                <p>Andiamo Events propose principalement :</p>
                <ul className="list-disc pl-6 space-y-2">
                  <li>des billets d'accès à des événements culturels, artistiques ou festifs,</li>
                  <li>des pass ou accès spécifiques selon les événements,</li>
                  <li>des services liés à l'organisation des événements.</li>
                </ul>
                <p>Les informations essentielles (date, lieu, horaires, conditions d'accès) sont précisées pour chaque événement.</p>
              </div>

              <div>
                <h3 className="text-xl font-semibold text-primary mb-2">4. Prix</h3>
                <p>Les prix sont indiqués en dinar tunisien (TND), toutes taxes comprises, sauf indication contraire.</p>
                <p>L'Organisateur se réserve le droit de modifier les prix à tout moment. Le prix facturé est celui en vigueur au moment de la validation de la commande.</p>
              </div>

              <div>
                <h3 className="text-xl font-semibold text-primary mb-2">5. Commande</h3>
                <p>La commande est considérée comme définitive dès validation du paiement.</p>
                <p>Le client est responsable de l'exactitude des informations fournies, notamment de l'adresse email utilisée pour la réception du billet électronique.</p>
              </div>

              <div>
                <h3 className="text-xl font-semibold text-primary mb-2">6. Paiement</h3>
                <p>Le paiement s'effectue en ligne via les moyens de paiement proposés sur le site, notamment par l'intermédiaire d'un prestataire de services de paiement agréé.</p>
                <p>Toute commande non réglée intégralement ne sera ni confirmée ni traitée.</p>
              </div>

              <div>
                <h3 className="text-xl font-semibold text-primary mb-2">7. Rôle du prestataire de paiement</h3>
                <p>Les paiements sont traités par un prestataire de services de paiement tiers, notamment Flouci, agissant exclusivement en qualité d'intermédiaire technique.</p>
                <p>Le prestataire de paiement n'intervient en aucun cas dans l'organisation, la gestion, la livraison ou le déroulement des événements.</p>
                <p>Toute réclamation, contestation ou demande de remboursement liée à un événement ou à un billet doit être adressée directement à l'Organisateur.</p>
                <p>La responsabilité du prestataire de paiement ne saurait être engagée en cas d'annulation, de report, de modification ou de litige lié à l'événement.</p>
              </div>

              <div>
                <h3 className="text-xl font-semibold text-primary mb-2">8. Billets électroniques et QR Code (accès obligatoire)</h3>
                <p>L'accès aux événements Andiamo Events est strictement conditionné à la présentation d'un QR code valide.</p>
                <p>Après confirmation du paiement, un billet électronique contenant un QR code unique est envoyé par email à l'adresse communiquée lors de la commande.</p>
                <p>Même en cas de remise d'un billet physique, un QR code est systématiquement envoyé par email et constitue la référence principale et obligatoire pour le contrôle d'accès.</p>
                <p>Le QR code peut être présenté :</p>
                <ul className="list-disc pl-6 space-y-2">
                  <li>sur un support numérique (téléphone, tablette),</li>
                  <li>ou sous forme imprimée.</li>
                </ul>
                <p>⚠️ L'absence de QR code valide, même en possession d'un billet physique, peut entraîner un refus d'accès sans remboursement.</p>
                <p>Chaque QR code est personnel, unique et valable pour une seule entrée.</p>
                <p>Toute tentative de duplication, de fraude ou de revente entraînera l'invalidation immédiate du billet.</p>
              </div>

              <div>
                <h3 className="text-xl font-semibold text-primary mb-2">11. Accès et comportement</h3>
                <p>L'Organisateur se réserve le droit de refuser l'accès ou d'exclure toute personne dont le comportement est jugé :</p>
                <ul className="list-disc pl-6 space-y-2">
                  <li>dangereux,</li>
                  <li>inapproprié,</li>
                  <li>contraire aux règles de sécurité ou au bon déroulement de l'événement.</li>
                </ul>
                <p>Toute exclusion se fait sans remboursement.</p>
              </div>

              <div>
                <h3 className="text-xl font-semibold text-primary mb-2">12. Responsabilité</h3>
                <p>L'Organisateur décline toute responsabilité en cas :</p>
                <ul className="list-disc pl-6 space-y-2">
                  <li>de perte, vol ou détérioration d'effets personnels,</li>
                  <li>d'incident causé par le participant,</li>
                  <li>de force majeure ou de décisions administratives indépendantes de sa volonté.</li>
                </ul>
              </div>

              <div>
                <h3 className="text-xl font-semibold text-primary mb-2">14. Propriété intellectuelle</h3>
                <p>L'ensemble des contenus présents sur le site Andiamo Events (textes, visuels, logos, vidéos, concepts) est la propriété exclusive de l'Organisateur.</p>
                <p>Toute reproduction ou utilisation sans autorisation préalable est strictement interdite.</p>
              </div>

              <div>
                <h3 className="text-xl font-semibold text-primary mb-2">15. Droit applicable</h3>
                <p>Les présentes Conditions Générales de Vente sont soumises au droit tunisien.</p>
                <p>À défaut de résolution amiable, tout litige sera soumis aux juridictions compétentes en Tunisie.</p>
              </div>

              <div>
                <h3 className="text-xl font-semibold text-primary mb-2">16. Acceptation des CGV</h3>
                <p>La validation de la commande vaut acceptation pleine et entière des présentes Conditions Générales de Vente.</p>
              </div>
            </div>
          </div>

          <div className="mb-12">
            <h2 className="text-3xl font-semibold text-primary mb-6">🇬🇧 TERMS OF SERVICE</h2>
            <p className="text-lg font-semibold mb-4">Andiamo Events</p>

            <div className="space-y-6 text-foreground/80 leading-relaxed">
              <div>
                <h3 className="text-xl font-semibold text-primary mb-2">1. Organization</h3>
                <p>The events offered on the Andiamo Events website are organized by Born To Lead (BTL), hereinafter referred to as "the Organizer".</p>
                <p>📧 Contact: contact@andiamoevents.com</p>
              </div>

              <div>
                <h3 className="text-xl font-semibold text-primary mb-2">2. Purpose</h3>
                <p>These General Terms and Conditions of Sale (GTCS) are intended to define the conditions of sale, payment and use of tickets and services offered by Andiamo Events via its website and official channels.</p>
                <p>Any order implies full, complete and unreserved acceptance of these GTCS.</p>
              </div>

              <div>
                <h3 className="text-xl font-semibold text-primary mb-2">3. Products and services</h3>
                <p>Andiamo Events mainly offers:</p>
                <ul className="list-disc pl-6 space-y-2">
                  <li>tickets for access to cultural, artistic or festive events,</li>
                  <li>passes or specific access according to events,</li>
                  <li>services related to event organization.</li>
                </ul>
                <p>Essential information (date, location, times, access conditions) is specified for each event.</p>
              </div>

              <div>
                <h3 className="text-xl font-semibold text-primary mb-2">4. Price</h3>
                <p>Prices are indicated in Tunisian dinars (TND), all taxes included, unless otherwise stated.</p>
                <p>The Organizer reserves the right to modify prices at any time. The price charged is that in effect at the time of order validation.</p>
              </div>

              <div>
                <h3 className="text-xl font-semibold text-primary mb-2">5. Order</h3>
                <p>The order is considered final upon payment validation.</p>
                <p>The customer is responsible for the accuracy of the information provided, in particular the email address used to receive the electronic ticket.</p>
              </div>

              <div>
                <h3 className="text-xl font-semibold text-primary mb-2">6. Payment</h3>
                <p>Payment is made online via the payment methods offered on the site, in particular through an approved payment service provider.</p>
                <p>Any order not paid in full will not be confirmed or processed.</p>
              </div>

              <div>
                <h3 className="text-xl font-semibold text-primary mb-2">7. Role of the payment provider</h3>
                <p>Payments are processed by a third-party payment service provider, including Flouci, acting exclusively as a technical intermediary.</p>
                <p>The payment provider does not intervene in any way in the organization, management, delivery or conduct of events.</p>
                <p>Any complaint, dispute or refund request related to an event or ticket must be addressed directly to the Organizer.</p>
                <p>The payment provider cannot be held liable in the event of cancellation, postponement, modification or dispute related to the event.</p>
              </div>

              <div>
                <h3 className="text-xl font-semibold text-primary mb-2">8. Electronic tickets and QR Code (mandatory access)</h3>
                <p>Access to Andiamo Events events is strictly conditional on the presentation of a valid QR code.</p>
                <p>After payment confirmation, an electronic ticket containing a unique QR code is sent by email to the address provided when ordering.</p>
                <p>Even in the case of delivery of a physical ticket, a QR code is systematically sent by email and constitutes the main and mandatory reference for access control.</p>
                <p>The QR code can be presented:</p>
                <ul className="list-disc pl-6 space-y-2">
                  <li>on a digital medium (phone, tablet),</li>
                  <li>or in printed form.</li>
                </ul>
                <p>⚠️ The absence of a valid QR code, even if in possession of a physical ticket, may result in refusal of access without refund.</p>
                <p>Each QR code is personal, unique and valid for a single entry.</p>
                <p>Any attempt at duplication, fraud or resale will result in immediate ticket invalidation.</p>
              </div>

              <div>
                <h3 className="text-xl font-semibold text-primary mb-2">11. Access and behavior</h3>
                <p>The Organizer reserves the right to refuse access or exclude any person whose behavior is deemed:</p>
                <ul className="list-disc pl-6 space-y-2">
                  <li>dangerous,</li>
                  <li>inappropriate,</li>
                  <li>contrary to safety rules or the proper conduct of the event.</li>
                </ul>
                <p>Any exclusion is made without refund.</p>
              </div>

              <div>
                <h3 className="text-xl font-semibold text-primary mb-2">12. Liability</h3>
                <p>The Organizer disclaims all liability in the event of:</p>
                <ul className="list-disc pl-6 space-y-2">
                  <li>loss, theft or deterioration of personal effects,</li>
                  <li>incident caused by the participant,</li>
                  <li>force majeure or administrative decisions independent of its will.</li>
                </ul>
              </div>

              <div>
                <h3 className="text-xl font-semibold text-primary mb-2">14. Intellectual property</h3>
                <p>All content on the Andiamo Events website (texts, visuals, logos, videos, concepts) is the exclusive property of the Organizer.</p>
                <p>Any reproduction or use without prior authorization is strictly prohibited.</p>
              </div>

              <div>
                <h3 className="text-xl font-semibold text-primary mb-2">15. Applicable law</h3>
                <p>These General Terms and Conditions of Sale are subject to Tunisian law.</p>
                <p>In the absence of an amicable resolution, any dispute will be submitted to the competent courts in Tunisia.</p>
              </div>

              <div>
                <h3 className="text-xl font-semibold text-primary mb-2">16. Acceptance of GTCS</h3>
                <p>Order validation constitutes full and complete acceptance of these General Terms and Conditions of Sale.</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Terms;
