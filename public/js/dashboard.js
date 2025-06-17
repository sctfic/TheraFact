// js/dashboard.js
import * as dom from './dom.js';
import * as state from './state.js';
import * as api from './api.js';
import { showToast } from './utils.js';

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
    // Tri chronologique sur periodDate
    return Object.values(aggregatedData).sort((a, b) => a.periodDate - b.periodDate);
}
// État global du graphique
let chartState = {
    allData: [],
    visibleData: [],
    startIndex: 0,
    visibleCount: 25,
    svg: null,
    chartContent: null,
    x: null,
    yCounts: null,
    yAmounts: null,
    tooltip: null,
    periodType: 'month' // Ajout de periodType, valeur par défaut 'month'
};
const margin = {top: 10, right: 60, bottom: 90, left: 40};

function renderSessionsTrendChart(chartData) {
    if (!dom.sessionsTrendChartContainer) return;
    
    // Stocker toutes les données triées par période (plus récent en dernier)
    chartState.allData = [...chartData].sort((a, b) => 
        a.periodLabel.localeCompare(b.periodLabel)
    );
    
    // Initialiser l'index de départ (25 dernières périodes)
    chartState.startIndex = Math.max(0, chartState.allData.length - chartState.visibleCount);
    updateVisibleData();
    
    // Vider le conteneur
    dom.sessionsTrendChartContainer.innerHTML = '';
    
    if (!chartData || chartData.length === 0) {
        dom.sessionsTrendChartContainer.innerHTML = "<p style='text-align:center; padding-top: 20px; color:#666;'>Pas de données pour afficher le graphique.</p>"; 
        return;
    }

    const containerWidth = dom.sessionsTrendChartContainer.clientWidth;
    if (containerWidth === 0) {
        setTimeout(() => renderSessionsTrendChart(chartData), 100); 
        return; 
    }

    const width = Math.max(0, containerWidth - margin.left - margin.right);
    const height = Math.max(0, 400 - margin.top - margin.bottom);

    if (width <= 0 || height <= 0) { 
        dom.sessionsTrendChartContainer.innerHTML = "<p style='text-align:center; padding-top: 20px; color:#666;'>Espace insuffisant pour le graphique.</p>"; 
        return; 
    }

    // Créer l'élément SVG principal
    const svgElement = d3.select(dom.sessionsTrendChartContainer)
        .append("svg")
        .attr("width", width + margin.left + margin.right)
        .attr("height", height + margin.top + margin.bottom);
    
    chartState.svg = svgElement.append("g")
        .attr("transform", `translate(${margin.left},${margin.top})`);

    // Créer le tooltip (une seule fois)
    if (!chartState.tooltip) {
        chartState.tooltip = d3.select("body").append("div")
            .attr("class", "chart-tooltip")
            .style("opacity", 0)
            .style("position", "absolute")
            .style("pointer-events", "none")
            .style("background", "rgba(255, 255, 255, 0.9)")
            .style("padding", "8px")
            .style("border-radius", "4px")
            .style("box-shadow", "0 2px 10px rgba(0,0,0,0.1)")
            .style("border", "1px solid #ddd")
            .style("font-size", "12px")
            .style("z-index", "10");
    }

    // Créer le clipping path
    svgElement.append("defs")
        .append("clipPath")
            .attr("id", "chart-clip")
        .append("rect")
            .attr("x", 0)
            .attr("y", 0)
            .attr("width", width)
            .attr("height", height);

    // Créer le groupe conteneur avec clipping
    chartState.chartContent = chartState.svg.append("g")
        .attr("class", "chart-content")
        .attr("clip-path", "url(#chart-clip)");

    // Initialiser les échelles
    const periods = chartState.visibleData.map(d => d.periodLabel);
    chartState.x = d3.scaleBand()
        .domain(periods)
        .range([0, width])
        .padding(0.2);

    const yCountsMax = d3.max(chartState.visibleData, d => 
        d.cancelledSessions + d.paidSessions + d.toPaySessions + d.plannedSessions
    ) || 1;
    
    chartState.yCounts = d3.scaleLinear()
        .domain([0, yCountsMax])
        .nice()
        .range([height, 0]);

    const yAmountsMax = d3.max(chartState.visibleData, d => d.paidAmount) || 1; 
    chartState.yAmounts = d3.scaleLinear()
        .domain([0, yAmountsMax])
        .nice()
        .range([height, 0]);

    // Dessiner le graphique initial avec animation
    drawChartElements(width, height, margin, true);

    // Ajouter le défilement à la molette
    dom.sessionsTrendChartContainer.addEventListener('wheel', handleMouseWheel);
}

function updateVisibleData() {
    chartState.visibleData = chartState.allData.slice(
        chartState.startIndex,
        chartState.startIndex + chartState.visibleCount
    );
}

function handleMouseWheel(event) {
    event.preventDefault();
    
    // Déterminer la direction du défilement
    const delta = Math.sign(event.deltaY);
    const newIndex = chartState.startIndex + delta;
    
    // Vérifier les limites
    if (newIndex >= 0 && newIndex <= chartState.allData.length - chartState.visibleCount) {
        chartState.startIndex = newIndex;
        updateVisibleData();
        redrawChart();
    }
}

function drawChartElements(width, height, margin, initialRender = false) {
    const svg = chartState.svg;
    const content = chartState.chartContent;
    let data = chartState.visibleData;
    const periodType = chartState.periodType; // Utilisation de chartState.periodType

    // Limiter à 45 jours en mode "jour"
    if (periodType === 'day' && data.length > 45) {
        data = data.slice(-45);
    }

    svg.selectAll(".axis").remove();
    svg.selectAll(".legend-container").remove();
    content.selectAll("*").remove();

    // Utiliser d3.scaleTime pour l'axe X
    const minDate = d3.min(data, d => d.periodDate);
    const maxDate = d3.max(data, d => d.periodDate);
    chartState.x = d3.scaleTime()
        .domain([minDate, maxDate])
        .range([0, width]);

    // Axe X
    const xAxisGroup = svg.append("g")
        .attr("class", "axis axis--x")
        .attr("transform", `translate(0,${height})`)
        .call(
            d3.axisBottom(chartState.x)
                .ticks(periodType === 'day' ? 7 : 7)
                .tickFormat(periodType === 'day' ? d3.timeFormat("%d/%m") : d3.timeFormat("%b %Y"))
        );

    xAxisGroup.selectAll("text")
        .style("text-anchor", "end")
        .attr("dx", "-.8em")
        .attr("dy", ".15em")
        .attr("transform", "rotate(-45)");

    // Largeur de barre ajustée pour 45 jours max
    let barWidth = 8;
    if (periodType === 'day') {
        barWidth = Math.max(4, width / Math.min(data.length, 45) * 0.7);
    } else {
        barWidth = Math.max(8, width / data.length * 0.7);
    }
    console.log(`Bar width: ${barWidth} for period type:`,chartState);

    // Axe Y (Comptages)
    svg.append("g")
        .attr("class", "axis axis--y-counts")
        .call(d3.axisLeft(chartState.yCounts).ticks(5))
        .append("text")
            .attr("fill", "#000")
            .attr("transform", "rotate(-90)")
            .attr("y", -margin.left + 47)
            .attr("x", -height/2)
            .attr("dy", "0.71em")
            .attr("text-anchor", "middle")
            .text("Nombre de Séances");

    // Axe Y (Montants)
    svg.append("g")
        .attr("class", "axis axis--y-amounts")
        .attr("transform", `translate(${width},0)`)
        .call(d3.axisRight(chartState.yAmounts).ticks(5))
        .append("text")
            .attr("fill", "#000")
            .attr("transform", "rotate(-90)")
            .attr("y", margin.right - 58)
            .attr("x", -height/2)
            .attr("dy", "-0.71em")
            .attr("text-anchor", "middle")
            .text("Montant Payé (€)");

    // Barres empilées : largeur dynamique selon la densité
    const stackKeys = ['plannedSessions', 'toPaySessions', 'paidSessions', 'cancelledSessions'];
    const stack = d3.stack().keys(stackKeys);
    const stackedData = stack(data);
    const colorScale = d3.scaleOrdinal().domain(stackKeys).range(['#17a2b8', '#ffc107', '#28a745', '#dc3545']);

    const barGroups = content.append("g")
        .selectAll("g")
        .data(stackedData)
        .enter().append("g")
            .attr("fill", d => colorScale(d.key))
            .attr("class", d => `bar-stack bar-stack-${d.key}`);

    barGroups.selectAll("rect")
        .data(d => d)
        .enter().append("rect")
            .attr("x", d => chartState.x(d.data.periodDate) - barWidth / 2)
            .attr("width", barWidth)
            .attr("y", height)
            .attr("height", 0)
            .on("mouseover", function(event, d) {
                const key = d3.select(this.parentNode).datum().key;
                let count, label;
                
                if (key === 'cancelledSessions') { count = d.data.cancelledSessions; label = 'Annulées'; }
                else if (key === 'paidSessions') { count = d.data.paidSessions; label = 'Payées'; }
                else if (key === 'toPaySessions') { count = d.data.toPaySessions; label = 'À Payer'; }
                else if (key === 'plannedSessions') { count = d.data.plannedSessions; label = 'Planifiées'; }
                
                chartState.tooltip.transition().duration(200).style("opacity", .9);
                chartState.tooltip.html(`<strong>${d.data.periodLabel}</strong><br/>Séances ${label}: ${count}`)
                    .style("left", (event.pageX + 10) + "px")
                    .style("top", (event.pageY - 28) + "px");

                // Mise en évidence de la pile
                content.selectAll(".bar-stack rect").style("opacity", 0.3);
                content.selectAll(`.bar-stack-${key} rect`)
                    .filter(barData => barData.data.periodLabel === d.data.periodLabel)
                    .style("opacity", 1);
            })
            .on("mouseout", function() {
                chartState.tooltip.transition().duration(500).style("opacity", 0);
                content.selectAll(".bar-stack rect").style("opacity", 1);
            })
            .transition()
                .duration(initialRender ? 800 : 400)
                .ease(d3.easeCubicOut)
                .attr("y", d => chartState.yCounts(d[1])) // au niveau de l'axe X
                .attr("height", d => Math.max(0, chartState.yCounts(d[0]) - chartState.yCounts(d[1])));

    // Ligne des montants payés
    const sortedLineData = data
        .map(d => ({ ...d, paidAmount: d.paidAmount || 0 }))
        .sort((a, b) => a.periodDate - b.periodDate);

    const linePaidAmount = d3.line()
        .x(d => chartState.x(d.periodDate))
        .y(d => chartState.yAmounts(d.paidAmount))
        .defined(d => d.paidAmount !== undefined && d.paidAmount !== null);

    const path = content.append("path")
        .datum(sortedLineData)
        .attr("class", "line paid-amount-line")
        .attr("fill", "none")
        .attr("stroke", "#007bff")
        .attr("stroke-width", 2.5)
        .attr("d", linePaidAmount)
        .attr("stroke-dasharray", function() {
            const length = this.getTotalLength();
            return length + " " + length;
        })
        .attr("stroke-dashoffset", function() {
            return this.getTotalLength();
        });

    path.transition()
        .duration(initialRender ? 1000 : 600)
        .ease(d3.easeCubicInOut)
        .attr("stroke-dashoffset", 0);

    // Points sur la ligne
    const dots = content.selectAll(".dot-paid-amount")
        .data(data.filter(d => d.paidAmount > 0))
        .enter().append("circle")
            .attr("class", "dot dot-paid-amount")
            .attr("cx", d => chartState.x(d.periodDate))
            .attr("cy", height)
            .attr("r", 0)
            .attr("fill", "#007bff")
            .attr("stroke", "white")
            .attr("stroke-width", 1.5)
            .on("mouseover", (event, d) => {
                chartState.tooltip.transition().duration(200).style("opacity", .9);
                chartState.tooltip.html(`<strong>${d.periodLabel}</strong><br/>Montant Payé: ${d.paidAmount.toFixed(2)}€`)
                    .style("left", (event.pageX + 10) + "px")
                    .style("top", (event.pageY - 28) + "px");
            })
            .on("mouseout", () => {
                chartState.tooltip.transition().duration(500).style("opacity", 0);
            });

    dots.transition()
        .delay((d, i) => initialRender ? i * 50 : i * 20)
        .duration(400)
        .ease(d3.easeBackOut)
        .attr("cy", d => chartState.yAmounts(d.paidAmount))
        .attr("r", 5);

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
        .attr("transform", `translate(0, ${height + margin.bottom - 25})`);

    const legend = legendContainer.selectAll(".legend-item")
        .data(legendData)
        .enter().append("g")
            .attr("class", "legend-item")
            .attr("transform", (d, i) => `translate(${i * 130}, 0)`);

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

function redrawChart() {
    const container = dom.sessionsTrendChartContainer;
    if (!container || !container.firstChild) return;
    
    const width = container.clientWidth - margin.left - margin.right;
    const height = 400 - margin.top - margin.bottom;
    
    // Mettre à jour les domaines avec animation
    const transitionDuration = 600;
    const xUpdate = d3.transition().duration(transitionDuration).ease(d3.easeCubicInOut);
    
    // Mise à jour des domaines
    chartState.x.domain(chartState.visibleData.map(d => d.periodLabel));
    
    const yCountsMax = d3.max(chartState.visibleData, d => 
        d.cancelledSessions + d.paidSessions + d.toPaySessions + d.plannedSessions
    ) || 1;
    chartState.yCounts.domain([0, yCountsMax]).nice();
    
    const yAmountsMax = d3.max(chartState.visibleData, d => d.paidAmount) || 1;
    chartState.yAmounts.domain([0, yAmountsMax]).nice();
    
    // Animation des axes
    chartState.svg.selectAll(".axis--x")
        .transition(xUpdate)
        .call(d3.axisBottom(chartState.x));
    
    chartState.svg.selectAll(".axis--y-counts")
        .transition(xUpdate)
        .call(d3.axisLeft(chartState.yCounts).ticks(5));
    
    chartState.svg.selectAll(".axis--y-amounts")
        .transition(xUpdate)
        .call(d3.axisRight(chartState.yAmounts).ticks(5));
    
    // Redessiner les éléments avec animation
    drawChartElements(width, height, margin);
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
        console.log("Date de paiement:", date);
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
    const exportBtn = document.getElementById('exportToSheetsBtn');
    if (exportBtn) {
        exportBtn.addEventListener('click', exportToGoogleSheets);
    }
}
async function exportToGoogleSheets() {
    try {
        showToast('Préparation de l\'export vers Google Sheets...', 'info');
        
        const response = await api.exportToGoogleSheets();
        if (response.spreadsheetUrl) {
            window.open(response.spreadsheetUrl, '_blank');
            showToast('Fichier Google Sheets créé avec succès!', 'success');
        } else {
            throw new Error('URL du fichier non reçue');
        }
    } catch (error) {
        showToast(`Erreur lors de l'export: ${error.message}`, 'error');
        console.error('Erreur exportToGoogleSheets:', error);
    }
}