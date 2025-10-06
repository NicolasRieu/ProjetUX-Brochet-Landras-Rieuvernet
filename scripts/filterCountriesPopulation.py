import pandas as pd
import os

# Remonter au dossier parent (racine du projet)
script_dir = os.path.dirname(os.path.abspath(__file__))
project_root = os.path.dirname(script_dir)

# Charger le fichier CSV de population
input_path = os.path.join(project_root, 'CSV_Source', 'population-long-run-with-projections.csv')
df = pd.read_csv(input_path)

# Charger le fichier CSV des continents
continents_path = os.path.join(project_root, 'CSV_Source', 'continents.csv')
df_continents = pd.read_csv(continents_path)

# Supprimer la colonne "Population (projections)" si elle existe
if 'Population (projections)' in df.columns:
    df = df.drop(columns=['Population (projections)'])

# Filtrer les années entre 1900 et 2016 inclus et garder uniquement les lignes avec un Code non null
df_filtered = df[(df['Year'] >= 1900) & (df['Year'] <= 2016) & (df['Code'].notna())]

# Supprimer les entitées sans code pays
df_filtered = df_filtered[df_filtered['Code'].notna()]

# Supprimer l'entité "World"
df_filtered = df_filtered[df_filtered['Entity'] != 'World']

# Créer un dictionnaire de mapping entre Code pays et Continent
# Utiliser uniquement les colonnes nécessaires du fichier continents
continents_mapping = df_continents[['alpha-3', 'region']].copy()
continents_mapping.columns = ['Code', 'Continent']

# Fusionner les données de population avec les continents
df_filtered = df_filtered.merge(continents_mapping, on='Code', how='left')

# Sauvegarder le résultat dans un nouveau fichier
output_path = os.path.join(project_root, 'CSV_Dest', 'population-1900-2016.csv')
os.makedirs(os.path.dirname(output_path), exist_ok=True)
df_filtered.to_csv(output_path, index=False)

print(f"Filtrage terminé : {len(df_filtered):,} lignes écrites dans {output_path}")