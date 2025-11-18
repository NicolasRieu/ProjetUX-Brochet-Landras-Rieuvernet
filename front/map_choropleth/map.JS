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
let lastSingleEditionSeason = "Summer"; // Track last season for toggling back

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
let allEditionsAppearancesByNOC = new Map(); // number of Olympic appearances

// Map dimensions and margins
const margin = { top: 20, right: 20, bottom: 20, left: 20 };
const width = window.innerWidth - margin.left - margin.right;
const height = window.innerHeight - margin.top - margin.bottom;

// SVG setup
const svg = d3.select("#my_dataviz")
    .attr("width", width)
    .attr("height", height)
    .on("click", function(event) {
        // Reset zoom when clicking on background (not on a country)
        if (event.target === this) {
            resetZoom();
        }
    });

// Group for the map paths
const g = svg.append("g");

// Gradients for 3D-like bars
const defs = svg.append("defs");

const makeVerticalGradient = (id, color) => {
	const grad = defs.append("linearGradient")
		.attr("id", id)
		.attr("x1", "0%")
		.attr("y1", "0%")
		.attr("x2", "0%")
		.attr("y2", "100%");
	grad.append("stop").attr("offset", "0%").attr("stop-color", d3.color(color).brighter(0.8));
	grad.append("stop").attr("offset", "100%").attr("stop-color", d3.color(color).darker(0.6));
};

makeVerticalGradient("medalsGrad", "#007bff");
makeVerticalGradient("participantsGrad", "#28a745");

// Side shading gradients (for simple 3D illusion)
const makeSideGradient = (id, color) => {
	const grad = defs.append("linearGradient")
		.attr("id", id)
		.attr("x1", "0%")
		.attr("y1", "0%")
		.attr("x2", "100%")
		.attr("y2", "0%");
	grad.append("stop").attr("offset", "0%").attr("stop-color", d3.color(color).darker(0.4)).attr("stop-opacity", 0.9);
	grad.append("stop").attr("offset", "100%").attr("stop-color", d3.color(color).darker(1.2)).attr("stop-opacity", 0.9);
};

makeSideGradient("medalsSide", "#007bff");
makeSideGradient("participantsSide", "#28a745");

// Layer for in-map country bars (follows zoom/pan)
const barsLayer = g.append("g")
	.attr("id", "country-bars")
	.style("pointer-events", "visiblePainted")
	.style("display", "none");

// Tooltip
const tooltip = d3.select("#tooltip");

// Bottom-right info panel elements
const infoCountry = d3.select("#info-country");
const infoEdition = d3.select("#info-edition");
const infoPop = d3.select("#info-pop");
const infoAppearances = d3.select("#info-appearances");
const infoMedals = d3.select("#info-medals");
const infoParticipants = d3.select("#info-participants");
const infoRatio = d3.select("#info-ratio");

// Debounce helper
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

function setInfoPanel(feature) {
    if (!feature) {
        infoCountry.text("Pays: —");
        infoEdition.text("—");
        infoPop.text("—");
        infoAppearances.text("—");
        infoMedals.text("—");
        infoParticipants.text("—");
        infoRatio.text("—");
        return;
    }
    const d = feature;
    const data = getCountryData(d.id, currentYear, currentSeason, currentView);
    const countryName = d.properties && d.properties.name ? d.properties.name : d.id;
    const popLabel = currentView === "singleEdition" ? `Année ${currentYear}` : "Plus récente";
    const popFormatted = data.population > 0 ? data.population.toLocaleString() : "N/D";
    const medalsFormatted = data.medals > 0 ? data.medals.toLocaleString() : "N/D";
    const participantsFormatted = data.participations > 0 ? data.participations.toLocaleString() : "N/D";
    const appearancesFormatted = data.participationsCount > 0 ? data.participationsCount.toLocaleString() : "N/D";
    const ratioMedalPopFormatted = data.ratioMedalPop > 0 ? (data.ratioMedalPop * 100000).toFixed(2) : "N/D";
    const editionInfo = currentView === "singleEdition" ? `${currentYear}, ${currentSeason}` : "Toutes Éditions";

    infoCountry.text(`Pays: ${countryName}`);
    infoEdition.text(editionInfo);
    infoPop.text(`${popFormatted} (${popLabel})`);
    infoAppearances.text(currentView === "singleEdition"
        ? (data.participationsCount > 0 ? "1 (Édition courante)" : "0")
        : `${appearancesFormatted} (Total)`);
    infoMedals.text(medalsFormatted);
    infoParticipants.text(currentView === "singleEdition" ? participantsFormatted : `${participantsFormatted} (Total)`);
    infoRatio.text(ratioMedalPopFormatted);
}

// Compute medal breakdown (gold/silver/bronze) for current selection
function getMedalBreakdown(noc) {
    let gold = 0, silver = 0, bronze = 0, total = 0;
    if (!noc) return { gold, silver, bronze, total };
    if (currentView === "singleEdition") {
        athleteData.forEach(a => {
            if (a.NOC === noc && a.Year === currentYear && a.Season === currentSeason && a.Medal && a.Medal !== 'NA') {
                total++;
                if (a.Medal === 'Gold') gold++; else if (a.Medal === 'Silver') silver++; else if (a.Medal === 'Bronze') bronze++;
            }
        });
    } else {
        athleteData.forEach(a => {
            if (a.NOC === noc && a.Medal && a.Medal !== 'NA') {
                total++;
                if (a.Medal === 'Gold') gold++; else if (a.Medal === 'Silver') silver++; else if (a.Medal === 'Bronze') bronze++;
            }
        });
    }
    return { gold, silver, bronze, total };
}

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
let currentZoomK = 1;
const zoom = d3.zoom()
    .scaleExtent([1, 20]) // Allow deeper zoom
    .on("zoom", handleZoom);

svg.call(zoom);

let activeCountry = d3.select(null); // To track the currently zoomed country
let isZooming = false; // Disable interactions during zoom animations
let zoomIdleTimer = null; // Debounce to re-enable tooltip after wheel/drag zoom

const bestHighlightColor = "#ff5722";
const ratioEpsilon = 1e-12;
let bestRatioValue = 0;
let bestRatioNOCs = new Set();

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
    allEditionsAppearancesByNOC = new Map();

    const allNOCs = new Set(athletes.map(d => d.NOC));
    allNOCs.forEach(noc => {
        allEditionsMedalsByNOC.set(noc, 0);
        allEditionsParticipationsByNOC.set(noc, new Set());
        allEditionsAppearancesByNOC.set(noc, new Set());
    });

    athletes.forEach(d => {
        const noc = d.NOC;
        const medal = d.Medal;
        if (!noc) return;
        if (medal && medal !== 'NA') {
            allEditionsMedalsByNOC.set(noc, allEditionsMedalsByNOC.get(noc) + 1);
        }
        allEditionsParticipationsByNOC.get(noc).add(d.ID);
        allEditionsAppearancesByNOC.get(noc).add(d.Games);
    });

    // Convert sets to counts
    allEditionsParticipationsByNOC.forEach((set, noc, m) => {
        m.set(noc, set.size);
    });
    allEditionsAppearancesByNOC.forEach((set, noc, m) => {
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
                participationsCount: d.participants > 0 || d.medals > 0 ? 1 : 0,
                ratioMedalPop: d.population > 0 ? d.medals / d.population : 0,
                ratioMedalPart: d.participants > 0 ? d.medals / d.participants : 0
            };
        }
        return { noc, year, season, medals: 0, participations: 0, population: 0, participationsCount: 0, ratioMedalPop: 0, ratioMedalPart: 0 };
    }

    // allEditions view
    const medals = allEditionsMedalsByNOC.get(noc) || 0;
    const participations = allEditionsParticipationsByNOC.get(noc) || 0;
    const population = allEditionsPopulationByNOC.get(noc) || 0;
    const appearances = allEditionsAppearancesByNOC.get(noc) || 0;
    return {
        noc,
        year,
        season,
        medals,
        participations,
        population,
        participationsCount: appearances,
        ratioMedalPop: (medals > 0 && population > 0) ? medals / population : 0,
        ratioMedalPart: (medals > 0 && participations > 0) ? medals / participations : 0
    };
}


function updateMap() {
    // 1. Récupérer TOUS les ratios pour l'état actuel
    let allRatios = [];
    bestRatioValue = 0;
    bestRatioNOCs = new Set();
    
    if (currentView === "singleEdition") {
        // CORRECTION ICI :
        // Nous devons calculer le ratio manuellement, car il n'est pas stocké dans l'objet 'd'
        currentDataByNOC.forEach(d => {
            const ratio = (d.population > 0 && d.medals > 0) ? d.medals / d.population : 0;
            if (ratio > 0) {
                allRatios.push(ratio);
                if (ratio > bestRatioValue + ratioEpsilon) {
                    bestRatioValue = ratio;
                    bestRatioNOCs = new Set([d.noc]);
                } else if (Math.abs(ratio - bestRatioValue) <= ratioEpsilon && ratio > 0) {
                    bestRatioNOCs.add(d.noc);
                }
            }
        });

    } else {
        allEditionsMedalsByNOC.forEach((medals, noc) => {
            const population = allEditionsPopulationByNOC.get(noc) || 0;
            if (medals > 0 && population > 0) {
                const ratio = medals / population;
                allRatios.push(ratio);
                if (ratio > bestRatioValue + ratioEpsilon) {
                    bestRatioValue = ratio;
                    bestRatioNOCs = new Set([noc]);
                } else if (Math.abs(ratio - bestRatioValue) <= ratioEpsilon) {
                    bestRatioNOCs.add(noc);
                }
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
            const isBest = bestRatioValue > 0 && bestRatioNOCs.has(d.id);
            if (isBest) return bestHighlightColor;
            return countryData.ratioMedalPop > 0 ? colorScale(countryData.ratioMedalPop) : "#ccc";
        });
        
    // 4. Mettre à jour la légende avec les nouveaux seuils
    generateLegend(); 
}

// Handles zoom and pan
function handleZoom(event) {
    g.attr("transform", event.transform);
    currentZoomK = event.transform.k;
    
    // Adjust stroke width to maintain consistent appearance at all zoom levels
    g.selectAll("path").style("stroke-width", Math.max(0.5, 1 / event.transform.k) + "px");

    // Hide tooltip immediately on any zoom interaction and debounce re-enable
    tooltip.style("opacity", 0);
    isZooming = true;
    
    if (zoomIdleTimer) clearTimeout(zoomIdleTimer);
    zoomIdleTimer = setTimeout(() => { 
        isZooming = false; 
    }, 150);

    // Hide bar charts and bars layer when zooming out to initial state
    if (activeCountry.empty() || event.transform.k === 1) {
        barChartsContainer.style("display", "none");
        barsLayer.style("display", "none");
    } else {
        // Ensure bars stay on top during interactions
        barsLayer.raise();
        
        // Adjust bar group scaling around centroid so bars maintain size relative to zoom
        const feat = activeCountry.datum();
        const geometryForView = getMetropolitanGeometry(feat) || feat;
        const centroid = pathGenerator.centroid(geometryForView);
        const group = barsLayer.select("g");
        
        if (!group.empty()) {
            group.attr("transform", 
                `translate(${centroid[0]},${centroid[1]}) scale(${1/currentZoomK}) translate(${-centroid[0]},${-centroid[1]})`
            );
        }
    }
}

// Reset zoom to initial state
function resetZoom() {
    activeCountry.classed("active", false);
    activeCountry = d3.select(null);
    
    // Hide bar charts and bars layer
    barChartsContainer.style("display", "none");
    barsLayer.style("display", "none");
    
    // Clear info panel
    setInfoPanel(null);

    isZooming = true;
    svg.style("pointer-events", "none");
    tooltip.style("opacity", 0);
    
    svg.transition()
        .duration(750)
        .call(zoom.transform, d3.zoomIdentity)
        .on("end", () => {
            isZooming = false;
            svg.style("pointer-events", "auto");
        });
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
    setInfoPanel(d);

    // Update bar charts
    const titleYear = currentView === "singleEdition" ? currentYear : "Toutes Éditions";
    const titleSeason = currentView === "singleEdition" ? `, ${currentSeason}` : "";
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

    // Render in-map 3D-like bars at country's centroid
    const geometryForView = getMetropolitanGeometry(d) || d;
    const centroid = pathGenerator.centroid(geometryForView);

    // Basic sizing
    const baseMaxHeight = 40; // Smaller bars for heavy zoom
    const widthPerBar = 10;
    const gap = 6;
    const sideDX = 4;
    const sideDY = -4;

    const medalsH = Math.max(0, (countryData.medals / (maxMedals || 1)) * baseMaxHeight);
    const partsH = Math.max(0, (countryData.participations / (maxParticipants || 1)) * baseMaxHeight);

    const totalWidth = widthPerBar * 2 + gap;
    const x0 = centroid[0] - totalWidth / 2;
    const yBase = centroid[1];

    // Clear and draw
    barsLayer.selectAll("*").remove();

    const group = barsLayer.append("g");
    barsLayer.raise();

    const drawBar = (x, height, gradId, sideId) => {
		// Front face
		group.append("rect")
			.attr("x", x)
			.attr("y", yBase - height)
			.attr("width", widthPerBar)
			.attr("height", height)
			.attr("fill", `url(#${gradId})`)
			.attr("stroke", "#333")
			.attr("stroke-width", 0.5);

		// Side face (right)
		group.append("polygon")
			.attr("points", [
				[x + widthPerBar, yBase - height].join(","),
				[x + widthPerBar + sideDX, yBase - height + sideDY].join(","),
				[x + widthPerBar + sideDX, yBase + sideDY].join(","),
				[x + widthPerBar, yBase].join(",")
			].join(" "))
			.attr("fill", `url(#${sideId})`)
			.attr("stroke", "#333")
			.attr("stroke-width", 0.5);

		// Top face
		group.append("polygon")
			.attr("points", [
				[x, yBase - height].join(","),
				[x + widthPerBar, yBase - height].join(","),
				[x + widthPerBar + sideDX, yBase - height + sideDY].join(","),
				[x + sideDX, yBase - height + sideDY].join(",")
			].join(" "))
			.attr("fill", d3.color(gradId.includes("medals") ? "#007bff" : "#28a745").brighter(0.6))
			.attr("stroke", "#333")
			.attr("stroke-width", 0.5);
    };

    // Medals bar (left)
    drawBar(x0, medalsH, "medalsGrad", "medalsSide");
    // Participants bar (right)
    drawBar(x0 + widthPerBar + gap, partsH, "participantsGrad", "participantsSide");

    barsLayer.style("display", (medalsH > 0 || partsH > 0) ? "block" : "none");

    // Apply inverse-zoom transform so bars become smaller as we zoom in
    group.attr("transform", `translate(${centroid[0]},${centroid[1]}) scale(${1/currentZoomK}) translate(${-centroid[0]},${-centroid[1]})`);

    // Tooltip over bars
    const breakdown = getMedalBreakdown(d.id);
    const ratioPop = countryData.ratioMedalPop > 0 ? (countryData.ratioMedalPop * 100000).toFixed(2) : "N/D";
    const ratioPart = countryData.ratioMedalPart > 0 ? countryData.ratioMedalPart.toFixed(2) : "N/D";
    const valueText = [
        `Participations JO${currentView === "allEditions" ? " (Total)" : ""}: ${countryData.participationsCount}`,
        `Participants${currentView === "allEditions" ? " (Total)" : ""}: ${countryData.participations}`,
        `Médailles: ${countryData.medals}`,
        `Or: ${breakdown.gold} | Argent: ${breakdown.silver} | Bronze: ${breakdown.bronze}`,
        `Ratio Médaille/Pop (100k): ${ratioPop}`,
        `Ratio Médaille/Participants: ${ratioPart}`
    ].join("<br>");

    group
        .on("mouseover", function(evt) {
            if (isZooming) return;
            // Show detailed bars tooltip
            tooltip.style("opacity", 1)
                .html(`<b>${d.properties.name}</b><br>${valueText}`);
            mouseMove(evt);
            setInfoPanel(d);
        })
        .on("mousemove", function(evt) { 
            if (isZooming) return; 
            mouseMove(evt); 
        })
        .on("mouseleave", function() { 
            if (isZooming) return; 
            tooltip.style("opacity", 0); 
        });

    // Zoom logic
    const bounds = pathGenerator.bounds(geometryForView);
    const dx = bounds[1][0] - bounds[0][0];
    const dy = bounds[1][1] - bounds[0][1];
    const x = (bounds[0][0] + bounds[1][0]) / 2;
    const y = (bounds[0][1] + bounds[1][1]) / 2; // <-- CORRIGÉ ICI
    const scale = Math.max(1, Math.min(8, 0.9 / Math.max(dx / width, dy / height)));
    const translate = [width / 2 - scale * x, height / 2 - scale * y];

    isZooming = true;
    svg.style("pointer-events", "none");
    tooltip.style("opacity", 0);
    svg.transition()
        .duration(750)
        .call(
            zoom.transform,
            d3.zoomIdentity.translate(translate[0], translate[1]).scale(scale)
        )
        .on("end", () => {
            isZooming = false;
            svg.style("pointer-events", "auto");
        });
}

// Choose metropolitan geometry for countries with overseas territories (e.g., France)
function getMetropolitanGeometry(feature) {
	// Handle only FRA explicitly for now
	if (feature && feature.id === "FRA" && feature.geometry) {
		const geom = feature.geometry;
		if (geom.type === "MultiPolygon") {
			// Prefer polygon whose centroid lies in Western Europe lat/lon window
			const europeWindow = { lonMin: -10, lonMax: 10, latMin: 35, latMax: 55 };
			let bestPoly = null;
			for (const poly of geom.coordinates) {
				const tmpFeature = { type: "Feature", properties: feature.properties, id: feature.id, geometry: { type: "Polygon", coordinates: poly } };
				const c = projection.invert(pathGenerator.centroid(tmpFeature));
				if (!c) continue;
				const [lon, lat] = c;
				if (lon >= europeWindow.lonMin && lon <= europeWindow.lonMax && lat >= europeWindow.latMin && lat <= europeWindow.latMax) {
					bestPoly = tmpFeature;
					break;
				}
			}
			if (bestPoly) return bestPoly;
			// Fallback: choose largest area polygon
			let maxArea = -Infinity;
			let largest = null;
			for (const poly of geom.coordinates) {
				const tmp = { type: "Feature", properties: feature.properties, id: feature.id, geometry: { type: "Polygon", coordinates: poly } };
				const a = Math.abs(d3.geoArea(tmp));
				if (a > maxArea) { maxArea = a; largest = tmp; }
			}
			return largest || feature;
		}
	}
	return feature;
}

// Mouseover for tooltip
function mouseOver(event, d) {
    if (isZooming) return;
    tooltip.style("opacity", 1);
    
    // Remove contours from others and highlight the hovered
    g.selectAll("path.Country").style("stroke", "none");
    d3.select(this)
        .transition()
        .duration(200)
        .style("opacity", 1)
        .style("stroke", "#333")
        .style("stroke-width", "1.5px");

    const countryName = d.properties.name;

    // Tooltip: only country name (bars will override with details)
    tooltip.html(`<b>${countryName}</b>`);
    
    // Use mouseMove for smart positioning
    mouseMove(event);

    // Update bottom-right info panel with full details
    setInfoPanel(d);
}

function mouseMove(event) {
    if (isZooming) return;
    
    // Smart positioning to avoid going off-screen
    const tooltipNode = tooltip.node();
    if (!tooltipNode) return;
    
    const tooltipWidth = tooltipNode.offsetWidth;
    const tooltipHeight = tooltipNode.offsetHeight;
    const padding = 10;
    
    let left = event.pageX + 20;
    let top = event.pageY - 28;
    
    // Adjust horizontal position if tooltip would go off right edge
    if (left + tooltipWidth > window.innerWidth - padding) {
        left = event.pageX - tooltipWidth - 20;
    }
    
    // Adjust vertical position if tooltip would go off bottom edge
    if (top + tooltipHeight > window.innerHeight - padding) {
        top = window.innerHeight - tooltipHeight - padding;
    }
    
    // Ensure tooltip doesn't go off top edge
    if (top < padding) {
        top = padding;
    }
    
    tooltip
        .style("left", left + "px")
        .style("top", top + "px");
}

// Mouseleave for tooltip
function mouseLeave() {
    if (isZooming) return;
    tooltip.style("opacity", 0);
    
    // Only reset stroke if not the active (zoomed) country
    if (activeCountry.node() !== this) {
        d3.select(this)
            .transition()
            .duration(200)
            .style("stroke", "none");
    }
    
    // Restore panel to active country if any, else clear
    if (!activeCountry.empty()) {
        setInfoPanel(activeCountry.datum());
    } else {
        setInfoPanel(null);
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

// Consolidated function to refresh view and update active country
function refreshViewAndActiveCountry() {
    refreshSingleEditionData(currentYear, currentSeason);
    updateMap();
    updateNavButtons();
    
    if (!activeCountry.empty()) {
        setInfoPanel(activeCountry.datum());
    }
}

// Handler for year slider changes
const handleYearChange = function() {
    const selected = +this.value;
    const availableYears = currentSeason === 'Summer' ? summerYears : winterYears;
    const closest = ops.findClosestYear(availableYears, selected);
    
    currentYear = closest;
    yearSlider.property('value', closest);
    yearDisplay.text(closest);
    currentView = 'singleEdition';
    
    d3.select('#allEditionsBtn').classed('active', false);
    toggleYearControls(true);
    refreshViewAndActiveCountry();
};

// Handle both input (drag) and click events on slider
yearSlider.on('input', debounce(handleYearChange, 100));
yearSlider.on('click', handleYearChange);

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
        toggleYearControls(true);
        refreshViewAndActiveCountry();
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
        toggleYearControls(true);
        refreshViewAndActiveCountry();
    }
});

// Setup season buttons
d3.selectAll(".season-btn[data-season]").on("click", function() {
    // Deactivate all buttons first
    d3.selectAll(".season-btn").classed("active", false);
    d3.select(this).classed("active", true);
    
    currentSeason = d3.select(this).attr("data-season");
    lastSingleEditionSeason = currentSeason; // Save last selected season
    currentView = "singleEdition";
    
    d3.select("#allEditionsBtn").classed("active", false);
    updateSliderForSeason(currentSeason);
    toggleYearControls(true);
    refreshViewAndActiveCountry();
});

// Add "All Editions" button and functionality
const controlsDiv = d3.select(".controls");
controlsDiv.append("div")
    .attr("class", "control-row")
    .html('<button class="season-btn" id="allEditionsBtn" data-view="allEditions">Toutes Éditions</button>');

d3.select("#allEditionsBtn").on("click", function() {
    // Toggle behavior: if already in "allEditions" view, go back to last season
    if (currentView === "allEditions") {
        // Return to last selected season view
        currentView = "singleEdition";
        currentSeason = lastSingleEditionSeason;
        
        // Deactivate all buttons and activate the correct season button
        d3.selectAll(".season-btn").classed("active", false);
        d3.select(`.season-btn[data-season="${currentSeason}"]`).classed("active", true);
        
        updateSliderForSeason(currentSeason);
        toggleYearControls(true);
        refreshViewAndActiveCountry();
    } else {
        // Switch to "allEditions" view
        d3.selectAll(".season-btn").classed("active", false);
        d3.select(this).classed("active", true);
        
        currentView = "allEditions";
        toggleYearControls(false);
        
        updateMap();
        if (!activeCountry.empty()) {
            setInfoPanel(activeCountry.datum());
        }
    }
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
        .style("stroke", "none")
        .style("stroke-width", 0.5)
        .style("opacity", 0.8)
        .style("cursor", "pointer")
        .on("mouseover", mouseOver)
        .on("mouseleave", mouseLeave)
        .on("mousemove", mouseMove)
        .on("click", countryClick);

    updateMap();
    generateLegend();

    d3.select(".season-btn[data-season='Summer']").classed("active", true);
    toggleYearControls(true);

    // Ensure bars layer stays on top of country paths once map is drawn
    barsLayer.raise();
}).catch(error => {
    console.error("Erreur lors du chargement ou traitement des données:", error);
});