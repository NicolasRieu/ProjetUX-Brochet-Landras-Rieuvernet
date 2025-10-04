# Pipeline de données —

## 1. Ingestion des données
- **Sources utilisées :**
  Nous avons utilisé un dataset JO complet comme point de départ. Afin de répondre à notre problématique, nous avons sélectionné uniquement certaines colonnes pertinentes (Id, Team, NOC, Year, Medal, Season). Les autres colonnes non nécessaires ont été supprimées pour simplifier le pipeline.
    - Dataset JO : `Id, Sex, Team, NOC, Year, Medal, Sport, Event, Season`  
    - Dataset Population : `NOC, Year, #NbreHabitant`
- **Action :** importer les fichiers bruts dans `CSV_Dest`.

```
charger("athlete_events.csv")
charger("population-1900-2016.csv")
```

---

## 2. Validation
- Vérifier que toutes les colonnes nécessaires sont présentes.
- Vérifier la cohérence des types (Year = entier, Medal = texte, Population = entier).
- Identifier les valeurs manquantes.


```
si colonnes manquantes → signaler
si valeurs aberrantes → signaler
produire rapport("validation_report")
```

---

## 3. Nettoyage
- Supprimer les doublons.
- Harmoniser les codes pays (`NOC`) avec le dataset population.
- Gérer les populations manquantes.

```
supprimer_doublons(données)
harmoniser(NOC, population)
```

---

## 4. Transformation / Calculs
- Calculer le nombre de participations par pays et par année :
```
nb_participations = compter(Athletes par NOC et Year)
```
- Calculer le nombre de médailles par pays et par année :
```
nb_medals = compter(Medal différent de None par NOC et Year)
```
- Calculer les ratios :
```
ratio_medals_participation = nb_medals / nb_participations
ratio_medals_population    = nb_medals / #NbreHabitant
```

---

## 5. Techniques de visualisations
Préparer les sorties adaptées aux visualisations D3.js :
- Graphique à bulles
- Map
- Rose de Nightingale

---


