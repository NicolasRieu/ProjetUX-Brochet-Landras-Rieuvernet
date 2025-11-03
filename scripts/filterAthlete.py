import pandas as pd
import os

script_dir = os.path.dirname(os.path.abspath(__file__))
project_root = os.path.dirname(script_dir)

# Charger le fichier CSV
input_path = os.path.join(project_root, 'CSV_Source', 'athlete_events.csv')
print("Chemin du fichier source :", input_path)

df = pd.read_csv(input_path,sep=";")

# Supprimer les colonnes inutiles
df = df.drop(columns=["Height", "Weight", "City","Age"])

# Filtrer les données pour ne garder que les années >= 1900 (cohérence avec les données de population)
df = df[df["Year"] >= 1900]

# Sauvegarder le nouveau CSV
output_path = os.path.join(project_root, 'CSV_Dest', 'athlete_events_opti.csv')
os.makedirs(os.path.dirname(output_path), exist_ok=True)
df.to_csv(output_path, sep=";", index=False)

print("Nouveau fichier optimisé créé :", output_path)
