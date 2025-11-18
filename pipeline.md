# Pipeline de Transformation des Données

**Objectif :** Transformer les données brutes olympiques et démographiques pour analyser la corrélation entre population, participation et médailles (1900-2016).

## Transformation 1 : Harmonisation des Codes Pays
**Script :** `create_country_mapping.py`

| Dataset | Pays | Code | Problème |
|---------|------|------|----------|
| athlete_events.csv | Germany | `GER` | Code IOC |
| population-*.csv | Germany | `DEU` | Code ISO |
| **Résultat** | ❌ Impossible de croiser les données | |

### Avant → Après

| IOC Code | ISO Code | Type | Exemple |
|----------|----------|------|---------|
| `GER` | `DEU` | Pays actuel | Allemagne |
| `NED` | `NLD` | Pays actuel | Pays-Bas |
| `SUI` | `CHE` | Pays actuel | Suisse |
| `URS` | `RUS` | Historique | URSS → Russie |
| `TCH` | `CZE` | Historique | Tchécoslovaquie → Rép. Tchèque |
| `YUG` | `SRB` | Historique | Yougoslavie → Serbie |

**Résultat :** ~200 correspondances | Taux de conversion : 97%

---

## Transformation 2 : Nettoyage des Données Athlètes
**Script :** `filterAthlete.py`

### A. Conversion des codes pays

| Avant | Après |
|-------|-------|
| `FRA` (IOC) | `FRA` (ISO) ✓ identique |
| `GER` (IOC) | `DEU` (ISO) ✓ converti |
| `URS` (IOC) | `RUS` (ISO) ✓ converti |

### B. Suppression des colonnes inutiles

| Colonnes | Avant | Après | Justification |
|----------|-------|-------|---------------|
| Supprimées | `Height`, `Weight`, `City`, `Age` | - | Non pertinentes pour l'analyse |
| Conservées | - | `ID`, `Name`, `Sex`, `Team`, `NOC`, `Year`, `Season`, `Sport`, `Event`, `Medal` | Essentielles |

### C. Dédoublonnage des médailles

#### Exemple concret : Relais 4x100m France 2008

| Avant (données brutes) | Après (dédoublonné) |
|------------------------|---------------------|
| Athlète 1, FRA, 2008, 4x100m, Gold | **1 ligne** : FRA, 2008, 4x100m, Gold |
| Athlète 2, FRA, 2008, 4x100m, Gold | (3 doublons supprimés) |
| Athlète 3, FRA, 2008, 4x100m, Gold | |
| Athlète 4, FRA, 2008, 4x100m, Gold | |
| **Problème : 4 médailles comptées** | **Résultat : 1 médaille** ✓ |

#### Impact global

| Métrique | Avant | Après | Réduction |
|----------|-------|-------|-----------|
| Lignes avec médailles | 39,640 | 18,785 | **-52.6%** |
| Doublons éliminés | - | 20,855 | |

**Clé de déduplication :** `(Year, NOC, Event, Medal)`

---

## Transformation 3 : Nettoyage des Données de Population
**Script :** `filterCountriesPopulation.py`

### A. Filtrage temporel et géographique

| Critère | Avant | Après |
|---------|-------|-------|
| Période | Antiquité → 2100 | 1900-2016 |
| Entité "World" | ✓ Présente | ❌ Supprimée |
| Entités sans code ISO | ✓ Présentes | ❌ Supprimées |

### B. Enrichissement continental

| Entity | Code | Year | Population | Continent (ajouté) |
|--------|------|------|------------|-------------------|
| France | FRA | 2008 | 64,374,000 | Europe |
| China | CHN | 2008 | 1,324,655,000 | Asia |
| Brazil | BRA | 2008 | 191,972,000 | Americas |
| Kenya | KEN | 2008 | 38,763,000 | Africa |
| Australia | AUS | 2008 | 21,249,000 | Oceania |

**Résultat :** 117 années × ~200 pays avec continent

---

## Transformation 4 : Fusion et Calcul des Métriques
**Module :** `front/utils/operations.js` (JavaScript côté client)

### Processus de fusion (INNER JOIN)

#### Exemple : France aux JO 2008 Summer

| Source | Données |
|--------|---------|
| `athlete_events_opti.csv` | 323 athlètes, 43 médailles (7 or, 16 argent, 20 bronze) |
| `population-1900-2016.csv` | 64,374,000 habitants, continent: Europe |
| **Résultat fusionné** | ✓ Toutes les données combinées |

#### Exemple complet de données fusionnées

| noc | countryName | participants | medals | gold | silver | bronze | population | continent |
|-----|-------------|--------------|--------|------|--------|--------|-----------|-----------|
| FRA | France | 323 | 43 | 7 | 16 | 20 | 64,374,000 | Europe |
| CHN | China | 639 | 100 | 51 | 21 | 28 | 1,324,655,000 | Asia |
| USA | United States | 596 | 110 | 36 | 38 | 36 | 304,093,966 | Americas |
| KEN | Kenya | 38 | 14 | 6 | 4 | 4 | 38,763,000 | Africa |
| AUS | Australia | 433 | 46 | 14 | 15 | 17 | 21,249,000 | Oceania |

### Agrégations appliquées

| Métrique | Méthode | Exemple (France 2008) |
|----------|---------|----------------------|
| **Participants** | Comptage `ID` uniques | 323 athlètes |
| **Médailles** | Total par type | 43 (7+16+20) |
| **Population** | Récupération année | 64,374,000 |
| **Continent** | Jointure via code | Europe |

---

## Métriques Calculées pour les Visualisations

### Exemples de calculs (JO 2008 Summer)

| Pays | Médailles | Population | Participants | Médailles/Million | Médailles/Athlète | Athlètes/Million |
|------|-----------|------------|--------------|-------------------|-------------------|------------------|
| **France** | 43 | 64,374,000 | 323 | **0.67** | **0.133** (13.3%) | **5.02** |
| **Jamaica** | 11 | 2,701,000 | 59 | **4.07** | **0.186** (18.6%) | **21.84** |
| **USA** | 110 | 304,093,966 | 596 | **0.36** | **0.184** (18.4%) | **1.96** |
| **Kenya** | 14 | 38,763,000 | 38 | **0.36** | **0.368** (36.8%) | **0.98** |

### Formules

| Métrique | Formule | Usage |
|----------|---------|-------|
| **Médailles/Million** | `(medals / population) × 1,000,000` | Carte choroplèth |
| **Médailles/Athlète** | `medals / participants` | Rose de Nightingale |
| **Athlètes/Million** | `(participants / population) × 1,000,000` | Graphique à bulles |

### Interprétation

**Jamaica 2008 :** 4.07 médailles/million → Performance exceptionnelle relative à sa population  
**Kenya 2008 :** 36.8% athlètes médaillés → Efficacité maximale (meilleure sélection)