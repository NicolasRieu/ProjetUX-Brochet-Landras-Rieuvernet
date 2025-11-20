# Pipeline de Transformation des Données

## Transformation 1 : Harmonisation des Codes Pays
**Script :** `create_country_mapping.py`

| Dataset | Pays | Code | Problème |
|---------|------|------|----------|
| athlete_events.csv | Germany | `GER` | Code IOC |
| population-*.csv | Germany | `DEU` | Code ISO |
| **Résultat** | ❌ Impossible de croiser les données | |

### Avant → Après

| IOC Code | ISO Code | Exemple |
|----------|----------|---------|
| `GER` | `DEU` | Allemagne |
| `URS` | `RUS` | URSS → Russie |

---

## Transformation 2 : Nettoyage des Données Athlètes
**Script :** `filterAthlete.py`

### Dédoublonnage des médailles

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

### Filtrage temporel et géographique

| Critère | Avant | Après |
|---------|-------|-------|
| Période | Antiquité → 2100 | 1900-2016 |

---