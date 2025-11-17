import pandas as pd
import os

# Remonter au dossier parent (racine du projet)
script_dir = os.path.dirname(os.path.abspath(__file__))
project_root = os.path.dirname(script_dir)

# Charger les fichiers sources
athlete_path = os.path.join(project_root, 'CSV_Source', 'athlete_events.csv')
population_path = os.path.join(project_root, 'CSV_Source', 'population-long-run-with-projections.csv')
continents_path = os.path.join(project_root, 'CSV_Source', 'continents.csv')

df_athletes = pd.read_csv(athlete_path, sep=";")
df_population = pd.read_csv(population_path)
df_continents = pd.read_csv(continents_path)

# Extraire les pays uniques de chaque dataset
athletes_countries = df_athletes[['Team', 'NOC']].drop_duplicates()
population_countries = df_population[['Entity', 'Code']].drop_duplicates()
population_countries = population_countries[population_countries['Code'].notna()]

# Créer les mappings manuels pour les codes IOC -> ISO 3166-1 alpha-3
# Ces codes diffèrent entre les standards olympiques et ISO
ioc_to_iso_mapping = {
    # IOC Code -> ISO Code
    'ALG': 'DZA',  # Algeria
    'ARG': 'ARG',  # Argentina (même code)
    'AUS': 'AUS',  # Australia (même code)
    'AUT': 'AUT',  # Austria (même code)
    'BEL': 'BEL',  # Belgium (même code)
    'BRA': 'BRA',  # Brazil (même code)
    'BUL': 'BGR',  # Bulgaria
    'CAN': 'CAN',  # Canada (même code)
    'CHI': 'CHL',  # Chile
    'CHN': 'CHN',  # China (même code)
    'COL': 'COL',  # Colombia (même code)
    'CRO': 'HRV',  # Croatia
    'CUB': 'CUB',  # Cuba (même code)
    'CZE': 'CZE',  # Czech Republic (même code)
    'DEN': 'DNK',  # Denmark
    'EGY': 'EGY',  # Egypt (même code)
    'ESP': 'ESP',  # Spain (même code)
    'EST': 'EST',  # Estonia (même code)
    'FIN': 'FIN',  # Finland (même code)
    'FRA': 'FRA',  # France (même code)
    'GBR': 'GBR',  # Great Britain (même code)
    'GER': 'DEU',  # Germany
    'GRE': 'GRC',  # Greece
    'HUN': 'HUN',  # Hungary (même code)
    'INA': 'IDN',  # Indonesia
    'IND': 'IND',  # India (même code)
    'IRI': 'IRN',  # Iran
    'IRL': 'IRL',  # Ireland (même code)
    'ISR': 'ISR',  # Israel (même code)
    'ITA': 'ITA',  # Italy (même code)
    'JAM': 'JAM',  # Jamaica (même code)
    'JPN': 'JPN',  # Japan (même code)
    'KAZ': 'KAZ',  # Kazakhstan (même code)
    'KEN': 'KEN',  # Kenya (même code)
    'KOR': 'KOR',  # South Korea (même code)
    'KSA': 'SAU',  # Saudi Arabia
    'LAT': 'LVA',  # Latvia
    'LTU': 'LTU',  # Lithuania (même code)
    'MEX': 'MEX',  # Mexico (même code)
    'MAS': 'MYS',  # Malaysia
    'MAR': 'MAR',  # Morocco (même code)
    'NED': 'NLD',  # Netherlands
    'NOR': 'NOR',  # Norway (même code)
    'NZL': 'NZL',  # New Zealand (même code)
    'PAK': 'PAK',  # Pakistan (même code)
    'PER': 'PER',  # Peru (même code)
    'PHI': 'PHL',  # Philippines
    'POL': 'POL',  # Poland (même code)
    'POR': 'PRT',  # Portugal
    'ROU': 'ROU',  # Romania (même code)
    'RSA': 'ZAF',  # South Africa
    'RUS': 'RUS',  # Russia (même code)
    'SEN': 'SEN',  # Senegal (même code)
    'SIN': 'SGP',  # Singapore
    'SLO': 'SVN',  # Slovenia
    'SRB': 'SRB',  # Serbia (même code)
    'SRI': 'LKA',  # Sri Lanka
    'SUD': 'SDN',  # Sudan
    'SUI': 'CHE',  # Switzerland
    'SWE': 'SWE',  # Sweden (même code)
    'THA': 'THA',  # Thailand (même code)
    'TPE': 'TWN',  # Chinese Taipei
    'TUN': 'TUN',  # Tunisia (même code)
    'TUR': 'TUR',  # Turkey (même code)
    'UKR': 'UKR',  # Ukraine (même code)
    'URU': 'URY',  # Uruguay
    'URS': 'RUS',  # Soviet Union (mappé vers Russie)
    'USA': 'USA',  # United States (même code)
    'UZB': 'UZB',  # Uzbekistan (même code)
    'VEN': 'VEN',  # Venezuela (même code)
    'VIE': 'VNM',  # Vietnam
    'ZIM': 'ZWE',  # Zimbabwe
    # Codes historiques et cas spéciaux
    'AHO': 'ANT',  # Netherlands Antilles (dissous en 2010)
    'ANZ': 'AUS',  # Australasia (équipe historique Australie/Nouvelle-Zélande, mappé vers Australie)
    'BOH': 'CZE',  # Bohemia (territoire historique, maintenant République Tchèque)
    'CGO': 'COG',  # Congo (Brazzaville) - République du Congo
    'COD': 'COD',  # Congo (Kinshasa) - République Démocratique du Congo (même code)
    'CRT': 'GRC',  # Crete (île grecque, mappé vers Grèce)
    'EUN': 'RUS',  # Unified Team (Équipe unifiée 1992, ex-URSS, mappé vers Russie)
    'FRG': 'DEU',  # West Germany (Allemagne de l'Ouest, mappé vers Allemagne)
    'FSM': 'FSM',  # Federated States of Micronesia (même code)
    'GDR': 'DEU',  # East Germany (Allemagne de l'Est, mappé vers Allemagne)
    'IOP': 'RUS',  # Individual Olympic Participants (mappé vers Russie par défaut)
    'MKD': 'MKD',  # North Macedonia (même code)
    'MON': 'MCO',  # Monaco
    'NGR': 'NGA',  # Nigeria
    'OAR': 'RUS',  # Olympic Athletes from Russia
    'ROT': 'RUS',  # Refugee Olympic Team (mappé vers Russie pour les stats, mais cas spécial)
    'SCG': 'SRB',  # Serbia and Montenegro (dissous, mappé vers Serbie)
    'TCH': 'CZE',  # Czechoslovakia (dissous, mappé vers République Tchèque)
    'UNK': 'RUS',  # Unknown (mappé vers Russie par défaut)
    'WIF': 'RUS',  # West Indies Federation (dissous, mappé vers Russie par défaut)
    'YUG': 'SRB',  # Yugoslavia (dissous, mappé vers Serbie)
    'ZZX': 'RUS',  # Mixed teams (mappé vers Russie par défaut)
}

# Analyser les codes qui n'ont pas de correspondance
athletes_codes = set(athletes_countries['NOC'].unique())
mapped_codes = set(ioc_to_iso_mapping.keys())
unmapped_codes = athletes_codes - mapped_codes

print(f"\n=== Analyse des codes pays ===")
print(f"Nombre de codes IOC distincts dans athlete_events: {len(athletes_codes)}")
print(f"Nombre de codes mappés manuellement: {len(mapped_codes)}")
print(f"Nombre de codes non mappés: {len(unmapped_codes)}")

if unmapped_codes:
    print(f"\nCodes IOC sans mapping (premiers 20):")
    for code in sorted(list(unmapped_codes))[:20]:
        team_name = athletes_countries[athletes_countries['NOC'] == code]['Team'].values[0]
        print(f"  {code}: {team_name}")

# Tenter de trouver des correspondances automatiques par nom de pays
auto_mapping = {}
for idx, row in athletes_countries.iterrows():
    ioc_code = row['NOC']
    team_name = row['Team']
    
    # Si déjà mappé manuellement, passer
    if ioc_code in ioc_to_iso_mapping:
        continue
    
    # Chercher une correspondance exacte par nom
    match = df_continents[df_continents['name'] == team_name]
    if not match.empty:
        auto_mapping[ioc_code] = match.iloc[0]['alpha-3']
        continue
    
    # Chercher une correspondance dans le dataset de population
    match_pop = population_countries[population_countries['Entity'] == team_name]
    if not match_pop.empty:
        iso_code = match_pop.iloc[0]['Code']
        # Vérifier que ce code existe dans continents
        if iso_code in df_continents['alpha-3'].values:
            auto_mapping[ioc_code] = iso_code

print(f"\nNombre de correspondances automatiques trouvées: {len(auto_mapping)}")

# Combiner les mappings
full_mapping = {**ioc_to_iso_mapping, **auto_mapping}

# Sauvegarder le mapping dans un fichier CSV
mapping_df = pd.DataFrame([
    {'IOC_Code': ioc, 'ISO_Code': iso, 'Source': 'Manual' if ioc in ioc_to_iso_mapping else 'Auto'}
    for ioc, iso in full_mapping.items()
])
mapping_df = mapping_df.sort_values('IOC_Code')

output_path = os.path.join(project_root, 'CSV_Source', 'country_code_mapping.csv')
mapping_df.to_csv(output_path, index=False)

print(f"\n✓ Mapping sauvegardé dans: {output_path}")
print(f"Total de mappings: {len(full_mapping)}")

# Analyser les codes restants sans mapping
still_unmapped = athletes_codes - set(full_mapping.keys())
if still_unmapped:
    print(f"\n⚠ Codes toujours sans mapping ({len(still_unmapped)} codes):")
    for code in sorted(list(still_unmapped))[:10]:
        team_name = athletes_countries[athletes_countries['NOC'] == code]['Team'].values[0]
        print(f"  {code}: {team_name}")
