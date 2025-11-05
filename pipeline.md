# Pipeline de données —

## 1. Ingestion des données
- **Sources utilisées :**
  Nous avons utilisé un dataset JO complet comme point de départ. Afin de répondre à notre problématique, nous avons sélectionné uniquement certaines colonnes pertinentes (Id, Team, NOC, Year, Medal, Season). Les autres colonnes non nécessaires ont été supprimées pour simplifier le pipeline.
    - Dataset JO : `Id, Sex, Team, NOC, Year, Medal, Sport, Event, Season`  
    - Dataset Population : `NOC, Year, #NbreHabitant`
  
  
  Fichier utilisé:
    - "athlete_events.csv"
    - "population-long-run-with-projections.csv"

- **Action :** importer les fichiers bruts dans `CSV_Dest`.
Pour ce faire nous utiliserons 
```
charger("athlete_events_opti.csv")
charger("population-1900-2016.csv")
```

---

## 2. Validation
- Vérifier que toutes les colonnes nécessaires sont présentes.
- Vérifier la cohérence des types (Year = entier, Medal = texte, Population = entier).
- Identifier les valeurs manquantes.
- **Vérifier la correspondance des codes pays** entre les datasets athlètes et population.

```
si colonnes manquantes → signaler
si valeurs aberrantes → signaler

# Validation des codes pays
nb_codes_correspondants = vérifier_mapping(athlete_NOC, population_Code)
si taux_correspondance < 90% → signaler

produire rapport("validation_report")
```

---

## 3. Nettoyage
- Supprimer les doublons.
- **Harmoniser les codes pays (`NOC`)** : Conversion des codes IOC (Comité International Olympique) vers les codes ISO 3166-1 alpha-3 pour assurer la cohérence entre les datasets.
  - Création d'un mapping automatique IOC → ISO (ex: `ALG` → `DZA` pour l'Algérie, `URS` → `RUS` pour l'URSS)
  - 72 mappings manuels + 130 mappings automatiques = 202 codes convertis
  - Taux de correspondance : **96.9%** des pays alignés (amélioration continue)
  - Vérification de la correspondance entre les deux datasets
  - Pays historiques mappés vers leurs successeurs (URSS → Russie)
- **Dédoublonner les médailles des épreuves d'équipe** : En relais et sports d'équipe, chaque athlète avait une ligne avec la même médaille. Une seule médaille est maintenant comptabilisée par (Année, Pays, Épreuve, Type de médaille).
  - Réduction : 20,855 lignes de médailles en double supprimées (52.6%)
  - De 39,640 à 18,785 médailles uniques
- Gérer les populations manquantes.

```
supprimer_doublons(données)

# Harmonisation des codes pays
créer_mapping_pays()  # Génère country_code_mapping.csv
convertir_codes(IOC → ISO)  # Applique le mapping aux données athlètes
vérifier_correspondance()  # Valide l'alignement des codes

# Dédoublonnage des médailles d'équipe
dédoublonner_médailles(Year, NOC, Event, Medal)  # Group by pour n'avoir qu'une médaille par épreuve

harmoniser(NOC, population)
```

**Scripts associés :**
- `create_country_mapping.py` : Création du mapping IOC → ISO
- `filterAthlete.py` : Application du mapping, filtrage et dédoublonnage des médailles
- `check_correspondence.py` : Vérification de la correspondance

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


