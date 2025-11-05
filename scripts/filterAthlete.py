import pandas as pd
import os

script_dir = os.path.dirname(os.path.abspath(__file__))
project_root = os.path.dirname(script_dir)

# Charger le fichier CSV
input_path = os.path.join(project_root, 'CSV_Source', 'athlete_events.csv')
print("Chemin du fichier source :", input_path)

df = pd.read_csv(input_path,sep=";")

# Charger le mapping IOC -> ISO des codes pays
mapping_path = os.path.join(project_root, 'CSV_Source', 'country_code_mapping.csv')
if os.path.exists(mapping_path):
    df_mapping = pd.read_csv(mapping_path)
    code_mapping = dict(zip(df_mapping['IOC_Code'], df_mapping['ISO_Code']))
    
    # Convertir les codes IOC en codes ISO
    df['NOC'] = df['NOC'].map(code_mapping).fillna(df['NOC'])
    
    # Afficher les statistiques de conversion
    unmapped_codes = df[~df['NOC'].isin(code_mapping.values())]['NOC'].unique()
    if len(unmapped_codes) > 0:
        print(f"⚠ Attention: {len(unmapped_codes)} codes n'ont pas pu être mappés:")
        print(f"  {', '.join(sorted(unmapped_codes)[:10])}")
    print(f"✓ Codes pays convertis de IOC vers ISO 3166-1 alpha-3")
else:
    print("⚠ Fichier de mapping non trouvé. Les codes IOC seront conservés.")

# Supprimer les colonnes inutiles
df = df.drop(columns=["Height", "Weight", "City","Age"])

# Filtrer les données pour ne garder que les années >= 1900 (cohérence avec les données de population)
df = df[df["Year"] >= 1900]

# Dédoublonner les médailles pour les épreuves d'équipe
# Problème : En relais ou sports d'équipe, chaque athlète a une ligne avec la même médaille
# Solution : Ne garder qu'une seule ligne par (Année, Pays, Épreuve, Médaille)
print("\n=== DÉDOUBLONNAGE DES MÉDAILLES ===")
medals_before = len(df[df['Medal'].notna()])

# Pour les lignes avec médailles, dédoublonner par (Year, NOC, Event, Medal)
df_with_medals = df[df['Medal'].notna()].copy()
df_without_medals = df[df['Medal'].isna()].copy()

# Dédoublonner en gardant une seule ligne par médaille d'équipe
df_medals_dedup = df_with_medals.drop_duplicates(subset=['Year', 'NOC', 'Event', 'Medal'], keep='first')

# Recombiner les données
df = pd.concat([df_medals_dedup, df_without_medals], ignore_index=True)

medals_after = len(df[df['Medal'].notna()])
reduction = medals_before - medals_after
print(f"Médailles AVANT dédoublonnage: {medals_before:,}")
print(f"Médailles APRÈS dédoublonnage: {medals_after:,}")
print(f"Réduction: {reduction:,} lignes ({reduction/medals_before*100:.1f}%)")
print(f"✓ Dédoublonnage terminé\n")

# Sauvegarder le nouveau CSV
output_path = os.path.join(project_root, 'CSV_Dest', 'athlete_events_opti.csv')
os.makedirs(os.path.dirname(output_path), exist_ok=True)
df.to_csv(output_path, sep=";", index=False)

print("Nouveau fichier optimisé créé :", output_path)
