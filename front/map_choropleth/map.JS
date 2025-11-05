// Les dimensions
const width = 960;
const height = 600;

// 1. Initialisation du SVG et du groupe <g>
const svg = d3.select("svg")
    .attr("width", width)
    .attr("height", height);

// Le groupe <g> conteneur de la carte. C'est LUI qui sera transformé par le zoom/panoramique.
const g = svg.append("g"); 

// 2. Définition des Fonctions de Zoom et Panoramique

// Fonction de rappel pour le zoom (molette/glisser)
function handleZoom(event) {
    g.attr("transform", event.transform);
}

// L'objet de comportement de zoom D3
const zoom = d3.zoom()
    .scaleExtent([1, 8]) // Limite l'échelle entre 1x (min) et 8x (max)
    .on("zoom", handleZoom); 

// Application du comportement de zoom à l'élément SVG principal
// svg.call(zoom); 


// 3. Définition de la Projection Géographique
const projection = d3.geoMercator()
    .scale(70)
    .center([0, 20])
    .translate([width / 2, height / 2]);

const pathGenerator = d3.geoPath().projection(projection);


// 4. Préparation des Données et de l'Échelle de Couleur
const data = new Map();
const colorScale = d3.scaleThreshold()
    .domain([100000, 1000000, 10000000, 30000000, 100000000, 500000000])
    .range(d3.schemeBlues[7]);

let active = d3.select(null); // Pour suivre l'état du pays actuellement zoomé
var tooltip = d3.select("body") 
    .append("div")
    .attr("id", "tooltip")
    .style("opacity", 0) // L'opacité doit être 0 au départ pour être invisible
    .style("position", "absolute") // Nécessaire pour positionner en coordonnées écran
    .style("background-color", "white")
    .style("border", "solid")
    .style("border-width", "1px")
    .style("border-radius", "5px")
    .style("padding", "10px")

// 5. Fonctions de Rappel (Mouse Over, Mouse Leave, Click)

// Fonction pour revenir à la vue complète (Dézoom)
function resetZoom() {
    active.classed("active", false); // Retire la classe active
    active = d3.select(null); // Réinitialise l'élément actif

    // Applique la transformation d'identité (translation 0, échelle 1)
    svg.transition()
        .duration(750)
        .call(
            zoom.transform,
            d3.zoomIdentity // Nouvelle transformation: translate(0, 0) scale(1)
        );
}

// Gestion du clic (Zoom au pays)
let mouseClick = function(event, d) {
    // Si on clique sur le pays déjà zoomé, on le dézoome
    if (active.node() === this) return resetZoom(); 
    
    // Mise à jour de l'élément actif
    active.classed("active", false);
    active = d3.select(this).classed("active", true);

    // Calcul de la boîte englobante (bounds) du pays cliqué
    const bounds = pathGenerator.bounds(d);
    
    // Calcul des dimensions de la boîte
    const dx = bounds[1][0] - bounds[0][0]; 
    const dy = bounds[1][1] - bounds[0][1]; 
    const x = (bounds[0][0] + bounds[1][0]) / 2; // Centre X
    const y = (bounds[0][1] + bounds[1][1]) / 2; // Centre Y
    
    // Calcul de l'échelle : ajustement pour remplir l'espace, max 8x
    const scale = Math.min(8, 0.9 / Math.max(dx / width, dy / height));
    
    // Calcul de la translation
    const translate = [width / 2 - scale * x, height / 2 - scale * y];

    // Application de la transformation (Zoom Programmé et Transitionnel)
    svg.transition()
        .duration(750) 
        .call( 
            zoom.transform, 
            d3.zoomIdentity.translate(translate[0], translate[1]).scale(scale)
        );
}

// Gestion du survol de la souris (Mouse Over)
let mouseOver = function(event, d) {
    tooltip.style("opacity", 1);

    d3.selectAll(".Country")
        .transition().duration(200).style("opacity", .5).style("stroke","transparent");

    d3.select(this)
        .transition().duration(200).style("opacity", 1).style("stroke", "black");
    
    const popValue = data.get(d.id) ? data.get(d.id).toLocaleString() : "N/D";
        tooltip.html(`Pays: <b>${d.properties.name}</b><br>Population: ${popValue}`)
        .style("left", (event.pageX + 20) + "px")
        .style("top", (event.pageY - 28) + "px");}

// Gestion du départ de la souris (Mouse Leave)
let mouseLeave = function(event, d) {
    tooltip.style("opacity", 0);
    // Ne change l'opacité que si ce n'est pas le pays zoomé
        d3.select(this)
            .transition().duration(200).style("stroke", "transparent");

        d3.selectAll(".Country")
            .transition().duration(200).style("opacity", .8).style("stroke", "transparent");

}
function mouseMove(d){
    tooltip
        .style("left", (d.pageX + 20) + "px")
        .style("top", (d.pageY - 28) + "px");
}
// Gestion du slider pour les années
/**
 * Initialise le curseur d'année et configure les écouteurs d'événements.
 * * @param {Array<number>} availableYears - Liste des années disponibles.
 * @param {number} initialYear - Année initiale à afficher (ex: 2016).
 * @param {string} currentSeason - La saison actuellement sélectionnée ('Summer' ou 'Winter').
 * @param {Function} updateChart - La fonction de rappel pour mettre à jour le graphique.
 */
function setupYearSlider(availableYears, initialYear, currentSeason, updateChart) {
    // 1. Sélection des éléments du DOM
    const yearSlider = d3.select("#yearSlider");
    const yearDisplay = d3.select("#yearDisplay");

    // Vérification rapide que les éléments existent
    if (yearSlider.empty() || yearDisplay.empty()) {
        console.error("Éléments #yearSlider ou #yearDisplay non trouvés.");
        return;
    }

    // 2. Initialisation des attributs du slider
    yearSlider
        .attr("min", d3.min(availableYears))
        .attr("max", d3.max(availableYears))
        // 'initialYear' doit être dans la liste des années disponibles pour une meilleure cohérence
        .property("value", initialYear); 

    // 3. Initialisation de l'affichage
    yearDisplay.text(initialYear);

    // 4. Ajout de l'écouteur d'événement
    yearSlider.on("input", function() {
        const selectedYear = +this.value; // Coercition de type en nombre

        // Trouver l'année disponible la plus proche de la valeur du curseur
        const closestYear = availableYears.reduce((prev, curr) => 
            Math.abs(curr - selectedYear) < Math.abs(prev - selectedYear) ? curr : prev
        );
        
        // Mise à jour de l'affichage
        yearDisplay.text(closestYear);
        
        // Mise à jour du graphique
        updateChart(closestYear, currentSeason);
    });
}

// 6. Chargement et Dessin des Données
Promise.all([
    d3.json("https://raw.githubusercontent.com/holtzy/D3-graph-gallery/master/DATA/world.geojson"),
    d3.csv("https://raw.githubusercontent.com/holtzy/D3-graph-gallery/master/DATA/world_population.csv", function(d) {
        data.set(d.code, +d.pop)
    })
]).then(function(loadData){
    let topo = loadData[0];

    // Dessin de la carte dans le groupe 'g'
    g.selectAll("path")
        .data(topo.features)
        .enter()
        .append("path")
        .attr("d", pathGenerator)
        // Attribution de la couleur selon la population
        .attr("fill", function (d) {
            d.total = data.get(d.id) || 0;
            return colorScale(d.total);
        })
        .style("stroke", "transparent")
        .attr("class", "Country")
        .style("opacity", .8)
        // Ajout des interactions
        .on("mouseover", mouseOver )
        .on("mouseleave", mouseLeave )
        .on("mousemove", mouseMove )
        .on("click", mouseClick );

})