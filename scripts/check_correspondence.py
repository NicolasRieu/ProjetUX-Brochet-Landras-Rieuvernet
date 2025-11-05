import pandas as pd
import os

script_dir = os.path.dirname(os.path.abspath(__file__))
project_root = os.path.dirname(script_dir)

print("=== VÉRIFICATION DE LA CORRESPONDANCE DES CODES PAYS ===\n")

# Charger les fichiers CSV optimisés
athlete_path = os.path.join(project_root, 'CSV_Dest', 'athlete_events_opti.csv')
population_path = os.path.join(project_root, 'CSV_Dest', 'population-1900-2016.csv')

# Vérifier si les fichiers optimisés existent
if not os.path.exists(athlete_path):
    print(f"⚠ Fichier {athlete_path} non trouvé.")
    print("Veuillez d'abord exécuter filterAthlete.py")
    exit(1)

if not os.path.exists(population_path):
    print(f"⚠ Fichier {population_path} non trouvé.")
    print("Veuillez d'abord exécuter filterCountriesPopulation.py")
    exit(1)

df_athlete = pd.read_csv(athlete_path, sep=';')
df_population = pd.read_csv(population_path)

print(f"✓ Fichiers chargés:")
print(f"  - Athletes: {athlete_path}")
print(f"  - Population: {population_path}\n")

# Obtenir les valeurs uniques des codes et noms de pays
noc_unique = set(df_athlete['NOC'].dropna().unique())
team_unique = set(df_athlete['Team'].dropna().unique())
code_unique = set(df_population['Code'].dropna().unique())
entity_unique = set(df_population['Entity'].dropna().unique())

print(f"=== STATISTIQUES ===")
print(f"Nombre de codes uniques dans athlete_events_opti (NOC): {len(noc_unique)}")
print(f"Nombre de pays uniques dans athlete_events_opti (Team): {len(team_unique)}")
print(f"Nombre de codes uniques dans population (Code): {len(code_unique)}")
print(f"Nombre de pays uniques dans population (Entity): {len(entity_unique)}")

# Vérifier la correspondance NOC -> Code
noc_in_code = noc_unique.intersection(code_unique)
noc_not_in_code = noc_unique - code_unique

print(f"\n=== CORRESPONDANCE NOC -> Code ===")
print(f"✓ NOC présents dans Code: {len(noc_in_code)} / {len(noc_unique)} ({len(noc_in_code)/len(noc_unique)*100:.1f}%)")
print(f"✗ NOC manquants dans Code: {len(noc_not_in_code)}")
if noc_not_in_code and len(noc_not_in_code) <= 30:
    print(f"\nNOC manquants:")
    for code in sorted(noc_not_in_code):
        team_name = df_athlete[df_athlete['NOC'] == code]['Team'].values[0]
        print(f"  - {code}: {team_name}")

# Vérifier la correspondance Team -> Entity
team_in_entity = team_unique.intersection(entity_unique)
team_not_in_entity = team_unique - entity_unique

print(f"\n=== CORRESPONDANCE Team -> Entity ===")
print(f"✓ Team présents dans Entity: {len(team_in_entity)} / {len(team_unique)} ({len(team_in_entity)/len(team_unique)*100:.1f}%)")
print(f"✗ Team manquants dans Entity: {len(team_not_in_entity)}")
if team_not_in_entity and len(team_not_in_entity) <= 30:
    print(f"\nTeam manquants:")
    for team in sorted(team_not_in_entity):
        noc = df_athlete[df_athlete['Team'] == team]['NOC'].values[0]
        print(f"  - {team} (code: {noc})")

# Vérifier pour chaque NOC s'il existe dans Code ou si le Team correspondant existe dans Entity
print(f"\n=== ANALYSE DÉTAILLÉE ===")
noc_team_mapping = df_athlete[['NOC', 'Team']].drop_duplicates()

found_in_code = 0
found_in_entity = 0
found_in_both = 0
found_in_none = 0

problematic_cases = []

for _, row in noc_team_mapping.iterrows():
    noc = row['NOC']
    team = row['Team']
    
    in_code = noc in code_unique
    in_entity = team in entity_unique
    
    if in_code and in_entity:
        found_in_both += 1
    elif in_code:
        found_in_code += 1
    elif in_entity:
        found_in_entity += 1
    else:
        found_in_none += 1
        problematic_cases.append((noc, team))

print(f"✓ Correspondances trouvées dans Code ET Entity: {found_in_both}")
print(f"◐ Correspondances trouvées SEULEMENT dans Code: {found_in_code}")
print(f"◐ Correspondances trouvées SEULEMENT dans Entity: {found_in_entity}")
print(f"✗ Correspondances trouvées dans AUCUN: {found_in_none}")

if problematic_cases:
    print(f"\n=== CAS PROBLÉMATIQUES (NOC/Team non trouvés dans les données de population) ===")
    print(f"Ces pays historiques ou équipes spéciales n'ont pas de données de population:")
    for noc, team in sorted(problematic_cases)[:30]:
        print(f"  - NOC: {noc:5s} | Team: {team}")

# Statistiques finales
total_mappings = len(noc_team_mapping)
successful_mappings = found_in_both + found_in_code + found_in_entity
success_rate = (successful_mappings / total_mappings * 100) if total_mappings > 0 else 0

print(f"\n=== RÉSULTAT FINAL ===")
print(f"Taux de correspondance global: {success_rate:.1f}% ({successful_mappings}/{total_mappings})")
if success_rate >= 90:
    print("✓ Excellent! La grande majorité des codes pays sont alignés.")
elif success_rate >= 75:
    print("◐ Bon résultat, mais quelques codes nécessitent une attention.")
else:
    print("✗ Attention: de nombreux codes ne correspondent pas.")
