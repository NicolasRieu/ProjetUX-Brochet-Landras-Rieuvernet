const svg = d3.select("#nightingale"),
    width = +svg.attr("width"),
    height = +svg.attr("height"),
    radius = Math.min(width, height) / 2 - 80;

const g = svg.append("g")
    .attr("transform", `translate(${width / 2},${height / 2})`);

const color = d3.scaleOrdinal(d3.schemeCategory10);

// Charger le CSV
d3.csv("../../CSV_Dest/population-1900-2016.csv").then(data => {

    // Filtrer uniquement l’année 2016
    data = data.filter(d => d.Year === "2016" && d["Population (historical)"]);

    // Convertir la population en nombre
    data.forEach(d => d.Population = +d["Population (historical)"]);

    // Trier par population décroissante
    data.sort((a, b) => b.Population - a.Population);

    const N = data.length;

    // Échelle d’angle pour tous les arcs collés
    const angle = d3.scaleBand()
        .domain(data.map(d => d.Entity))
        .range([0, 2 * Math.PI])
        .paddingInner(0);   // arcs collés

    const r = d3.scaleSqrt()
        .domain([0, d3.max(data, d => d.Population)])
        .range([0, radius]);

    const arc = d3.arc()
        .innerRadius(0)
        .outerRadius(d => r(d.Population))
        .startAngle(d => angle(d.Entity))
        .endAngle(d => angle(d.Entity) + angle.bandwidth())
        .padAngle(0);  // arcs collés mais pas nuls

    // Dessiner les arcs
    g.selectAll("path")
        .data(data)
        .enter()
        .append("path")
        .attr("fill", d => color(d.Entity))
        .attr("d", arc)
        .append("title")
        .text(d => `${d.Entity}: ${d3.format(",")(Math.round(d.Population))} hab.`);

    // Labels stylés
    g.selectAll(".label")
        .data(data)
        .enter()
        .append("text")
        .attr("class", "label")
        .attr("text-anchor", "middle")
        .style("font-size", "7px")
        .style("font-style", "italic")
        .style("font-weight", "bold")
        .attr("transform", d => {
            let a = (angle(d.Entity) + angle.bandwidth() / 2) * 180 / Math.PI - 90;
            let rOffset = r(d.Population) + 8;
            let rotation = a > 90 ? 180 : 0;
            return `rotate(${a}) translate(${rOffset},0) rotate(${rotation})`;
        })
        .text(d => d.Entity);
});
