# A3 Pilot — Maquette interactive

Maquette responsive du futur outil de pilotage opérationnel du Groupe A3.

## Objectif

Le produit suit chaque **repère / ouvrage** et non uniquement le chantier. Chaque typologie instancie automatiquement son workflow, ses phases, ses contrôles et ses interventions.

## Écrans inclus

- Pilotage opérationnel
- Affaires
- Repères en vue Kanban
- Planning des équipes
- Interventions et aperçu mobile terrain
- Typologies et workflows
- Documents
- Fiche repère dans un panneau latéral
- Création rapide simulée

## Démonstration

La maquette est prévue pour être publiée sur GitHub Pages :

https://julien59470.github.io/a3-pilot-maquette/

## Lancer localement

Aucune dépendance ni compilation n’est nécessaire.

```bash
python3 -m http.server 8080
```

Puis ouvrir `http://localhost:8080`.

## Déploiement GitHub Pages

Le workflow `.github/workflows/deploy-pages.yml` publie automatiquement la branche `main` à chaque modification.

## Statut

Maquette UI/UX uniquement. Les données, formulaires et synchronisations sont simulés côté navigateur.
