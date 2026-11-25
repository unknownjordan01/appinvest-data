# Kinara — complément qualitatif du corpus clinique
Date de vérification : 25 novembre 2026.

Ce lot contient 20 lectures de résultats sur 14 médicaments, 18 observations antérieures et 32 documents primaires consultés. Il ajoute une couche documentaire et des candidats d'apprentissage avec caractéristiques partielles. Aucun modèle n'a été entraîné. Aucune probabilité, aucun score et aucune mise à jour de l'application ne sont installés.

## Contenu
- `qualitative-corpus-2026-11-25.json` : données, provenance, antécédents, mesures, décisions et limites.
- `qualitative-corpus.schema.json` : schéma de structure.
- `validation-report.json` : contrôles réellement exécutés et contrôles non exécutés.
- `validate-corpus.mjs` : validateur structurel et temporel réutilisable avec Node.
- Ce fichier README.

## Changement méthodologique explicite
Le noyau strict existant doit rester intact. Ce complément autorise les caractéristiques manquantes et qualifie les signaux antérieurs à partir de documents primaires datés. Le moment de prédiction est avant l'annonce étudiée, et peut être après le début de l'essai. Ce choix correspond à l'usage d'un prochain résultat dans Kinara. Il ne remplace pas un protocole de prédiction strictement avant le début de l'essai.

Une donnée inconnue n'est ni zéro ni un mauvais résultat. L'absence du protocole complet ou de données individuelles n'exclut pas automatiquement une annonce documentaire. Les documents bruts et leurs versions historiques ne sont pas archivés dans ce lot.

## Séparation des faits et des interprétations
Le label d'atteinte du critère principal reprend la déclaration explicite du promoteur à la date de l'annonce. Le signal qualitatif est une interprétation de lecture, non une confirmation indépendante. Un échec du critère principal peut coexister avec un signal secondaire favorable. Une analyse de sensibilité positive ne remplace pas une analyse principale négative. Une décision réglementaire n'est pas imputée à partir des résultats cliniques.

Pour Prescient, la revue de dose reste intermédiaire : ce cas est conservé et exclu de la cible binaire finale. Le rapport de février 2026 est conservé en documentation, mais exclu des entrées prédictives tant que sa date de mise en ligne publique n'est pas établie indépendamment.

## Signaux précédents
Chaque cas dispose d'antécédents reliés : étude ouverte, résultat contrôlé isolé, confirmation sur un autre essai, résultat non significatif ou signal post hoc. Les résultats chiffrés extraits gardent leur population et leur durée. Deux communications sur une même cohorte ne sont pas deux confirmations indépendantes. Les formulations, indications et acquéreurs d'une même molécule doivent rester regroupés pendant l'évaluation.

## Bilan des critères principaux à ces lectures
9 atteints, 10 non atteints, 1 résultat final encore en attente. Ces nombres ne sont pas un taux de réussite représentatif. Le lot est une sélection documentaire de cas connus.

| Essai | Date | Critère principal |
| --- | --- | --- |
| Prescient Therapeutics — PTX-100-02-2024 | 2026-11-25 | Conclusion finale en attente |
| Amylyx Pharmaceuticals — PHOENIX | 2024-03-08 | Non atteint |
| Athira Pharma — LIFT-AD | 2024-09-03 | Non atteint |
| Cassava Sciences — ReThink-ALZ | 2024-11-25 | Non atteint |
| Karuna Therapeutics — EMERGENT-2 | 2022-08-08 | Atteint |
| Karuna Therapeutics — EMERGENT-3 | 2023-03-20 | Atteint |
| AbbVie — EMPOWER-1 | 2024-11-11 | Non atteint |
| AbbVie — EMPOWER-2 | 2024-11-11 | Non atteint |
| Apellis Pharmaceuticals — OAKS | 2021-09-09 | Atteint |
| Apellis Pharmaceuticals — DERBY | 2021-09-09 | Non atteint |
| Axsome Therapeutics — ADVANCE-2 | 2024-12-30 | Non atteint |
| Axsome Therapeutics — ACCORD-2 | 2024-12-30 | Atteint |
| Madrigal Pharmaceuticals — MAESTRO-NASH week 52 | 2022-12-19 | Atteint |
| Viking Therapeutics — VENTURE | 2024-02-27 | Atteint |
| Acelyrin — Izokibep HS Part B | 2023-09-11 | Non atteint |
| Intercept Pharmaceuticals — REGENERATE month 18 interim | 2019-02-19 | Atteint |
| Sanofi — HERCULES | 2024-09-02 | Atteint |
| Sanofi — GEMINI 1 | 2024-09-02 | Non atteint |
| Sanofi — GEMINI 2 | 2024-09-02 | Non atteint |
| AbbVie — TEMPO-1 | 2024-09-26 | Atteint |

## Protection contre l'information future
Seules les observations antérieures autorisées dans `prediction_input_snapshot` peuvent devenir des entrées. Le résultat cible, la décision de développement et la comparaison après résultats sont exclus. Le design extrait du communiqué de résultats reste documentaire tant qu'une source antérieure ne l'a pas confirmé. Des annonces publiées le même jour ne servent pas d'antécédents l'une pour l'autre sans horaire vérifié.

Les réactions boursières restent absentes de l'entraînement dans ce lot. Il faut collecter les cours de référence, les fenêtres temporelles et les annonces concomitantes avant de leur attribuer un label exploitable.

## Vérifications
Contrôles structurels et temporels exécutés dans le moteur JavaScript de travail. Ils vérifient références, dates antérieures, labels, doublons internes et exclusion du résultat intermédiaire de la cible finale. Quatre tests de rejet ont aussi été exécutés. Le rapport indique séparément ce qui n'a pas été testé.
Le fichier Node reprend le validateur. Son lancement sur Node/Windows n'a pas été exécuté dans cette session.

## Limite sur le corpus antérieur et reprise
Le dernier ZIP `Kinara-corpus-clinique-Capricor-Duchenne.zip` n'a pas pu être ouvert : environnement de fichiers indisponible et lecture de l'archive sans contenu textuel. Impossible de confirmer le nombre de dossiers incomplets déjà conservés ou le nombre d'essais réellement nouveaux. Ce complément n'écrase pas et ne prétend pas fusionner cette archive.

La reprise doit ouvrir cette archive, lire ses décisions, rapprocher les clés molécule/essai/lecture/date et fusionner les annotations sans perdre les exclusions ni leurs motifs. Il faut ensuite compléter les entrées antérieures au résultat et évaluer les candidats sur des familles et périodes réservées. Aucun entraînement automatique n'est activé.
