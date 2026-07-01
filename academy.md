1. Contexte et objectif
Andiamo Event organise une formation professionnelle certifiee en Event Management en juillet 2025. La
formation accueille 36 participants repartis en 3 classes de 12 personnes, avec 3 formules tarifaires
distinctes.
L'objectif de ce developpement est de creer une page d'inscription et un systeme de paiement integralement
lies au domaine andiamoevent.com, permettant aux participants de s'inscrire, choisir leur formule et effectuer
leur paiement en ligne.

2. Structure de la page /academy
La page doit etre composee des sections suivantes, dans cet ordre :

Section 1 — Hero / Accroche
• Titre : Formation Event Management — Certifiee & Presentielle
• Sous-titre : Juillet 2025 | 20 Heures | 36 places limitees
• Badges visuels : Certifiee / Presentielle / Tunis
• Photo ou visuel du formateur Mouayed (en cours)
• logo AndiamoAcademy png (en cours)
• Bouton CTA principal : Je m'inscris maintenant (lien ancre vers formulaire)
• Compteur de places restantes (dynamique, par formule)

Section 2 — Les 3 formules (cartes comparatives)
• 3 cartes cote a cote (ou empilees sur mobile) : Essentielle / Pro / Premium
• Prix mis en avant : 9000 DT / 1 100 DT / 2 500 DT
• Liste des inclus par formule (voir tableau comparatif en Section 4 du doc formation)
• Bouton 'Choisir cette formule' sur chaque carte — pre-remplit le formulaire
• Formule Pro mise en avant avec badge 'Recommandee'

Section 3 — Programme et chapitres
• 7 chapitres
• Recapitulatif : 3 jours actifs (6h/j) + 1 journee de cloture (2h) = 20h
• Formateur : Mouayed — CEO Andiamo Event & W9yet Event — +20 evenements


Section 6 — FAQ et mentions
• Regle stricte : aucun enregistrement video ou photo pendant la formation
• Politique d'annulation et remboursement
• Contact : page Andiamo Event sur Instagram / email / 24508245


3. Formulaire d'inscription — Specifications

Champs obligatoires
Champ Type Obligatoire Validation
Prenom text Oui Min 2 caracteres
Nom text Oui Min 2 caracteres
Email email Oui Format email valide
Telephone tel Oui

8 chiffres TN
minimum

Formule choisie select Oui

Essentielle / Pro /
Premium
Mode de paiement radio Oui RIB ou D17
Code promo / club text Non

Optionnel — remise
clubs

Acceptation reglement checkbox Oui Must be checked

Comportement du formulaire
1. Quand participant clique sur 'Choisir Formule X' dans Section 2, le champ formule est pre-rempli
2. Le montant de l'acompte (100%) s'affiche dynamiquement selon la formule selectionnee
3. Apres soumission : verification places disponibles cote serveur
4. Si place dispo : enregistrement en BDD + statut 'En attente paiement'
5. Affichage page de confirmation avec instructions de paiement (D17 ou RIB)
6. Envoi email de confirmation automatique (voir Section 5)
7. Si plus de place : message d'erreur + proposition liste d'attente



6. Tableau de bord administrateur
new tab in super admin dashboard only with the name Academy

Fonctionnalites requises

Fonctionnalite Priorite Detail
Liste des inscrits Haute

Nom / Email / Formule / Statut /
Date

Compteur places Haute

Restant par formule (12 max
chacune)

Validation paiement Haute

Bouton 'Valider' -> declenche
email confirmation

Visualisation preuve paiement Haute

Voir la capture D17 ou bordereau
RIB uploade

Export CSV inscrits Moyenne

Export liste emargement + statuts
paiement

Gestion codes promo clubs Moyenne

Creer/desactiver codes + voir
utilisations

Envoi email manuel Basse

Envoyer un email personnalise a
un inscrit

Liste d'attente Basse

Inscrits une fois les 12 places
atteintes

Statuts de suivi inscrit

Statut Signification
En attente paiement Formulaire soumis, aucun paiement recu
Preuve recue Capture / bordereau uploade, en attente validation admin
Acompte confirme Admin a valide l'acompte 100%, place reservee
Solde recu Paiement complet, participant confirme
Annule Inscription annulee, place remise en disponibilite
Liste d'attente Formule pleine, inscrit en file d'attente




