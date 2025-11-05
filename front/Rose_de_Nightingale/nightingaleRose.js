let currentYear = 2016;
let currentSeason = 'both';
let currentContinent = 'all';

const tooltip = d3.select("#tooltip");
const viz = d3.select("#visualization");
const infoPanel = d3.select("#info-panel");

Promise.all([
    d3.dsv(";", "../../CSV_Dest/athlete_events_opti.csv"),
    d3.csv("../../CSV_Dest/population-1900-2016.csv")
]).then(([athleteData, populationData]) => {

    const athletes = athleteData.filter(d => d.Year && d.NOC && d.Season);

    const nocToContinent = new Map();
    const nocToCountry = new Map();
    const nocPopulation = new Map();

    populationData.forEach(d => {
        if (d.Code && d.Continent && d.Entity) {
            nocToContinent.set(d.Code, d.Continent);
            nocToCountry.set(d.Code, d.Entity);
            const key = `${d.Code}_${d.Year}`;
            nocPopulation.set(key, +d["Population (historical)"]);
        }
    });

    window.athleteData = athletes;
    window.nocToContinent = nocToContinent;
    window.nocToCountry = nocToCountry;
    window.nocPopulation = nocPopulation;

    updateVisualization();

    // Timeline
    d3.select("#timeline").on("input", function() {
        currentYear = +this.value;
        d3.select("#year-display").text(currentYear);
        updateVisualization();
    });

    // Filtres continents
    d3.selectAll(".filter-btn").on("click", function() {
        d3.selectAll(".filter-btn").classed("active", false);
        d3.select(this).classed("active", true);
        currentContinent = this.dataset.continent;
        updateVisualization();
    });

    // Saisons
    d3.selectAll(".season-btn").on("click", function() {
        d3.selectAll(".season-btn").classed("active", false);
        d3.select(this).classed("active", true);
        currentSeason = this.dataset.season;
        updateVisualization();
    });

}).catch(error => {
    console.error("Erreur:", error);
    viz.html(`<div class="loading" style="color: red;">Erreur: ${error.message}</div>`);
});

function updateVisualization() {
    viz.html("");

    let countries = getCountriesData(currentYear, currentSeason, currentContinent);

    if (countries.length === 0) {
        const seasonText = currentSeason === 'both' ? 'Été + Hiver' :
            currentSeason === 'Summer' ? "Été" : "Hiver";
        const continentText = currentContinent === 'all' ? 'le monde entier' : currentContinent;

        viz.html(`<div class="no-data">
                    ❌ Aucun Jeux Olympiques en ${currentYear}<br>
                    (${seasonText})<br>
                    pour ${continentText}
                </div>`);
        return;
    }

    drawNightingaleRose(countries);
}

function drawNightingaleRose(countries) {
    const width = viz.node().offsetWidth;
    const height = 900;


    const svg = viz.append("svg")
        .attr("width", width)
        .attr("height", height);

    const g = svg.append("g")
        .attr("transform", `translate(${width/2},${height/2})`);

    // Trier par ratio décroissant
    countries.sort((a, b) => b.medalRatio - a.medalRatio);

    // Échelle pour les rayons basée sur le ratio médailles/participations × 100
    const maxRatio = d3.max(countries, d => d.medalRatio);
    const maxRadius = 380;
    const minRadius = 50;

    const radiusScale = d3.scaleLinear()
        .domain([0, maxRatio])
        .range([minRadius, maxRadius]);

    const angleStep = (2 * Math.PI) / countries.length;

    // Échelle de couleur pour la population (logarithmique car grande amplitude)
    const popExtent = d3.extent(countries, d => d.population || 0);
    const popColorScale = d3.scaleSequentialLog()
        .domain(popExtent)
        .interpolator(d3.interpolateYlOrRd);



    countries.forEach((country, i) => {
        const startAngle = i * angleStep;
        const endAngle = (i + 1) * angleStep;
        const radius = radiusScale(country.medalRatio);
        const color = popColorScale(country.population || 1);
        // Une seule pétale avec couleur basée sur le ratio
        g.append("path")
            .attr("class", "petal")
            .attr("d", d3.arc()
                .innerRadius(0)
                .outerRadius(radius)
                .startAngle(startAngle)
                .endAngle(endAngle)
            )
            .attr("fill", color)
            .on("mouseover", (event) => showTooltip(event, country))
            .on("mouseout", () => tooltip.style("opacity", 0))
            .on("mousemove", (event) => {
                tooltip
                    .style("left", (event.pageX + 15) + "px")
                    .style("top", (event.pageY - 15) + "px");
            });

        // Labels (si pas trop de pays)
        if (countries.length <= 50) {
            const midAngle = (startAngle + endAngle) / 2;
            const labelRadius = radius + 15;
            const x = Math.cos(midAngle - Math.PI / 2) * labelRadius;
            const y = Math.sin(midAngle - Math.PI / 2) * labelRadius;
            const rotation = (midAngle * 180 / Math.PI);

            g.append("text")
                .attr("class", "country-label")
                .attr("x", x)
                .attr("y", y)
                .attr("transform", `rotate(${rotation}, ${x}, ${y})`)
                .text(country.name.length > 12 ? country.noc : country.name);
        }
    });
    // Légende pour la population
    const legendWidth = 200;
    const legendHeight = 12;

    const legendSvg = svg.append("g")
        .attr("transform", `translate(${width / 2 - legendWidth / 2}, ${height * 0.85})`);


    const defs = legendSvg.append("defs");
    const linearGradient = defs.append("linearGradient")
        .attr("id", "pop-gradient");

    linearGradient.selectAll("stop")
        .data(d3.ticks(0, 1, 10))
        .enter()
        .append("stop")
        .attr("offset", d => `${d * 100}%`)
        .attr("stop-color", d => popColorScale(
            popExtent[0] * Math.pow(popExtent[1] / popExtent[0], d)
        ));

    legendSvg.append("rect")
        .attr("x", 40)
        .attr("y", 20)
        .attr("width", legendWidth)
        .attr("height", legendHeight)
        .style("fill", "url(#pop-gradient)")
        .style("stroke", "#ccc")
        .style("rx", 4);

    const legendScale = d3.scaleLog()
        .domain(popExtent)
        .range([40, 40 + legendWidth]);

    const legendAxis = d3.axisBottom(legendScale)
        .ticks(5, "~s");

    legendSvg.append("g")
        .attr("transform", "translate(0, 35)")
        .call(legendAxis)
        .selectAll("text")
        .style("font-size", "10px")
        .style("fill", "#4a5568");

    legendSvg.append("text")
        .attr("x", legendWidth / 2 + 40)
        .attr("y", 10)
        .attr("text-anchor", "middle")
        .style("fill", "#4a5568")
        .style("font-size", "12px")
        .style("font-weight", "600")
        .text("Population du pays");

    // Label central
    const title = currentContinent === 'all' ? 'Monde' : currentContinent;
    g.append("text")
        .attr("class", "center-label")
        .attr("y", -20)
        .text(title);

    const totalMedals = d3.sum(countries, d => d.gold + d.silver + d.bronze);
    const totalParticipations = d3.sum(countries, d => d.total);
    const avgRatio = ((totalMedals / totalParticipations) * 100).toFixed(1);

    g.append("text")
        .attr("class", "center-stats")
        .attr("y", 5)
        .text(`${countries.length} pays`);

    g.append("text")
        .attr("class", "center-stats")
        .attr("y", 23)
        .text(`${totalMedals} médailles`);

    g.append("text")
        .attr("class", "center-stats")
        .attr("y", 41)
        .text(`Ratio moyen: ${avgRatio}%`);
}

function showTooltip(event, country) {
    const totalMedals = country.gold + country.silver + country.bronze;
    const goldRate = ((country.gold / country.total) * 100).toFixed(1);
    const silverRate = ((country.silver / country.total) * 100).toFixed(1);
    const bronzeRate = ((country.bronze / country.total) * 100).toFixed(1);
    const medalRate = country.medalRatio.toFixed(1);

    tooltip.style("opacity", 1)
        .html(`
                    <strong>${country.name} (${country.noc})</strong>
                    <div class="medal-row"><span>🥇 Or:</span> <span>${country.gold} <em>(${goldRate}%)</em></span></div>
                    <div class="medal-row"><span>🥈 Argent:</span> <span>${country.silver} <em>(${silverRate}%)</em></span></div>
                    <div class="medal-row"><span>🥉 Bronze:</span> <span>${country.bronze} <em>(${bronzeRate}%)</em></span></div>
                    <div class="medal-row"><span>Total médailles:</span> <span class="highlight">${totalMedals}</span></div>
                    <div class="medal-row"><span>Participations:</span> <span>${country.total}</span></div>
                    <div class="medal-row"><span>Taux de médailles:</span> <span class="highlight">${medalRate}%</span></div>
                    <div class="medal-row"><span>Population:</span> <span>${country.population ? d3.format(",")(country.population) : 'N/A'}</span></div>
                `);
}

function getCountriesData(year, season, continent) {
    const countryData = new Map();

    window.athleteData.forEach(d => {
        if (+d.Year !== year) return;
        if (season !== 'both' && d.Season !== season) return;

        const noc = d.NOC;
        const countryContinent = window.nocToContinent.get(noc);
        if (!countryContinent) return;
        if (continent !== 'all' && countryContinent !== continent) return;

        if (!countryData.has(noc)) {
            countryData.set(noc, {
                noc: noc,
                name: window.nocToCountry.get(noc) || noc,
                continent: countryContinent,
                gold: 0,
                silver: 0,
                bronze: 0,
                total: 0,
                population: window.nocPopulation.get(`${noc}_${year}`) || 0
            });
        }

        const entry = countryData.get(noc);
        entry.total++;

        const medal = d.Medal ? d.Medal.trim() : '';
        if (medal === 'Gold') entry.gold++;
        else if (medal === 'Silver') entry.silver++;
        else if (medal === 'Bronze') entry.bronze++;
    });

    // Calculer les ratios
    const result = [];
    countryData.forEach(country => {
        const totalMedals = country.gold + country.silver + country.bronze;
        country.medalRatio = (totalMedals / country.total) * 100; // ×100 pour visibilité
        result.push(country);
    });

    return result;
}