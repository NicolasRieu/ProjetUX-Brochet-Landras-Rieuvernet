/**
 * Operations.js
 * Fonctions de traitement des données pour les visualisations olympiques
 */

/**
 * Charge les fichiers CSV (athlètes et population)
 * @param {string} athleteCsvPath - Chemin vers le fichier athlete_events_opti.csv
 * @param {string} populationCsvPath - Chemin vers le fichier population.csv
 * @returns {Promise<{athleteData: Array, populationData: Array}>}
 */
export async function loadData(athleteCsvPath, populationCsvPath) {
  try {
    const [athleteText, populationData] = await Promise.all([
      d3.text(athleteCsvPath),
      d3.csv(populationCsvPath)
    ]);

    console.log("Files loaded successfully");

    // Parse les données des athlètes avec délimiteur point-virgule
    const athleteData = d3.dsvFormat(";").parse(athleteText, d => {
      return {
        ID: d.ID,
        Name: d.Name,
        Sex: d.Sex,
        Team: d.Team,
        NOC: d.NOC,
        Games: d.Games,
        Year: +d.Year,
        Season: d.Season,
        Sport: d.Sport,
        Event: d.Event,
        Medal: d.Medal
      };
    });

    console.log("Athlete data parsed:", athleteData.length, "rows");

    // Parse les données de population
    const parsedPopulationData = populationData.map(d => ({
      Entity: d.Entity,
      Code: d.Code,
      Year: +d.Year,
      Population: +d["Population (historical)"],
      Continent: d.Continent
    }));

    console.log("Population data parsed:", parsedPopulationData.length, "rows");

    return {
      athleteData,
      populationData: parsedPopulationData
    };
  } catch (error) {
    console.error("Error loading data:", error);
    throw error;
  }
}

/**
 * Récupère les années disponibles dans les données
 * @param {Array} athleteData - Données des athlètes
 * @returns {Array<number>} - Liste des années triées
 */
export function getAvailableYears(athleteData) {
  return [...new Set(athleteData.map(d => d.Year))]
    .sort((a, b) => a - b);
}

/**
 * Filtre les athlètes par année et saison
 * @param {Array} athleteData - Données des athlètes
 * @param {number} year - Année à filtrer
 * @param {string} season - Saison ("Summer" ou "Winter")
 * @returns {Array} - Données filtrées
 */
export function filterAthletesByYearAndSeason(athleteData, year, season) {
  return athleteData.filter(d => d.Year === year && d.Season === season);
}

/**
 * Calcule le nombre de participants par pays
 * @param {Array} yearAthletes - Données des athlètes pour une année/saison
 * @returns {Map<string, number>} - Map de NOC -> nombre de participants uniques
 */
export function calculateParticipantsByCountry(yearAthletes) {
  return d3.rollup(
    yearAthletes,
    v => new Set(v.map(d => d.ID)).size, // Compte les athlètes uniques
    d => d.NOC
  );
}

/**
 * Calcule le nombre de médailles par pays
 * @param {Array} yearAthletes - Données des athlètes pour une année/saison
 * @returns {Map<string, Object>} - Map de NOC -> {total, gold, silver, bronze}
 */
export function calculateMedalsByCountry(yearAthletes) {
  const athletesWithMedals = yearAthletes.filter(d => d.Medal && d.Medal.trim() !== "");
  return d3.rollup(
    athletesWithMedals,
    v => {
      const gold = v.filter(d => d.Medal === "Gold").length;
      const silver = v.filter(d => d.Medal === "Silver").length;
      const bronze = v.filter(d => d.Medal === "Bronze").length;
      return {
        total: v.length,
        gold: gold,
        silver: silver,
        bronze: bronze
      };
    },
    d => d.NOC
  );
}

/**
 * Récupère la population et le continent par pays pour une année donnée
 * @param {Array} populationData - Données de population
 * @param {number} year - Année
 * @returns {Map<string, Object>} - Map de Code pays -> {population, continent}
 */
export function getPopulationByCountry(populationData, year) {
  return d3.rollup(
    populationData.filter(d => d.Year === year),
    v => ({ population: v[0].Population, continent: v[0].Continent }),
    d => d.Code
  );
}

/**
 * Récupère les noms de pays par NOC
 * @param {Array} yearAthletes - Données des athlètes pour une année/saison
 * @returns {Map<string, string>} - Map de NOC -> nom du pays (Team)
 */
export function getCountryNames(yearAthletes) {
  return d3.rollup(
    yearAthletes,
    v => v[0].Team, // Prend le premier nom de Team pour ce NOC
    d => d.NOC
  );
}

/**
 * Combine les données de participants, médailles et population
 * @param {Map} participantsByCountry - Map de NOC -> participants
 * @param {Map} medalsByCountry - Map de NOC -> {total, gold, silver, bronze}
 * @param {Map} populationByCountry - Map de Code -> {population, continent}
 * @param {Map} countryNames - Map de NOC -> nom du pays
 * @returns {Array<Object>} - Tableau d'objets combinés
 */
export function combineData(participantsByCountry, medalsByCountry, populationByCountry, countryNames) {
  const combinedData = [];
  
  participantsByCountry.forEach((participants, noc) => {
    const medalData = medalsByCountry.get(noc) || { total: 0, gold: 0, silver: 0, bronze: 0 };
    const popData = populationByCountry.get(noc);
    
    if (popData && popData.population > 0) {
      combinedData.push({
        noc: noc,
        countryName: countryNames.get(noc) || noc,
        participants: participants,
        medals: medalData.total,
        gold: medalData.gold,
        silver: medalData.silver,
        bronze: medalData.bronze,
        population: popData.population,
        continent: popData.continent || "Unknown"
      });
    }
  });
  
  return combinedData;
}

/**
 * Prépare les données complètes pour une année et une saison
 * @param {Array} athleteData - Données des athlètes
 * @param {Array} populationData - Données de population
 * @param {number} year - Année
 * @param {string} season - Saison ("Summer" ou "Winter")
 * @returns {Object} - Objet contenant les données combinées et les statistiques
 */
export function prepareChartData(athleteData, populationData, year, season) {
  // Filtre les athlètes
  const yearAthletes = filterAthletesByYearAndSeason(athleteData, year, season);
  
  // Calcule les statistiques
  const participantsByCountry = calculateParticipantsByCountry(yearAthletes);
  const medalsByCountry = calculateMedalsByCountry(yearAthletes);
  const populationByCountry = getPopulationByCountry(populationData, year);
  const countryNames = getCountryNames(yearAthletes);
  
  // Log pour debug
  console.log(`Year: ${year}, Season: ${season}`);
  console.log(`Athletes found: ${yearAthletes.length}`);
  console.log(`Countries with participants: ${participantsByCountry.size}`);
  console.log(`Countries with medals: ${medalsByCountry.size}`);
  console.log(`Countries with population: ${populationByCountry.size}`);
  
  // Combine les données
  const combinedData = combineData(participantsByCountry, medalsByCountry, populationByCountry, countryNames);
  
  console.log(`Combined data: ${combinedData.length} countries`);
  
  return {
    data: combinedData,
    stats: {
      totalAthletes: yearAthletes.length,
      countriesCount: combinedData.length,
      year: year,
      season: season
    }
  };
}

/**
 * Trouve l'année la plus proche disponible
 * @param {Array<number>} availableYears - Liste des années disponibles
 * @param {number} targetYear - Année cible
 * @returns {number} - Année la plus proche
 */
export function findClosestYear(availableYears, targetYear) {
  return availableYears.reduce((prev, curr) => 
    Math.abs(curr - targetYear) < Math.abs(prev - targetYear) ? curr : prev
  );
}
