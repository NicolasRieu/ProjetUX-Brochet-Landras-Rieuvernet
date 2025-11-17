let currentYear = 2016;
let currentSeason = 'both';
let currentContinent = 'all';
let selectedCountries = [];
let currentZoom = 1.3;
let panX = 0;
let panY = 0;
let isDragging = false;
let dragStart = { x: 0, y: 0 };

let athleteData = [];
let nocToContinent = new Map();
let nocToCountry = new Map();
let nocPopulation = new Map();
let currentSvg = null;

const viz = d3.select("#visualization");
const countriesList = d3.select("#countries-list");
const tooltip = d3.select("#tooltip");

function getCountryFlagEmoji(code) {
    if (!code || code.length !== 2) return '🏳️';
    const codePoints = code.toUpperCase().split('').map(c => 127397 + c.charCodeAt(0));
    return String.fromCodePoint(...codePoints);
}

function getPopulationCategory(pop) {
    pop = +pop || 0;
    if (pop < 1000000) return 0;
    if (pop < 10000000) return 1;
    if (pop < 100000000) return 2;
    if (pop < 1000000000) return 3;
    return 4;
}

function getCategoryLabel(cat) {
    const labels = ["< 1M", "1-10M", "10-100M", "100M-1B", "> 1B"];
    return labels[cat];
}

function getCategoryColor(cat) {
    const colors = ["#fdd835", "#fb8c00", "#e53935", "#c62828", "#6a1b9a"];
    return colors[cat];
}

function getCountriesData(year, season, continent) {
    const countryData = new Map();
    const participatingAthletes = new Map();

    athleteData.forEach(d => {
        if (+d.Year !== year) return;
        if (season !== 'both' && d.Season !== season) return;

        const noc = d.NOC;
        const countryContinent = nocToContinent.get(noc);
        if (!countryContinent) return;
        if (continent !== 'all' && countryContinent !== continent) return;

        if (!countryData.has(noc)) {
            countryData.set(noc, {
                noc: noc,
                name: nocToCountry.get(noc) || noc,
                continent: countryContinent,
                gold: 0,
                silver: 0,
                bronze: 0,
                total: 0,
                population: nocPopulation.get(`${noc}_${year}`) || 0
            });
        }

        if (!participatingAthletes.has(noc)) {
            participatingAthletes.set(noc, new Set());
        }
        participatingAthletes.get(noc).add(d.ID);

        const entry = countryData.get(noc);
        const medal = d.Medal ? d.Medal.trim() : '';
        if (medal === 'Gold') entry.gold++;
        else if (medal === 'Silver') entry.silver++;
        else if (medal === 'Bronze') entry.bronze++;
    });

    const result = [];
    countryData.forEach(country => {
        country.total = participatingAthletes.get(country.noc).size;
        const totalMedals = country.gold + country.silver + country.bronze;
        country.medalRatio = country.total > 0 ? (totalMedals / country.total) * 100 : 0;
        country.popCategory = getPopulationCategory(country.population);
        if (totalMedals > 0) result.push(country);
    });

    return result.sort((a, b) => b.medalRatio - a.medalRatio);
}

function drawCountriesList(countries) {
    countriesList.selectAll(".country-item").remove();
    countriesList.selectAll(".country-item")
        .data(countries)
        .enter()
        .append("div")
        .attr("class", "country-item")
        .classed("selected", d => selectedCountries.includes(d.noc))
        .html(d => {
            const flag = getCountryFlagEmoji(d.noc.substring(0, 2).toLowerCase());
            const medals = d.gold + d.silver + d.bronze;
            return `<div class="country-flag">${flag}</div>
                        <div class="country-name" title="${d.name}">${d.name}</div>
                        <div class="country-medals">${medals}</div>`;
        })
        .on("click", function(e, d) {
            const idx = selectedCountries.indexOf(d.noc);
            if (idx > -1) {
                selectedCountries.splice(idx, 1);
            } else {
                if (selectedCountries.length < 8) {
                    selectedCountries.push(d.noc);
                }
            }
            updateVisualization();
        })
        .on("mouseenter", function(e, d) {
            countriesList.selectAll(".country-item").classed("hover", false);
            d3.select(this).classed("hover", true);
            if (currentSvg) {
                currentSvg.selectAll(".rose-petal").classed("faded", p => p.noc !== d.noc);
            }
        })
        .on("mouseleave", function() {
            if (currentSvg) {
                currentSvg.selectAll(".rose-petal").classed("faded", false);
            }
        });
}

function drawNightingaleRose(countries) {
    viz.selectAll("svg").remove();

    const container = viz.node();
    const width = container.offsetWidth;
    const height = container.offsetHeight;

    const svg = viz.append("svg")
        .attr("width", width)
        .attr("height", height)
        .style("background", "transparent")
        .style("margin-top", "150px");

    currentSvg = svg;

    const g = svg.append("g")
        .attr("class", "main-group")
        .attr("transform", `translate(${width/2 + panX},${height/2 + panY}) scale(${currentZoom})`);

    const sortedCountries = countries.sort((a, b) => b.medalRatio - a.medalRatio);

    const petals = [];
    const maxRatio = d3.max(sortedCountries, d => d.medalRatio);
    const maxRadius = Math.min(width, height) * 0.35;

    sortedCountries.forEach((country, idx) => {
        petals.push({
            noc: country.noc,
            name: country.name,
            gold: country.gold,
            silver: country.silver,
            bronze: country.bronze,
            medals: country.gold + country.silver + country.bronze,
            medalRatio: country.medalRatio,
            population: country.population,
            popCategory: country.popCategory,
            popLabel: getCategoryLabel(country.popCategory),
            angle: (idx / sortedCountries.length) * 2 * Math.PI,
            radius: (country.medalRatio / maxRatio) * maxRadius,
            color: getCategoryColor(country.popCategory),
            index: idx
        });
    });

    const rings = [5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55, 60, 65, 70, 75, 80, 85, 90, 95];

    rings.forEach(pct => {
        const r = (pct / 100) * maxRadius;
        g.append("circle")
            .attr("r", r)
            .attr("fill", "none")
            .attr("stroke", "#e2e8f0")
            .attr("stroke-width", 0.3)
            .attr("stroke-dasharray", "1,1");

        if (pct % 10 === 0) {
            g.append("text")
                .attr("x", r + 4)
                .attr("y", -4)
                .attr("font-size", "7px")
                .attr("fill", "#cbd5e0")
                .attr("font-weight", "600")
                .text(`${pct}%`);
        }
    });

    const arc = d3.arc()
        .innerRadius(0)
        .outerRadius(d => d.radius)
        .startAngle((d, i) => {
            const totalAngle = 2 * Math.PI / petals.length;
            return i * totalAngle - totalAngle / 2;
        })
        .endAngle((d, i) => {
            const totalAngle = 2 * Math.PI / petals.length;
            return (i + 1) * totalAngle - totalAngle / 2;
        });

    g.selectAll(".rose-petal")
        .data(petals)
        .enter()
        .append("path")
        .attr("class", "rose-petal")
        .attr("d", arc)
        .attr("fill", d => d.color)
        .classed("highlighted", d => selectedCountries.includes(d.noc))
        .on("mouseover", function(e, d) {
            d3.select(this).classed("highlighted", true);
            tooltip.classed("visible", true)
                .html(`<strong>${d.name}</strong><br/>
Population: ${(d.population / 1e6).toFixed(1)}M (${d.popLabel})<br/>
🥇 Or: ${d.gold} | 🥈 Silver: ${d.silver} | 🥉 Bronze: ${d.bronze}<br/>
Total: ${d.medals} médailles sur ${d.total} athlètes<br/>
Réussite: ${d.medalRatio.toFixed(2)}%`);
        })
        .on("mousemove", function(e) {
            tooltip.style("left", (e.pageX + 10) + "px")
                .style("top", (e.pageY - 10) + "px");
        })
        .on("mouseout", function(e, d) {
            if (!selectedCountries.includes(d.noc)) {
                d3.select(this).classed("highlighted", false);
            }
            tooltip.classed("visible", false);
        })
        .on("click", function(e, d) {
            const idx = selectedCountries.indexOf(d.noc);
            if (idx > -1) {
                selectedCountries.splice(idx, 1);
            } else {
                if (selectedCountries.length < 8) {
                    selectedCountries.push(d.noc);
                }
            }
            updateVisualization();
        });

    petals.forEach((petal, idx) => {
        const totalAngle = 2 * Math.PI / petals.length;
        const midAngle = (idx + 0.5) * totalAngle - Math.PI / 2;
        const labelRadius = petal.radius + 22;

        const x = Math.cos(midAngle) * labelRadius;
        const y = Math.sin(midAngle) * labelRadius;

        g.append("text")
            .attr("class", "rose-label")
            .attr("x", x)
            .attr("y", y)
            .attr("text-anchor", "middle")
            .attr("font-size", "8px")
            .attr("font-weight", "600")
            .attr("fill", petal.color)
            .text(petal.name.substring(0, 12));
    });

    const legend = svg.append("g")
        .attr("transform", `translate(8, 15)`);

    legend.append("text")
        .attr("font-size", "10px")
        .attr("font-weight", "700")
        .attr("fill", "#2d3748")
        .text("Population:");

    const categories = [0, 1, 2, 3, 4];
    categories.forEach((cat, idx) => {
        legend.append("rect")
            .attr("x", 0)
            .attr("y", 18 + idx * 20)
            .attr("width", 12)
            .attr("height", 12)
            .attr("fill", getCategoryColor(cat));

        legend.append("text")
            .attr("x", 16)
            .attr("y", 27 + idx * 20)
            .attr("font-size", "9px")
            .attr("fill", "#4a5568")
            .text(getCategoryLabel(cat));
    });

    svg.on("wheel", function(e) {
        e.preventDefault();
        const zoomFactor = e.deltaY > 0 ? 0.9 : 1.1;
        currentZoom = Math.max(1.3, Math.min(currentZoom * zoomFactor, 4));
        updateGraphicTransform();
    });

    let lastDistance = 0;
    svg.on("touchstart", function(e) {
        if (e.touches.length === 2) {
            const dx = e.touches[0].clientX - e.touches[1].clientX;
            const dy = e.touches[0].clientY - e.touches[1].clientY;
            lastDistance = Math.sqrt(dx * dx + dy * dy);
        } else {
            isDragging = true;
            dragStart = { x: e.touches[0].clientX, y: e.touches[0].clientY };
        }
    });

    svg.on("touchmove", function(e) {
        if (e.touches.length === 2) {
            const dx = e.touches[0].clientX - e.touches[1].clientX;
            const dy = e.touches[0].clientY - e.touches[1].clientY;
            const distance = Math.sqrt(dx * dx + dy * dy);
            if (lastDistance > 0) {
                const zoomFactor = distance / lastDistance;
                currentZoom = Math.max(1.3, Math.min(currentZoom * zoomFactor, 4));
                updateGraphicTransform();
            }
            lastDistance = distance;
        } else if (isDragging) {
            panX += e.touches[0].clientX - dragStart.x;
            panY += e.touches[0].clientY - dragStart.y;
            dragStart = { x: e.touches[0].clientX, y: e.touches[0].clientY };
            updateGraphicTransform();
        }
    });

    svg.on("touchend", function() {
        isDragging = false;
        lastDistance = 0;
    });

    svg.on("mousedown", function(e) {
        isDragging = true;
        dragStart = { x: e.clientX, y: e.clientY };
    });

    svg.on("mousemove", function(e) {
        if (isDragging) {
            panX += e.clientX - dragStart.x;
            panY += e.clientY - dragStart.y;
            dragStart = { x: e.clientX, y: e.clientY };
            updateGraphicTransform();
        }
    });

    svg.on("mouseup", function() {
        isDragging = false;
    });

    svg.on("mouseleave", function() {
        isDragging = false;
    });

    function updateGraphicTransform() {
        svg.select(".main-group")
            .attr("transform", `translate(${width/2 + panX},${height/2 + panY}) scale(${currentZoom})`);
    }
}

function updateVisualization() {
    viz.selectAll("*").remove();
    countriesList.selectAll(".country-item").classed("selected", d => selectedCountries.includes(d.noc));

    const allCountries = getCountriesData(currentYear, currentSeason, currentContinent);

    if (allCountries.length === 0) {
        const seasonText = currentSeason === 'both' ? 'Été + Hiver' :
            currentSeason === 'Summer' ? "Été" : "Hiver";
        const continentText = currentContinent === 'all' ? 'le monde entier' : currentContinent;

        viz.html(`<div class="no-data">
                ❌ Aucun Jeux Olympiques en ${currentYear}<br>
                (${seasonText}) pour ${continentText}
            </div>`);
        return;
    }

    currentZoom = 1.3;
    panX = 0;
    panY = 0;
    drawCountriesList(allCountries);
    drawNightingaleRose(allCountries);
}

async function loadData() {
    try {
        const [athleteDataRaw, populationData] = await Promise.all([
            d3.dsv(";", "../../CSV_Dest/athlete_events_opti.csv"),
            d3.csv("../../CSV_Dest/population-1900-2016.csv")
        ]);

        athleteData = athleteDataRaw.filter(d => d.Year && d.NOC && d.Season);

        populationData.forEach(d => {
            if (d.Code && d.Continent && d.Entity) {
                nocToContinent.set(d.Code, d.Continent);
                nocToCountry.set(d.Code, d.Entity);
                const key = `${d.Code}_${d.Year}`;
                nocPopulation.set(key, +d["Population (historical)"]);
            }
        });

        updateVisualization();

        d3.selectAll(".continent-btn").on("click", function() {
            d3.selectAll(".continent-btn").classed("active", false);
            d3.select(this).classed("active", true);
            currentContinent = d3.select(this).attr("data-value");
            selectedCountries = [];
            updateVisualization();
        });

        d3.selectAll(".season-btn").on("click", function() {
            d3.selectAll(".season-btn").classed("active", false);
            d3.select(this).classed("active", true);
            currentSeason = d3.select(this).attr("data-value");
            selectedCountries = [];
            updateVisualization();
        });

        d3.select("#timeline").on("input", function() {
            currentYear = +this.value;
            d3.select("#year-display").text(currentYear);
            selectedCountries = [];
            updateVisualization();
        });

    } catch (error) {
        console.error("Erreur:", error);
        viz.html(`<div class="loading" style="color: red;">Erreur: ${error.message}</div>`);
    }
}

loadData();