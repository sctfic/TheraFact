
// js/dashboard.js
import * as dom from './dom.js';
import * as state from './state.js';

function getPeriodStartDate(dateStr, periodType) {
    if (!dateStr) return null;
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return null;
    d.setHours(0, 0, 0, 0); 
    if (periodType === 'day') return d;
    else if (periodType === 'week') { 
        const dayOfWeek = d.getDay(); 
        const diff = d.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1); // Lundi comme premier jour
        return new Date(d.setDate(diff)); 
    } 
    else if (periodType === 'month') return new Date(d.getFullYear(), d.getMonth(), 1);
    else if (periodType === 'quarter') { 
        const quarter = Math.floor(d.getMonth() / 3); 
        return new Date(d.getFullYear(), quarter * 3, 1); 
    } 
    else if (periodType === 'year') return new Date(d.getFullYear(), 0, 1);
    return d; 
}

function formatPeriodForDisplay(date, periodType) {
    const d = new Date(date);
    if (periodType === 'day') return d3.timeFormat("%d/%m/%y")(d);
    if (periodType === 'week') return `S${d3.timeFormat("%W-%Y")(d)}`; // Semaine de l'année
    if (periodType === 'month') return d3.timeFormat("%b %Y")(d); // Mois Année (Jan 2023)
    if (periodType === 'quarter') return `T${Math.floor(d.getMonth() / 3) + 1} ${d.getFullYear()}`; // Trimestre Année
    if (periodType === 'year') return d3.timeFormat("%Y")(d); // Année
    return d.toLocaleDateString(); 
}

function prepareChartData(allSeances, periodType) {
    if (!allSeances || allSeances.length === 0) return [];
    const aggregatedData = {};

    allSeances.forEach(seance => {
        const montantFacture = parseFloat(seance.montant_facture || 0);
        // Agrégation par date de séance pour le nombre de séances
        if (seance.date_heure_seance) {
            const sessionDate = new Date(seance.date_heure_seance);
            if (!isNaN(sessionDate.getTime())) {
                const sessionPeriodStart = getPeriodStartDate(sessionDate, periodType);
                if (sessionPeriodStart) {
                    const sessionPeriodKey = sessionPeriodStart.toISOString().slice(0, 10); 
                    if (!aggregatedData[sessionPeriodKey]) {
                        aggregatedData[sessionPeriodKey] = { 
                            periodDate: sessionPeriodStart, 
                            periodLabel: formatPeriodForDisplay(sessionPeriodStart, periodType), 
                            cancelledSessions: 0, 
                            paidSessions: 0, 
                            toPaySessions: 0, 
                            plannedSessions: 0, 
                            paidAmount: 0 
                        };
                    }
                    if (seance.statut_seance === 'ANNULEE') aggregatedData[sessionPeriodKey].cancelledSessions += 1;
                    else if (seance.statut_seance === 'PAYEE') aggregatedData[sessionPeriodKey].paidSessions += 1;
                    else if (seance.statut_seance === 'APAYER') aggregatedData[sessionPeriodKey].toPaySessions += 1;
                    else if (seance.statut_seance === 'PLANIFIEE') aggregatedData[sessionPeriodKey].plannedSessions += 1;
                }
            }
        }
        // Agrégation par date de paiement pour le montant payé
        if (seance.statut_seance === 'PAYEE' && seance.date_paiement) {
            const paymentDate = new Date(seance.date_paiement);
             if (!isNaN(paymentDate.getTime())) {
                const paymentPeriodStart = getPeriodStartDate(paymentDate, periodType);
                if (paymentPeriodStart) {
                    const paymentPeriodKey = paymentPeriodStart.toISOString().slice(0, 10);
                    if (!aggregatedData[paymentPeriodKey]) { // S'assurer que la période existe
                        aggregatedData[paymentPeriodKey] = { 
                            periodDate: paymentPeriodStart, 
                            periodLabel: formatPeriodForDisplay(paymentPeriodStart, periodType), 
                            cancelledSessions: 0, 
                            paidSessions: 0, 
                            toPaySessions: 0, 
                            plannedSessions: 0, 
                            paidAmount: 0 
                        };
                    }
                    if (!isNaN(montantFacture)) aggregatedData[paymentPeriodKey].paidAmount += montantFacture;
                }
            }
        }
    });
    return Object.values(aggregatedData).sort((a, b) => a.periodDate - b.periodDate);
}

function renderSessionsTrendChart(chartData) {
    if(!dom.sessionsTrendChartContainer) return;
    dom.sessionsTrendChartContainer.innerHTML = ''; 
    if (!chartData || chartData.length === 0) {
        dom.sessionsTrendChartContainer.innerHTML = "<p style='text-align:center; padding-top: 20px; color:#666;'>Pas de données pour afficher le graphique.</p>"; return;
    }

    const containerWidth = dom.sessionsTrendChartContainer.clientWidth;
    if (containerWidth === 0) { // Si le conteneur n'est pas encore visible/dimensionné
        setTimeout(() => renderSessionsTrendChart(chartData), 100); 
        return; 
    }

    const margin = {top: 30, right: 70, bottom: 110, left: 60};
    const width = Math.max(0, containerWidth - margin.left - margin.right);
    const height = Math.max(0, 400 - margin.top - margin.bottom); // Hauteur fixe pour le graphique

    if (width <= 0 || height <= 0) { 
        dom.sessionsTrendChartContainer.innerHTML = "<p style='text-align:center; padding-top: 20px; color:#666;'>Espace insuffisant pour le graphique.</p>"; 
        return; 
    }

    const svg = d3.select(dom.sessionsTrendChartContainer).append("svg")
        .attr("width", width + margin.left + margin.right)
        .attr("height", height + margin.top + margin.bottom)
        .append("g")
        .attr("transform", `translate(${margin.left},${margin.top})`);

    const periods = chartData.map(d => d.periodLabel);
    const x = d3.scaleBand().domain(periods).range([0, width]).padding(0.2);

    const yCountsMax = d3.max(chartData, d => d.cancelledSessions + d.paidSessions + d.toPaySessions + d.plannedSessions) || 1;
    const yCounts = d3.scaleLinear().domain([0, yCountsMax]).nice().range([height, 0]);

    const yAmountsMax = d3.max(chartData, d => d.paidAmount) || 1; 
    const yAmounts = d3.scaleLinear().domain([0, yAmountsMax]).nice().range([height, 0]);

    // Axe X
    const xAxis = d3.axisBottom(x);
    svg.append("g")
        .attr("class", "axis axis--x")
        .attr("transform", `translate(0,${height})`)
        .call(xAxis)
        .selectAll("text")
            .style("text-anchor", "end")
            .attr("dx", "-.8em")
            .attr("dy", ".15em")
            .attr("transform", "rotate(-45)");

    // Axe Y Gauche (Nombre de Séances)
    svg.append("g")
        .attr("class", "axis axis--y-counts")
        .call(d3.axisLeft(yCounts))
        .append("text")
            .attr("fill", "#000")
            .attr("transform", "rotate(-90)")
            .attr("y", -margin.left + 15)
            .attr("x", -height/2)
            .attr("dy", "0.71em")
            .attr("text-anchor", "middle")
            .text("Nombre de Séances");

    // Axe Y Droite (Montant Payé)
    svg.append("g")
        .attr("class", "axis axis--y-amounts")
        .attr("transform", `translate(${width},0)`)
        .call(d3.axisRight(yAmounts))
        .append("text")
            .attr("fill", "#000")
            .attr("transform", "rotate(-90)")
            .attr("y", margin.right - 25) // Ajuster position pour éviter chevauchement
            .attr("x", -height/2)
            .attr("dy", "-0.71em") // Ajuster positionnement vertical
            .attr("text-anchor", "middle")
            .text("Montant Payé (€)");

    // Barres empilées pour les types de séances
    const stackKeys = ['plannedSessions', 'toPaySessions', 'paidSessions', 'cancelledSessions']; 
    const stack = d3.stack().keys(stackKeys);
    const stackedData = stack(chartData);
    const colorScale = d3.scaleOrdinal().domain(stackKeys).range(['#17a2b8', '#ffc107', '#28a745', '#dc3545']); 

    const tooltip = d3.select("body").append("div")
        .attr("class", "chart-tooltip") // Assurez-vous que cette classe est définie dans votre CSS
        .style("opacity", 0)
        .style("position", "absolute") // Nécessaire pour le positionnement
        .style("pointer-events", "none"); // Pour que la souris passe "à travers"

    const barGroups = svg.append("g")
      .selectAll("g")
      .data(stackedData)
      .enter().append("g")
        .attr("fill", d => colorScale(d.key))
        .attr("class", d => `bar-stack-${d.key}`); // Pour le ciblage par le tooltip

    barGroups.selectAll("rect")
      .data(d => d)
      .enter().append("rect")
        .attr("x", d => x(d.data.periodLabel))
        .attr("y", d => yCounts(d[1]))
        .attr("height", d => Math.max(0, yCounts(d[0]) - yCounts(d[1]))) // Math.max(0, ...) pour éviter les hauteurs négatives
        .attr("width", x.bandwidth())
        .on("mouseover", function(event, d) {
            const key = d3.select(this.parentNode).datum().key; // Obtient la clé de la pile (ex: 'plannedSessions')
            let count;
            let label;
            if (key === 'cancelledSessions') { count = d.data.cancelledSessions; label = 'Annulées';}
            else if (key === 'paidSessions') { count = d.data.paidSessions; label = 'Payées';}
            else if (key === 'toPaySessions') { count = d.data.toPaySessions; label = 'À Payer';}
            else if (key === 'plannedSessions') { count = d.data.plannedSessions; label = 'Planifiées';}
            
            tooltip.transition().duration(200).style("opacity", .9);
            tooltip.html(`<strong>${d.data.periodLabel}</strong><br/>Séances ${label}: ${count}`)
                .style("left", (event.pageX + 10) + "px") // Positionner à droite du curseur
                .style("top", (event.pageY - 28) + "px"); // Positionner au-dessus du curseur

            // Optionnel: Mettre en évidence la pile survolée
            svg.selectAll(".bar-stack-plannedSessions rect, .bar-stack-cancelledSessions rect, .bar-stack-paidSessions rect, .bar-stack-toPaySessions rect")
                .style("opacity", 0.3);
            svg.selectAll(`.bar-stack-${key} rect`) // Sélectionne toutes les barres de cette pile
                .filter(barData => barData.data.periodLabel === d.data.periodLabel) // Seulement la barre pour cette période
                .style("opacity", 1);
        })
        .on("mouseout", function() {
            tooltip.transition().duration(500).style("opacity", 0);
            // Rétablir l'opacité normale
            svg.selectAll(".bar-stack-plannedSessions rect, .bar-stack-cancelledSessions rect, .bar-stack-paidSessions rect, .bar-stack-toPaySessions rect")
                .style("opacity", 1);
        });

    // Ligne pour le montant payé
    const linePaidAmount = d3.line()
        .x(d => x(d.periodLabel) + x.bandwidth() / 2) // Centrer la ligne sur les barres
        .y(d => yAmounts(d.paidAmount))
        .defined(d => d.paidAmount !== undefined && d.paidAmount !== null); // Ne pas dessiner si données manquantes
    
    svg.append("path")
      .datum(chartData.map(d => ({...d, paidAmount: d.paidAmount || 0}))) // Assurer que paidAmount est 0 si undefined pour la ligne
      .attr("class", "line paid-amount-line")
      .attr("fill", "none")
      .attr("stroke", "#007bff")
      .attr("stroke-width", 2.5)
      .attr("d", linePaidAmount);

    // Points sur la ligne pour le montant payé
    svg.selectAll(".dot-paid-amount")
        .data(chartData.filter(d => d.paidAmount !== undefined && d.paidAmount !== null && d.paidAmount > 0)) // Seulement les points avec des données
        .enter().append("circle")
            .attr("class", "dot dot-paid-amount")
            .attr("cx", d => x(d.periodLabel) + x.bandwidth() / 2)
            .attr("cy", d => yAmounts(d.paidAmount))
            .attr("r", 5)
            .attr("fill", "#007bff")
            .attr("stroke", "white")
            .attr("stroke-width", 1.5)
            .on("mouseover", (event, d) => {
                tooltip.transition().duration(200).style("opacity", .9);
                tooltip.html(`<strong>${d.periodLabel}</strong><br/>Montant Payé: ${d.paidAmount.toFixed(2)}€`)
                    .style("left", (event.pageX + 10) + "px")
                    .style("top", (event.pageY - 28) + "px");
            })
            .on("mouseout", () => {
                tooltip.transition().duration(500).style("opacity", 0);
            });
    
    // Légende
    const legendData = [
        { color: '#17a2b8', text: "Planifiées" },
        { color: '#ffc107', text: "À Payer" },
        { color: '#28a745', text: "Payées" },
        { color: '#dc3545', text: "Annulées" },
        { color: "#007bff", text: "Montant Payé (€) (Ligne)" }
    ];

    const legendContainer = svg.append("g")
        .attr("class", "legend-container")
        .attr("transform", `translate(0, ${height + margin.bottom - 45})`); // Ajuster la position de la légende

    const legend = legendContainer.selectAll(".legend-item")
        .data(legendData)
        .enter().append("g")
            .attr("class", "legend-item")
            .attr("transform", (d, i) => `translate(${i * 130}, 0)`); // Espacement horizontal

    legend.append("rect")
        .attr("x", 0)
        .attr("y", 0) 
        .attr("width", 18)
        .attr("height", 18)
        .style("fill", d => d.color);

    legend.append("text")
        .attr("x", 24)
        .attr("y", 9)
        .attr("dy", ".35em")
        .style("text-anchor", "start")
        .style("font-size", "10px")
        .text(d => d.text);
}


export function updateDashboardStats() {
    if(dom.statClientsCount) dom.statClientsCount.textContent = state.clients.length;
    if(dom.statSeancesCount) dom.statSeancesCount.textContent = state.seances.length;
    
    const seancesPayees = state.seances.filter(s => s.statut_seance === 'PAYEE');
    if(dom.statSeancesPayees) dom.statSeancesPayees.textContent = seancesPayees.length;

    const now = new Date();
    const moisActuel = now.getMonth();
    const anneeActuelle = now.getFullYear();
    let caMoisEnCours = 0, caMoisPrecedent = 0, caAnneeEnCours = 0, caAnneePrecedente = 0;

    seancesPayees.forEach(seance => {
        if (!seance.date_paiement) return;
        const date = new Date(seance.date_paiement);
        const mois = date.getMonth();
        const annee = date.getFullYear();
        const montant = parseFloat(seance.montant_facture || 0);

        if (isNaN(montant)) return;

        if (annee === anneeActuelle) {
            caAnneeEnCours += montant;
            if (mois === moisActuel) caMoisEnCours += montant;
        }
        else if (annee === anneeActuelle - 1) caAnneePrecedente += montant;
        
        // Calcul du mois précédent
        let prevMonthDate = new Date(now);
        prevMonthDate.setMonth(now.getMonth() - 1); 
        // Gérer le cas où le mois précédent est dans l'année précédente (ex: Janvier -> Décembre N-1)
        if (annee === prevMonthDate.getFullYear() && mois === prevMonthDate.getMonth()) {
            caMoisPrecedent += montant;
        }
    });

    if(dom.caMoisEnCours) dom.caMoisEnCours.textContent = caMoisEnCours.toFixed(2);
    if(dom.caMoisPrecedent) dom.caMoisPrecedent.textContent = caMoisPrecedent.toFixed(2);
    if(dom.caAnneeEnCours) dom.caAnneeEnCours.textContent = caAnneeEnCours.toFixed(2);
    if(dom.caAnneePrecedente) dom.caAnneePrecedente.textContent = caAnneePrecedente.toFixed(2);
    
    // Afficher le graphique si la vue dashboard est active
    const viewDashboardEl = document.getElementById('viewDashboard'); // Assurez-vous que l'ID est correct
    if (viewDashboardEl && viewDashboardEl.classList.contains('active')) {
        displaySessionsTrendChart();
    }
}

export function displaySessionsTrendChart() {
    if (!state.seances) { 
        if (dom.sessionsTrendChartContainer) {
            dom.sessionsTrendChartContainer.innerHTML = "<p style='text-align:center; color:#666;'>Données séances non chargées.</p>";
        }
        return; 
    }
    const viewDashboardEl = document.getElementById('viewDashboard');
    if (!viewDashboardEl || !viewDashboardEl.classList.contains('active')) return; 
    
    const periodType = dom.chartPeriodSelector ? dom.chartPeriodSelector.value : 'month';
    const chartData = prepareChartData(state.seances, periodType);
    renderSessionsTrendChart(chartData);
}

export function initializeDashboard() {
    if (dom.chartPeriodSelector) {
        dom.chartPeriodSelector.addEventListener('change', displaySessionsTrendChart);
    }
    // updateDashboardStats sera appelé par switchView ou après les fetchs
}