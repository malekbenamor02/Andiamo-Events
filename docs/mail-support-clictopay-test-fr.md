# Mail au support ClicToPay / SMT — Environnement de test

**Objet :** Environnement de test — écarts par rapport à la grille SMT (Tests de passage en production)

---

Madame, Monsieur,

Nous avons intégré ClicToPay (Société Monétique Tunisie) pour le paiement en ligne sur notre plateforme et nous effectuons les tests conformément à la grille « Tests de passage en production ».

Nous constatons les écarts suivants dans l’environnement de test et souhaitions les porter à votre connaissance afin de confirmer le comportement attendu et, le cas échéant, la mise en conformité du bac à sable :

1. **CVV2 incorrecte (test 0009)**  
   **Attendu :** Non Autorisée.  
   **Constaté :** Paiement approuvé (orderStatus = 2, errorCode = 0, paymentState = DEPOSITED).  
   Merci de confirmer si la validation CVV2 est bien activée en test et doit entraîner un refus.

2. **Validité incorrecte**  
   **Attendu :** Non Autorisée (avec les informations appropriées).  
   **Constaté :** Paiement décliné (Declined), mais **sans identifiant d’autorisation** renvoyé dans la réponse.  
   Merci de confirmer si un identifiant d’autorisation (ou équivalent) doit être fourni même en cas de refus pour le suivi et le support.

3. **Solde insuffisant**  
   **Attendu :** Non Autorisée.  
   **Constaté :** Paiement décliné (Declined), mais **sans identifiant d’autorisation** dans la réponse.  
   Même question que ci-dessus : un ID d’autorisation est-il prévu en cas de déclination pour ces cas ?

4. **Plafond atteint (test 0004)**  
   **Attendu :** Non Autorisée.  
   **Constaté :** Paiement approuvé (orderStatus = 2, errorCode = 0).  
   Merci de confirmer si le contrôle du plafond est actif en test et doit conduire à un refus.

Nous nous basons sur l’API getOrderStatusExtended (ou getOrderStatus) pour confirmer le statut du paiement côté back-office et marquer la commande en conséquence. Un alignement du bac à sable sur le comportement de la grille SMT nous permettrait de valider correctement notre intégration avant le passage en production.

Nous restons à votre disposition pour toute précision ou pour fournir des exemples de requêtes/réponses si nécessaire.

Cordialement,

[Votre nom]  
[Votre fonction]  
[Nom de la société / plateforme]  
[Coordonnées / e-mail]
