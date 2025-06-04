Présentation du Projet : Application de Facturation pour Thérapeutes
# 1. Objectif Principal
L'objectif de ce projet est de fournir une application web simple et efficace pour les thérapeutes afin de gérer leurs clients, leurs tarifs, leurs séances, et de générer des devis et des factures de manière automatisée. L'application vise à simplifier les tâches administratives et à offrir une meilleure organisation du suivi des paiements.

# 2. Fonctionnalités Clés
L'application s'articule autour de plusieurs modules principaux :

## 2.1. Gestion des Clients
Ajouter, modifier et supprimer des fiches clients.

Enregistrer les informations client : nom, prénom, téléphone, email, adresse, ville, notes.

Associer un tarif par défaut à un client.

Gérer le statut du client (actif/inactif).

Filtrer et rechercher des clients.

## 2.2. Gestion des Tarifs
Ajouter, modifier et supprimer des types de tarifs (libellé et montant).

Ces tarifs sont ensuite utilisés pour les séances et la facturation.

## 2.3. Gestion des Séances
Planifier de nouvelles séances en associant un client, une date/heure, et un type de tarif.

Le montant de la séance est automatiquement calculé à partir du tarif sélectionné.

Modifier les détails d'une séance (avant facturation).

Gérer le statut de la séance : "À Payer", "Payée", "Annulée".

Enregistrer les informations de paiement (mode et date de paiement) pour les séances payées.

Filtrer les séances par client, statut, et plage de dates.

Modification rapide du statut et des informations de paiement directement depuis le tableau des séances (via double-clic).

## 2.4. Génération de Devis
Nouveau : Pour les séances planifiées dans le futur, possibilité de générer un devis.

Un numéro de devis unique (ex: DEV-AAAA-XXXX) est attribué.

Le devis est sauvegardé au format JSON dans un répertoire dédié (public/Devis/).

Le lien vers le devis (consultable via invoice.html) est affiché dans le tableau des séances.

Possibilité d'envoyer le devis par email au client (avec le PDF en pièce jointe).

Un devis est automatiquement annulé (son numéro est retiré de la séance) si une facture est générée pour la même séance.

## 2.5. Génération de Factures
Générer une facture pour une séance passée ou présente qui n'a pas encore été facturée.

Un numéro de facture unique (ex: FAC-AAAA-XXXX) est attribué.

La facture est sauvegardée au format JSON dans un répertoire dédié (public/Facts/).

Le lien vers la facture (consultable via invoice.html) est affiché dans le tableau des séances.

Possibilité d'envoyer la facture par email au client (avec le PDF en pièce jointe).

Le statut de la séance est mis à jour (généralement "À Payer") lors de la génération de la facture.

## 2.6. Visualisation des Devis et Factures
Une page HTML unique (invoice.html) permet de visualiser les devis et les factures en fonction du numéro passé en paramètre d'URL.

La page adapte son contenu (titres, libellés) pour afficher correctement un devis ou une facture.

Un filigrane (ex: "DEVIS", "PAYÉE", "À PAYER") est affiché en fonction du type de document et du statut de la séance associée.

## 2.7. Tableau de Bord
Affichage de chiffres clés : nombre total de clients, nombre total de séances, nombre de séances payées.

Calcul et affichage du chiffre d'affaires pour le mois précédent, le mois en cours, l'année précédente et l'année en cours (basé sur les séances payées).

Graphique d'évolution du nombre de séances (payées, à payer, annulées) et du montant payé, avec possibilité d'agréger par jour, semaine, mois, trimestre ou année.

## 2.8. Configuration de l'Application
Permet de configurer les informations du thérapeute/gestionnaire (nom, titre, adresse, contact, etc.).

Définir le taux de TVA applicable (si nécessaire).

Renseigner les informations légales (SIRET, APE, ADELI, IBAN, BIC).

Personnaliser les mentions légales apparaissant sur les factures (mention TVA, conditions de paiement, assurance RCP).

# 3. Technologies Utilisées
Frontend :

HTML5

CSS3 (fichier main.css pour le style général)

JavaScript (ES6+) : Logique applicative client dans main.js.

D3.js (v7) : Utilisé pour la génération des graphiques du tableau de bord.

Backend :

Node.js : Environnement d'exécution JavaScript côté serveur.

Express.js : Framework web minimaliste pour Node.js, utilisé pour créer l'API REST.

Stockage des Données :

Fichiers plats :

.tsv (Tab-Separated Values) pour les listes de clients, tarifs, et séances (dans le répertoire data/).

.json pour les paramètres de configuration (data/settings.json).

.json pour les données de chaque facture générée (dans public/Facts/).

.json pour les données de chaque devis généré (dans public/Devis/).

Envoi d'Emails :

Nodemailer : Module Node.js pour l'envoi d'emails (utilisé pour envoyer les devis et factures).

Nécessite une configuration SMTP (variables d'environnement GMAIL_USER, GMAIL_APP_PASSWORD).

Génération de PDF (pour les emails) :

Puppeteer : Bibliothèque Node.js pour contrôler Chrome/Chromium en mode headless. Utilisée pour convertir le HTML du devis/facture en PDF.

L'installation de Puppeteer est optionnelle ; si non détectée, la génération de PDF est désactivée.

# 4. Structure des Données (Simplifiée)
clients.tsv: id, nom, prenom, telephone, email, adresse, ville, notes, defaultTarifId, statut, dateCreation

tarifs.tsv: id, libelle, montant

seances.tsv: id_seance, id_client, date_heure_seance, id_tarif, montant_facture, statut_seance, mode_paiement, date_paiement, invoice_number, devis_number

settings.json: Structure JSON contenant les informations du manager, le taux de TVA, et les mentions légales.

Fichiers Devis/Facture JSON (ex: DEV-2024-0001.json, FAC-2024-0001.json): Contiennent toutes les données nécessaires pour afficher le document (informations du client, du manager, lignes de service, totaux, mentions légales, etc.).

# 5. Architecture Générale
Interface Utilisateur (Frontend) :

index.html : Structure principale de l'application single-page.

main.css : Styles de l'application.

main.js : Gère toute la logique côté client, les interactions DOM, les appels API, et le rendu dynamique des vues (Clients, Tarifs, Séances, Tableau de Bord, Configuration).

Serveur (Backend) :

server.js : Définit les routes de l'API REST pour les opérations CRUD (Create, Read, Update, Delete) sur les clients, tarifs, et séances. Il gère également la génération des numéros de devis/facture, la création des fichiers JSON correspondants, la lecture/écriture des fichiers de données TSV, et l'envoi des emails avec PDF.

Prévisualisation des Documents :

invoice.html : Page HTML dynamique capable d'afficher un devis ou une facture en chargeant les données depuis un fichier JSON (spécifié par le paramètre invoiceNumber ou devisNumber dans l'URL).