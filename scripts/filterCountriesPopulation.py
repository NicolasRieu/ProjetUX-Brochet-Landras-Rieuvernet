import pandas as pd
import os

# Remonter au dossier parent (racine du projet)
script_dir = os.path.dirname(os.path.abspath(__file__))
project_root = os.path.dirname(script_dir)

# Charger le fichier CSV
input_path = os.path.join(project_root, 'CSV_Source', 'population-long-run-with-projections.csv')
df = pd.read_csv(input_path)

# Supprimer la colonne "Population (projections)" si elle existe
if 'Population (projections)' in df.columns:
    df = df.drop(columns=['Population (projections)'])

# Filtrer les années entre 1900 et 2016 inclus et garder uniquement les lignes avec un Code non null
df_filtered = df[(df['Year'] >= 1900) & (df['Year'] <= 2016) & (df['Code'].notna())]

# Supprimer les entitées sans code pays
df_filtered = df_filtered[df_filtered['Code'].notna()]

# Supprimer l'entité "World"
df_filtered = df_filtered[df_filtered['Entity'] != 'World']


# Sauvegarder le résultat dans un nouveau fichier
output_path = os.path.join(project_root, 'CSV_Dest', 'population-1900-2016.csv')
os.makedirs(os.path.dirname(output_path), exist_ok=True)
df_filtered.to_csv(output_path, index=False)

print(f"Filtrage terminé : {len(df_filtered):,} lignes écrites dans {output_path}")