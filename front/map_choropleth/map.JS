// Import data utilities (advanced data handling)
import * as ops from '../utils/operations.js';

// Global variables for data and state
let athleteData = [];
let populationArray = [];
// Derived population maps
let populationByNOCYear = new Map(); // Map<NOC, Map<Year, Population>>
let latestPopulationByNOC = new Map(); // Map<NOC, latestPopulation>

let currentYear = 2016;
let currentSeason = "Summer";
let currentView = "singleEdition"; // "singleEdition" or "allEditions"

// Available years by season
let allYears = [];
let summerYears = [];
let winterYears = [];

// Stores processed data for medals and participations by NOC, Year, and Season (all-time aggregations)
let medalsByNOCYearSeason = new Map();
let participationsByNOCYearSeason = new Map();

// Stores aggregated data for ALL editions
let allEditionsMedalsByNOC = new Map();
let allEditionsParticipationsByNOC = new Map();
let allEditionsPopulationByNOC = new Map(); // latest population

// Map dimensions and margins
const margin = { top: 20, right: 20, bottom: 20, left: 20 };
const width = window.innerWidth - margin.left - margin.right;
const height = window.innerHeight - margin.top - margin.bottom;

// SVG setup
const svg = d3.select("#my_dataviz")
    .attr("width", width)
    .attr("height", height);

// Group for the map paths
const g = svg.append("g");

// Tooltip
const tooltip = d3.select("#tooltip");

// Bar charts container for zoomed state
const barChartsContainer = d3.select("#bar-charts-container");
const countryBarChartTitle = d3.select("#country-bar-chart-title");
const medalsBar = d3.select("#medals-bar");
const participantsBar = d3.select("#participants-bar");

// Projection and path generator
const projection = d3.geoMercator()
    .scale(150) // Adjust scale for better initial fit
    .center([0, 20])
    .translate([width / 2, height / 2]);

const pathGenerator = d3.geoPath().projection(projection);

// Zoom behavior
const zoom = d3.zoom()
    .scaleExtent([1, 10]) // Increased max zoom
    .on("zoom", handleZoom);

svg.call(zoom);

let activeCountry = d3.select(null); // To track the currently zoomed country

// Color scale for medal/population ratio
// Ajusté pour un ratio "par 100k habitants" (multiplié par 100000)
// 0.000001 * 100k = 0.1
// 0.00001 * 100k = 1
// 0.00005 * 100k = 5
const colorScale = d3.scaleQuantile()
    .range(d3.schemeYlGnBu[7]); // 7 couleurs

// Legend setup
const legend = d3.select("#legend");

function generateLegend() {
    legend.html("<h4>Ratio Médaille / Population<br>(par 100k habitants)</h4>");

    // Récupère les seuils (quantiles) calculés par D3
    const thresholds = colorScale.quantiles(); // ex: [0.0001, 0.0005, 0.002, ...]
    const range = colorScale.range(); // 7 couleurs

    // S'il n'y a pas de données (ex: Hiver 1900), ne rien afficher
    if (!thresholds || thresholds.length === 0) {
        legend.html("<h4>Pas de données pour cette sélection</h4>");
        return;
    }

    let legendData = [];
    const formatRatio = (n) => (n * 100000).toFixed(2);

    // 1. Première couleur (range[0]) : 0 à seuil[0]
    legendData.push({
        color: range[0],
        rangeText: `0 - ${formatRatio(thresholds[0])}`
    });

    // 2. Couleurs intermédiaires
    for (let i = 0; i < thresholds.length - 1; i++) {
        legendData.push({
            color: range[i + 1],
            rangeText: `${formatRatio(thresholds[i])} - ${formatRatio(thresholds[i + 1])}`
        });
    }

    // 3. Dernière couleur (range[6]) : > au dernier seuil
    legendData.push({
        color: range[range.length - 1],
        rangeText: `> ${formatRatio(thresholds[thresholds.length - 1])}`
    });

    // Génère les éléments de la légende
    legend.selectAll(".legend-item").remove(); // Efface l'ancienne légende
    
    legend.selectAll(".legend-item")
        .data(legendData)
        .enter()
        .append("div")
        .attr("class", "legend-item")
        .html(d => `<span class="legend-color" style="background-color: ${d.color};"></span> ${d.rangeText}`);
}


/**
 * Build derived population maps from ops population array
 */
function buildPopulationMaps(popArray) {
    populationByNOCYear = new Map();
    latestPopulationByNOC = new Map();
    const latestYearByNOC = new Map();

    popArray.forEach(d => {
        const noc = d.Code;
        const year = +d.Year;
        const pop = +d.Population;
        if (!noc || isNaN(year) || !isFinite(pop) || pop <= 0) return;
        if (!populationByNOCYear.has(noc)) populationByNOCYear.set(noc, new Map());
        populationByNOCYear.get(noc).set(year, pop);
        const prevYear = latestYearByNOC.get(noc) ?? -Infinity;
        if (year > prevYear) {
            latestYearByNOC.set(noc, year);
            latestPopulationByNOC.set(noc, pop);
        }
    });
}

/**
 * Aggregate athlete data for all editions (all-time medals and unique participants)
 */
function buildAllEditionsAggregates(athletes) {
    allEditionsMedalsByNOC = new Map();
    allEditionsParticipationsByNOC = new Map();

    const allNOCs = new Set(athletes.map(d => d.NOC));
    allNOCs.forEach(noc => {
        allEditionsMedalsByNOC.set(noc, 0);
        allEditionsParticipationsByNOC.set(noc, new Set());
    });

    athletes.forEach(d => {
        const noc = d.NOC;
        const medal = d.Medal;
        if (!noc) return;
        if (medal && medal !== 'NA') {
            allEditionsMedalsByNOC.set(noc, allEditionsMedalsByNOC.get(noc) + 1);
        }
        allEditionsParticipationsByNOC.get(noc).add(d.ID);
    });

    // Convert sets to counts
    allEditionsParticipationsByNOC.forEach((set, noc, m) => {
        m.set(noc, set.size);
    });

    // Latest population by NOC (already computed)
    allEditionsPopulationByNOC = new Map(latestPopulationByNOC);
}

/**
 * Récupère les données d'un pays en fonction de la vue (single/all)
 */
// Cache for current single edition combined data
let currentCombinedData = [];
let currentDataByNOC = new Map();

function refreshSingleEditionData(year, season) {
    const prepared = ops.prepareChartData(athleteData, populationArray, year, season);
    currentCombinedData = prepared.data;
    currentDataByNOC = new Map(currentCombinedData.map(d => [d.noc, d]));
}

function getCountryData(noc, year, season, view) {
    if (view === "singleEdition") {
        const d = currentDataByNOC.get(noc);
        if (d) {
            return {
                noc,
                year,
                season,
                medals: d.medals,
                participations: d.participants,
                population: d.population,
                ratioMedalPop: d.population > 0 ? d.medals / d.population : 0,
                ratioMedalPart: d.participants > 0 ? d.medals / d.participants : 0
            };
        }
        return { noc, year, season, medals: 0, participations: 0, population: 0, ratioMedalPop: 0, ratioMedalPart: 0 };
    }

    // allEditions view
    const medals = allEditionsMedalsByNOC.get(noc) || 0;
    const participations = allEditionsParticipationsByNOC.get(noc) || 0;
    const population = allEditionsPopulationByNOC.get(noc) || 0;
    return {
        noc,
        year,
        season,
        medals,
        participations,
        population,
        ratioMedalPop: (medals > 0 && population > 0) ? medals / population : 0,
        ratioMedalPart: (medals > 0 && participations > 0) ? medals / participations : 0
    };
}


function updateMap() {
    // 1. Récupérer TOUS les ratios pour l'état actuel
    let allRatios = [];
    
    if (currentView === "singleEdition") {
        // CORRECTION ICI :
        // Nous devons calculer le ratio manuellement, car il n'est pas stocké dans l'objet 'd'
        allRatios = Array.from(currentDataByNOC.values())
                         .map(d => (d.population > 0 && d.medals > 0) ? d.medals / d.population : 0)
                         .filter(ratio => ratio > 0); // Important: ne garde que les ratios > 0

    } else {
        // La logique "allEditions" était correcte, car elle utilise getCountryData
        g.selectAll("path.Country").each(function(d) {
            const countryData = getCountryData(d.id, currentYear, currentSeason, currentView);
            if (countryData.ratioMedalPop > 0) {
                allRatios.push(countryData.ratioMedalPop);
            }
        });
    }

    // 2. Mettre à jour le domaine de l'échelle
    if (allRatios.length > 0) {
        colorScale.domain(allRatios);
    } else {
        colorScale.domain([0, 1]); // Fallback si aucune donnée (ex: Hiver 1896)
    }

    // 3. Appliquer la couleur (Cette partie n'a pas changé)
    g.selectAll("path.Country")
        .transition()
        .duration(200)
        .attr("fill", function (d) {
            const countryData = getCountryData(d.id, currentYear, currentSeason, currentView);
            return countryData.ratioMedalPop > 0 ? colorScale(countryData.ratioMedalPop) : "#ccc";
        });
        
    // 4. Mettre à jour la légende avec les nouveaux seuils
    generateLegend(); 
}

// Handles zoom and pan
function handleZoom(event) {
    g.attr("transform", event.transform);
    g.selectAll("path").style("stroke-width", 1 / event.transform.k + "px");

    // Cache les graphiques si on dézoome ou déplace la carte
    if (activeCountry.empty() || event.transform.k === 1) {
        barChartsContainer.style("display", "none");
    }
}

// Reset zoom to initial state
function resetZoom() {
    activeCountry.classed("active", false);
    activeCountry = d3.select(null);
    barChartsContainer.style("display", "none"); // Cache les graphiques

    svg.transition()
        .duration(750)
        .call(zoom.transform, d3.zoomIdentity);
}

/**
 * Click handler for countries (zoom and show bar charts)
 * CORRIGÉ : Calcul du zoom (y) et max des barres
 */
function countryClick(event, d) {
    // Si on clique sur le pays déjà actif, on reset
    if (activeCountry.node() === this) return resetZoom(); 

    activeCountry.classed("active", false);
    activeCountry = d3.select(this).classed("active", true);

    const countryData = getCountryData(d.id, currentYear, currentSeason, currentView);

    // Update bar charts
    const titleYear = currentView === "singleEdition" ? currentYear : "Toutes Éditions";
    const titleSeason = currentView === "singleEdition" ? `, ${currentSeason}` : "";
    // Utilise le nom du pays depuis le geojson
    countryBarChartTitle.text(`${d.properties.name} (${titleYear}${titleSeason})`); 

    // Determine max values for bar chart scaling based on current view
    let maxMedals = 1; // Default à 1 pour éviter division par zéro
    let maxParticipants = 1;

    if (currentView === "singleEdition") {
        // CORRIGÉ : Utilise currentCombinedData (qui est déjà calculé)
        const medalValues = currentCombinedData.map(d => d.medals);
        const participantValues = currentCombinedData.map(d => d.participants);
        
        maxMedals = d3.max(medalValues) || 1;
        maxParticipants = d3.max(participantValues) || 1;

    } else { // "allEditions"
        maxMedals = d3.max(Array.from(allEditionsMedalsByNOC.values())) || 1;
        maxParticipants = d3.max(Array.from(allEditionsParticipationsByNOC.values())) || 1;
    }

    // Applique les largeurs de barre
    medalsBar.style("width", `${(countryData.medals / maxMedals) * 100}%`)
        .text(countryData.medals > 0 ? countryData.medals : "");
    participantsBar.style("width", `${(countryData.participations / maxParticipants) * 100}%`)
        .text(countryData.participations > 0 ? countryData.participations : "");

    barChartsContainer.style("display", "flex"); // Show bar charts

    // Zoom logic
    const bounds = pathGenerator.bounds(d);
    const dx = bounds[1][0] - bounds[0][0];
    const dy = bounds[1][1] - bounds[0][1];
    const x = (bounds[0][0] + bounds[1][0]) / 2;
    const y = (bounds[0][1] + bounds[1][1]) / 2; // <-- CORRIGÉ ICI
    const scale = Math.max(1, Math.min(8, 0.9 / Math.max(dx / width, dy / height)));
    const translate = [width / 2 - scale * x, height / 2 - scale * y];

    svg.transition()
        .duration(750)
        .call(
            zoom.transform,
            d3.zoomIdentity.translate(translate[0], translate[1]).scale(scale)
        );
}

// Mouseover for tooltip
function mouseOver(event, d) {
    tooltip.style("opacity", 1);
    d3.select(this)
        .transition().duration(200).style("opacity", 1).style("stroke", "black").style("stroke-width", "1.5px");

    const countryData = getCountryData(d.id, currentYear, currentSeason, currentView);
    const countryName = d.properties.name; // Use properties.name from geojson

    const popLabel = currentView === "singleEdition" ? `Population (${currentYear})` : "Pop. la plus récente";
    const popFormatted = countryData.population > 0 ? countryData.population.toLocaleString() : "N/D";
    const medalsFormatted = countryData.medals > 0 ? countryData.medals.toLocaleString() : "N/D";
    const participationsFormatted = countryData.participations > 0 ? countryData.participations.toLocaleString() : "N/D";
    const ratioMedalPopFormatted = countryData.ratioMedalPop > 0 ? (countryData.ratioMedalPop * 100000).toFixed(2) : "N/D";

    const editionInfo = currentView === "singleEdition" ? `Année: ${currentYear}, Saison: ${currentSeason}` : "Toutes Éditions";

    tooltip.html(`
        <b>${countryName} (${d.id})</b><br>
        ${editionInfo}<br>
        ${popLabel}: ${popFormatted}<br>
        Médailles: ${medalsFormatted}<br>
        Participants: ${participationsFormatted}<br>
        Ratio Médaille/Pop (par 100k): ${ratioMedalPopFormatted}
    `)
        .style("left", (event.pageX + 20) + "px")
        .style("top", (event.pageY - 28) + "px");
}

function mouseMove(event) {
    tooltip
        .style("left", (event.pageX + 20) + "px")
        .style("top", (event.pageY - 28) + "px");
}

// Mouseleave for tooltip
function mouseLeave() {
    tooltip.style("opacity", 0);
    if (activeCountry.node() !== this) { // Only reset if not the active (zoomed) country
        d3.select(this)
            .transition().duration(200).style("stroke", "transparent"); // Retour à la normale
    }
}

// Setup year slider and advanced controls
const yearSlider = d3.select("#yearSlider");
const yearDisplay = d3.select("#yearDisplay");
const prevBtn = d3.select("#prevBtn");
const nextBtn = d3.select("#nextBtn");

function updateSliderForSeason(season) {
    const availableYears = season === 'Summer' ? summerYears : winterYears;
    if (availableYears.length === 0) return;
    const minY = d3.min(availableYears);
    const maxY = d3.max(availableYears);
    yearSlider.attr('min', minY).attr('max', maxY).attr('step', 2);
    const initial = availableYears.includes(currentYear) ? currentYear : minY;
    yearSlider.property('value', initial);
    yearDisplay.text(initial);
    currentYear = initial;

    // Create/update datalist for available years (parity with bubble chart)
    const datalistId = 'year-options-map';
    d3.select('#' + datalistId).remove();
    const datalist = d3.select('body').append('datalist').attr('id', datalistId);
    yearSlider.attr('list', datalistId);
    availableYears.forEach(y => datalist.append('option').attr('value', y));
}

function updateNavButtons() {
    const availableYears = currentSeason === 'Summer' ? summerYears : winterYears;
    const idx = availableYears.indexOf(+yearSlider.property('value'));
    prevBtn.property('disabled', idx <= 0);
    nextBtn.property('disabled', idx < 0 || idx >= availableYears.length - 1);
}

yearSlider.on('input', function() {
    const selected = +this.value;
    const availableYears = currentSeason === 'Summer' ? summerYears : winterYears;
    const closest = ops.findClosestYear(availableYears, selected);
    currentYear = closest;
    yearDisplay.text(closest);
    currentView = 'singleEdition';
    d3.select('#allEditionsBtn').classed('active', false);
    refreshSingleEditionData(currentYear, currentSeason);
    updateMap();
    if (!activeCountry.empty()) countryClick(null, activeCountry.datum());
    toggleYearControls(true);
    updateNavButtons();
});

prevBtn.on('click', function() {
    const availableYears = currentSeason === 'Summer' ? summerYears : winterYears;
    const idx = availableYears.indexOf(+yearSlider.property('value'));
    if (idx > 0) {
        const newYear = availableYears[idx - 1];
        yearSlider.property('value', newYear);
        yearDisplay.text(newYear);
        currentYear = newYear;
        currentView = 'singleEdition';
        d3.select('#allEditionsBtn').classed('active', false);
        refreshSingleEditionData(currentYear, currentSeason);
        updateMap();
        if (!activeCountry.empty()) countryClick(null, activeCountry.datum());
        toggleYearControls(true);
        updateNavButtons();
    }
});

nextBtn.on('click', function() {
    const availableYears = currentSeason === 'Summer' ? summerYears : winterYears;
    const idx = availableYears.indexOf(+yearSlider.property('value'));
    if (idx >= 0 && idx < availableYears.length - 1) {
        const newYear = availableYears[idx + 1];
        yearSlider.property('value', newYear);
        yearDisplay.text(newYear);
        currentYear = newYear;
        currentView = 'singleEdition';
        d3.select('#allEditionsBtn').classed('active', false);
        refreshSingleEditionData(currentYear, currentSeason);
        updateMap();
        if (!activeCountry.empty()) countryClick(null, activeCountry.datum());
        toggleYearControls(true);
        updateNavButtons();
    }
});

// Setup season buttons
d3.selectAll(".season-btn[data-season]").on("click", function() {
    d3.selectAll(".season-btn").classed("active", false);
    d3.select(this).classed("active", true);
    currentSeason = d3.select(this).attr("data-season");
    
    // Force la vue "singleEdition"
    currentView = "singleEdition";
    d3.select("#allEditionsBtn").classed("active", false);
    updateSliderForSeason(currentSeason);
    refreshSingleEditionData(currentYear, currentSeason);
    updateNavButtons();
    updateMap();
    if (!activeCountry.empty()) {
        countryClick(null, activeCountry.datum());
    }
    toggleYearControls(true);
});

// Add "All Editions" button and functionality
const controlsDiv = d3.select(".controls");
controlsDiv.append("div")
    .attr("class", "control-row")
    .html('<button class="season-btn" id="allEditionsBtn" data-view="allEditions">Toutes Éditions</button>');

d3.select("#allEditionsBtn").on("click", function() {
    d3.selectAll(".season-btn").classed("active", false); // Désactive les boutons saison
    d3.select(this).classed("active", true); // Active "Toutes Éditions"
    currentView = "allEditions";
    updateMap();
    if (!activeCountry.empty()) {
        countryClick(null, activeCountry.datum());
    }
    toggleYearControls(false); // Cache les contrôles année/saison
});

// Function to toggle visibility of year and season controls
function toggleYearControls(show) {
    // Sélectionne les "control-row" qui contiennent les sliders/boutons de saison
    d3.select(".control-row:nth-child(1)").style("display", show ? "flex" : "none"); // Ligne Année
    d3.select(".control-row:nth-child(2)").style("display", show ? "flex" : "none"); // Ligne Saison
}

// Initial data load and map rendering (use operations.js for CSVs)
Promise.all([
    d3.json('https://raw.githubusercontent.com/holtzy/D3-graph-gallery/master/DATA/world.geojson'),
    ops.loadData(
        "../../CSV_Dest/athlete_events_opti.csv",
        "../../CSV_Dest/population-1900-2016.csv"
    )
]).then(([topo, loaded]) => {
    athleteData = loaded.athleteData;
    populationArray = loaded.populationData;

    // Build derived population maps and all-editions aggregates
    buildPopulationMaps(populationArray);
    buildAllEditionsAggregates(athleteData);

    // Compute available years and season subsets
    allYears = ops.getAvailableYears(athleteData);
    summerYears = [...new Set(athleteData.filter(d => d.Season === 'Summer').map(d => d.Year))].sort((a,b)=>a-b);
    winterYears = [...new Set(athleteData.filter(d => d.Season === 'Winter').map(d => d.Year))].sort((a,b)=>a-b);

    // Default current year to latest Summer if available, else max overall
    currentSeason = 'Summer';
    currentYear = d3.max(summerYears.length ? summerYears : allYears);
    updateSliderForSeason(currentSeason);
    refreshSingleEditionData(currentYear, currentSeason);
    updateNavButtons();

    // Filter GeoJSON to countries we have any data for
    const features = topo.features.filter(d => latestPopulationByNOC.has(d.id) || allEditionsMedalsByNOC.has(d.id));

    // Draw the map
    g.selectAll("path")
        .data(features)
        .enter()
        .append("path")
        .attr("d", pathGenerator)
        .attr("class", "Country")
        .attr("fill", "#ccc")
        .style("stroke", "transparent")
        .style("stroke-width", 0.5)
        .style("opacity", 0.8)
        .on("mouseover", mouseOver)
        .on("mouseleave", mouseLeave)
        .on("mousemove", mouseMove)
        .on("click", countryClick);

    updateMap();
    generateLegend();

    d3.select(".season-btn[data-season='Summer']").classed("active", true);
    toggleYearControls(true);
}).catch(error => {
    console.error("Erreur lors du chargement ou traitement des données:", error);
});