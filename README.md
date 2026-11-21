# Données publiques Kinara / AppInvest

Ce dépôt contient uniquement des informations publiques sur les sociétés et les collecteurs associés. Il ne reçoit pas de profil utilisateur, liste de favorites, notes, journal ou calendrier personnel. L’ordre de collecte repose sur l’ancienneté des tentatives dans le catalogue mondial.

- `biotech-data.json` : données publiques et communiqués existants.
- `discovery-data.json` : catalogue et données boursières datées ; sources et couverture variables.
- `kinara-evidence-index.json` et `evidence-dossiers/` : dossiers indépendants, identité, période, provenance et contrôles SHA-256.
- `extra-news.json` : titres et liens des sources officielles supplémentaires ; aucune conclusion clinique automatique. Si un flux américain est inaccessible, les dépôts SEC sont proposés en secours avec le libellé explicite « Dépôt SEC » et leur date de dépôt, sans les confondre avec des communiqués.

Le lot initial comprend 772 cotations du catalogue, 718 dossiers documentaires et 70 titres/liens supplémentaires. Ces nombres décrivent une couverture partielle : ils ne constituent pas un score de risque ni une preuve de complétude.

Le workflow `Actualiser AppInvest` est prévu du lundi au vendredi à 23 h 17, fuseau `Europe/Paris`. GitHub peut retarder les départs. Il est aussi lançable manuellement et se teste quand sa configuration change. Les données boursières, documentaires et les sources d’actualités supplémentaires sont validées séparément avant publication ; un lot incohérent n’écrase pas le lot public valide précédent.

Les anciennes valeurs datées restent conservées lorsque des sources échouent. Les rapports financiers locaux hors SEC, les clauses de dette, les droits économiques et l’attribution complète des programmes nécessitent encore des vérifications documentaires. Aucun score, pondération ni recommandation d’investissement n’est généré.

## Compléments financiers et consensus

Les bilans annuels sont acceptés lorsque le fournisseur ne propose pas de colonne TTM, avec des dates de cash et de flux distinctes si nécessaire. Les pages KOSDAQ sont utilisées pour les cotations correspondantes. `finance-bridge.cjs` réutilise les observations officielles en conservant les composantes des calculs, leurs devises et périodes : flux annuel publié, TTM exact ou période partielle non extrapolée. Les fonds restreints sont distincts des ressources libres.

`analystConsensus` contient des objectifs complémentaires seulement pour des actions ordinaires américaines avec cotation et données en USD confirmées. Les ADR et devises ambiguës sont exclus. Le nombre d’analystes et la date de publication restent inconnus si le fournisseur ne les précise pas ; aucun chiffre ni date de couverture n’est inventé. Ce champ est séparé de `forecast` pour préserver les anciens clients. Aucun score de risque n’est calculé.
