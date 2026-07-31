# A3 Pilot — Maquette interactive locale

Maquette UI/UX responsive du futur outil de pilotage opérationnel du Groupe A3.

## Principe métier

A3 Pilot suit chaque **repère / ouvrage** plutôt qu'un simple statut global de chantier. Chaque typologie applique son workflow, ses phases, ses contrôles, ses blocages et ses interventions.

## Fonctionnalités de la maquette

- tableau de bord opérationnel et indicateurs calculés ;
- gestion complète des affaires, repères, interventions, workflows et documents ;
- création, modification, duplication et suppression avec confirmations ;
- fiche repère détaillée avec phases, historique, notes, blocages et interventions ;
- Kanban avec déplacement des repères par glisser-déposer ;
- planning hebdomadaire avec déplacement des interventions ;
- démarrage et clôture d'interventions avec check-lists ;
- notifications et recherche globale avec raccourci `Ctrl/Cmd + K` ;
- filtres, tris, vues et changement de société ;
- thème clair ou sombre et préférences d'affichage ;
- exports CSV, sauvegarde JSON, import JSON et restauration des données initiales ;
- PWA installable et coque hors connexion ;
- préparation fonctionnelle d'une future connexion Dolibarr.

## Persistance locale

Toutes les modifications sont enregistrées dans le `localStorage` du navigateur sous la clé :

```text
a3pilot.maquette.v4
```

Les données restent donc disponibles après fermeture ou actualisation de la page sur le même navigateur. La maquette ne contient aucun backend et n'envoie aucune donnée à un serveur.

## Responsive et accessibilité

L'interface est conçue pour ordinateur, tablette et mobile :

- navigation latérale sur grand écran ;
- navigation basse et panneaux plein écran sur mobile ;
- tableaux et plannings adaptés sans débordement global ;
- modales fermables par bouton croix, clic extérieur ou touche `Échap` ;
- icônes SVG cohérentes, sans emojis ni caractères dépendants des polices système ;
- libellés et attributs accessibles sur les actions principales.

## Lancer localement

Aucune installation ni compilation n'est nécessaire.

```bash
python3 -m http.server 8080
```

Puis ouvrir `http://localhost:8080`.

## Déploiement GitHub Pages

Le workflow `.github/workflows/deploy-pages.yml` publie automatiquement la branche `main` avec GitHub Actions. Dans le dépôt, la source GitHub Pages doit être réglée sur **GitHub Actions**.

Adresse prévue :

```text
https://julien59470.github.io/a3-pilot-maquette/
```

## Statut

Cette version est une maquette front autonome. Les actions sont réellement fonctionnelles dans le navigateur, mais les données demeurent fictives et locales.
