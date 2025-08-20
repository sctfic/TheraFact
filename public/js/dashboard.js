// public/js/dashboard.js
import * as dom from './dom.js';
import * as state from './state.js';
import * as api from './api.js';
import { showToast, showDemoAlert } from './utils.js';

function getPeriodStartDate(dateStr, periodType) {
    if (!dateStr) return null;
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return null;
    d.setHours(0, 0, 0, 0); 
    if (periodType === 'day') return d;
    else if (periodType === 'week') { 
        const dayOfWeek = d.getDay(); 
        const diff = d.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1);
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
    if (periodType === 'week') return `S${d3.timeFormat("%W-%Y")(d)}`;
    if (periodType === 'month') return d3.timeFormat("%b %Y")(d);
    if (periodType === 'quarter') return `T${Math.floor(d.getMonth() / 3) + 1} ${d.getFullYear()}`;
    if (periodType === 'year') return d3.timeFormat("%Y")(d);
    return d.toLocaleDateString(); 
}

function prepareChartData(allSeances, periodType) {
    if (!allSeances || allSeances.length === 0) return [];
    const aggregatedData = {};

    allSeances.forEach(seance => {
        const montantFacture = parseFloat(seance.montant_facture || 0);
        if (seance.date_heure_seance) {
            const sessionDate = new Date(seance.date_heure_seance);
            if (!isNaN(sessionDate.getTime())) {
                const sessionPeriodStart = getPeriodStartDate(sessionDate, periodType);
                if (sessionPeriodStart) {
                    const sessionPeriodKey = sessionPeriodStart.toISOString().slice(0, 10); 
                    if (!aggregatedData[sessionPeriodKey]) {
                        aggregatedData[sessionPeriodKey] = { periodDate: sessionPeriodStart, periodLabel: formatPeriodForDisplay(sessionPeriodStart, periodType), cancelledSessions: 0, paidSessions: 0, toPaySessions: 0, plannedSessions: 0, paidAmount: 0 };
                    }
                    if (seance.statut_seance === 'ANNULEE') aggregatedData[sessionPeriodKey].cancelledSessions++;
                    else if (seance.statut_seance === 'PAYEE') aggregatedData[sessionPeriodKey].paidSessions++;
                    else if (seance.statut_seance === 'APAYER') aggregatedData[sessionPeriodKey].toPaySessions++;
                    else if (seance.statut_seance === 'PLANIFIEE') aggregatedData[sessionPeriodKey].plannedSessions++;
                }
            }
        }
        if (seance.statut_seance === 'PAYEE' && seance.date_paiement) {
            const paymentDate = new Date(seance.date_paiement);
             if (!isNaN(paymentDate.getTime())) {
                const paymentPeriodStart = getPeriodStartDate(paymentDate, periodType);
                if (paymentPeriodStart) {
                    const paymentPeriodKey = paymentPeriodStart.toISOString().slice(0, 10);
                    if (!aggregatedData[paymentPeriodKey]) {
                        aggregatedData[paymentPeriodKey] = { periodDate: paymentPeriodStart, periodLabel: formatPeriodForDisplay(paymentPeriodStart, periodType), cancelledSessions: 0, paidSessions: 0, toPaySessions: 0, plannedSessions: 0, paidAmount: 0 };
                    }
                    if (!isNaN(montantFacture)) aggregatedData[paymentPeriodKey].paidAmount += montantFacture;
                }
            }
        }
    });
    return Object.values(aggregatedData).sort((a, b) => a.periodDate - b.periodDate);
}

const chartState = {
    allData: [],
    visibleData: [],
    startIndex: 0,
    visibleCount: 25,
    svg: null,
    g: null,
    x: null, yCounts: null, yAmounts: null,
    xAxisGroup: null, yCountsAxisGroup: null, yAmountsAxisGroup: null,
    lineGenerator: null,
    tooltip: null,
    width: 0, height: 0,
    isScrolling: false,
    scrollTimeout: null
};
const margin = {top: 20, right: 60, bottom: 60, left: 50};
const TRANSITION_DURATION = 400;

function renderSessionsTrendChart() {
    chartState.allData = prepareChartData(state.seances, dom.chartPeriodSelector.value);

    dom.sessionsTrendChartContainer.innerHTML = '';
    if (chartState.allData.length === 0) {
        dom.sessionsTrendChartContainer.innerHTML = "<p style='text-align:center; padding-top: 20px; color:#666;'>Pas de données pour afficher le graphique.</p>";
        return;
    }

    const containerWidth = dom.sessionsTrendChartContainer.clientWidth;
    chartState.width = containerWidth - margin.left - margin.right;
    chartState.height = 400 - margin.top - margin.bottom;

    chartState.svg = d3.select(dom.sessionsTrendChartContainer).append("svg")
        .attr("width", chartState.width + margin.left + margin.right)
        .attr("height", chartState.height + margin.top + margin.bottom);
    
    chartState.g = chartState.svg.append("g")
        .attr("transform", `translate(${margin.left},${margin.top})`);
    
    chartState.g.append("defs").append("clipPath")
        .attr("id", "clip")
        .append("rect")
        .attr("width", chartState.width)
        .attr("height", chartState.height);

    chartState.x = d3.scaleBand().range([0, chartState.width]).padding(0.2);
    chartState.yCounts = d3.scaleLinear().range([chartState.height, 0]);
    chartState.yAmounts = d3.scaleLinear().range([chartState.height, 0]);
    
    chartState.xAxisGroup = chartState.g.append("g")
        .attr("class", "axis axis--x")
        .attr("transform", `translate(0,${chartState.height})`);
    
    chartState.yCountsAxisGroup = chartState.g.append("g").attr("class", "axis axis--y-counts");
    chartState.yAmountsAxisGroup = chartState.g.append("g").attr("class", "axis axis--y-amounts").attr("transform", `translate(${chartState.width},0)`);

    // MODIFIÉ : Ajout de .curve(d3.curveMonotoneX) pour créer une courbe douce
    chartState.lineGenerator = d3.line()
        .x(d => chartState.x(d.periodLabel) + chartState.x.bandwidth() / 2)
        .y(d => chartState.yAmounts(d.paidAmount))
        .curve(d3.curveMonotoneX); // Ajout pour la courbe

    chartState.g.append("g")
        .attr("class", "bars-group")
        .attr("clip-path", "url(#clip)");
        
    chartState.g.append("path")
        .attr("class", "line paid-amount-line")
        .attr("clip-path", "url(#clip)")
        .attr("fill", "none")
        .attr("stroke", "#007bff")
        .attr("stroke-width", 2.5);

    chartState.g.append("g")
        .attr("class", "dots-group")
        .attr("clip-path", "url(#clip)");
    
    chartState.tooltip = d3.select("body").append("div")
        .attr("class", "chart-tooltip")
        .style("opacity", 0);

    updateVisibleData();
    redrawChart(true);
    dom.sessionsTrendChartContainer.addEventListener('wheel', handleMouseWheel);
}

function updateVisibleData() {
    chartState.startIndex = Math.max(0, Math.min(chartState.startIndex, chartState.allData.length - chartState.visibleCount));
    chartState.visibleData = chartState.allData.slice(chartState.startIndex, chartState.startIndex + chartState.visibleCount);
}

function handleMouseWheel(event) {
    event.preventDefault();
    if (chartState.isScrolling) return;

    const delta = Math.sign(event.deltaY);
    const newIndex = chartState.startIndex + delta;

    if (newIndex >= 0 && newIndex <= chartState.allData.length - chartState.visibleCount) {
        chartState.startIndex = newIndex;
        updateVisibleData();
        redrawChart(false);
        
        chartState.isScrolling = true;
        clearTimeout(chartState.scrollTimeout);
        chartState.scrollTimeout = setTimeout(() => {
            chartState.isScrolling = false;
        }, TRANSITION_DURATION);
    }
}

function redrawChart(isInitialRender = false) {
    const t = d3.transition().duration(isInitialRender ? 0 : TRANSITION_DURATION);

    const yCountsMax = d3.max(chartState.visibleData, d => d.plannedSessions + d.toPaySessions + d.paidSessions + d.cancelledSessions) || 10;
    const yAmountsMax = d3.max(chartState.visibleData, d => d.paidAmount) || 100;
    
    chartState.x.domain(chartState.visibleData.map(d => d.periodLabel));
    chartState.yCounts.domain([0, yCountsMax]).nice();
    chartState.yAmounts.domain([0, yAmountsMax]).nice();

    chartState.xAxisGroup.transition(t)
        .call(d3.axisBottom(chartState.x))
        .selectAll("text")
        .style("text-anchor", "end")
        .attr("dx", "-.8em")
        .attr("dy", ".15em")
        .attr("transform", "rotate(-45)");
        
    chartState.yCountsAxisGroup.transition(t).call(d3.axisLeft(chartState.yCounts).ticks(5));
    chartState.yAmountsAxisGroup.transition(t).call(d3.axisRight(chartState.yAmounts).ticks(5));

    const stackKeys = ['plannedSessions', 'toPaySessions', 'paidSessions', 'cancelledSessions'];
    const colorScale = d3.scaleOrdinal().domain(stackKeys).range(['#17a2b8', '#ffc107', '#28a745', '#dc3545']);
    const stackedData = d3.stack().keys(stackKeys)(chartState.visibleData);

    const series = chartState.g.select(".bars-group")
        .selectAll(".series")
        .data(stackedData, d => d.key)
        .join("g")
            .attr("class", d => `series series-${d.key}`)
            .attr("fill", d => colorScale(d.key));
    
    series.selectAll("rect")
        .data(d => d, d => d.data.periodLabel)
        .join(
            enter => enter.append("rect")
                .attr("x", d => chartState.x(d.data.periodLabel))
                .attr("y", chartState.height)
                .attr("height", 0)
                .transition(t)
                .attr("y", d => chartState.yCounts(d[1]))
                .attr("height", d => chartState.yCounts(d[0]) - chartState.yCounts(d[1])),
            update => update
                .transition(t)
                .attr("x", d => chartState.x(d.data.periodLabel))
                .attr("y", d => chartState.yCounts(d[1]))
                .attr("height", d => chartState.yCounts(d[0]) - chartState.yCounts(d[1])),
            exit => exit
                .transition(t)
                .attr("y", chartState.height)
                .attr("height", 0)
                .remove()
        )
        .attr("width", chartState.x.bandwidth())
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

            chartState.g.selectAll(".series").transition().duration(100).style("opacity", 0.3);
            d3.select(this.parentNode).transition().duration(100).style("opacity", 1);
        })
        .on("mouseout", function() {
            chartState.tooltip.transition().duration(500).style("opacity", 0);
            chartState.g.selectAll(".series").transition().duration(100).style("opacity", 1);
        });

// Remplacer la section de la ligne par ce code :
const linePath = chartState.g.select(".paid-amount-line")
    .datum(chartState.visibleData);

if (isInitialRender) {
    linePath.attr("d", chartState.lineGenerator);
} else {
    // Créer un clone de la ligne actuelle pour l'animation
    const clone = linePath.clone()
        .attr("class", "line-clone")
        .attr("stroke-opacity", 0.7)
        .attr("stroke", "#007bff")
        .lower();
    
    // Mettre à jour la ligne principale immédiatement à sa nouvelle position
    linePath.attr("d", chartState.lineGenerator)
        .attr("stroke-opacity", 0);
    
    // Animer le clone depuis l'ancienne position
    clone.transition(t)
        .attr("d", chartState.lineGenerator)
        .attr("stroke-opacity", 0)
        .on("end", function() {
            clone.remove();
            linePath.transition().duration(100).attr("stroke-opacity", 1);
        });
}

    chartState.g.select(".dots-group")
        .selectAll(".dot")
        .data(chartState.visibleData.filter(d => d.paidAmount > 0), d => d.periodLabel)
        .join(
            enter => enter.append("circle")
                .attr("class", "dot")
                .attr("r", 0)
                .attr("cx", d => chartState.x(d.periodLabel) + chartState.x.bandwidth() / 2)
                .attr("cy", d => chartState.yAmounts(d.paidAmount))
                .attr("fill", "#007bff")
                .transition(t)
                .attr("r", 5),
            update => update
                .transition(t)
                .attr("cx", d => chartState.x(d.periodLabel) + chartState.x.bandwidth() / 2)
                .attr("cy", d => chartState.yAmounts(d.paidAmount)),
            exit => exit
                .transition(t)
                .attr("r", 0)
                .remove()
        )
        .on("mouseover", (event, d) => {
            chartState.tooltip.transition().duration(200).style("opacity", .9);
            chartState.tooltip.html(`<strong>${d.periodLabel}</strong><br/>Montant Payé: ${d.paidAmount.toFixed(2)}€`)
                .style("left", (event.pageX + 10) + "px")
                .style("top", (event.pageY - 28) + "px");
        })
        .on("mouseout", () => {
            chartState.tooltip.transition().duration(500).style("opacity", 0);
        });
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
        } else if (annee === anneeActuelle - 1) {
            caAnneePrecedente += montant;
        }
        let prevMonthDate = new Date();
        prevMonthDate.setMonth(now.getMonth() - 1);
        if (annee === prevMonthDate.getFullYear() && mois === prevMonthDate.getMonth()) {
            caMoisPrecedent += montant;
        }
    });

    if(dom.caMoisEnCours) dom.caMoisEnCours.textContent = caMoisEnCours.toFixed(2);
    if(dom.caMoisPrecedent) dom.caMoisPrecedent.textContent = caMoisPrecedent.toFixed(2);
    if(dom.caAnneeEnCours) dom.caAnneeEnCours.textContent = caAnneeEnCours.toFixed(2);
    if(dom.caAnneePrecedente) dom.caAnneePrecedente.textContent = caAnneePrecedente.toFixed(2);
    
    const viewDashboardEl = document.getElementById('viewDashboard');
    if (viewDashboardEl && viewDashboardEl.classList.contains('active')) {
        displaySessionsTrendChart();
    }
}

export function displaySessionsTrendChart() {
    const viewDashboardEl = document.getElementById('viewDashboard');
    if (!viewDashboardEl || !viewDashboardEl.classList.contains('active')) return;
    renderSessionsTrendChart();
}

export function initializeDashboard() {
    console.log('initializeDashboard');
    if (dom.chartPeriodSelector) {
        dom.chartPeriodSelector.addEventListener('change', displaySessionsTrendChart);
    }
    if (dom.exportToSheetsBtn) {
        console.log('dom.exportToSheetsBtn', dom.exportToSheetsBtn);
        dom.exportToSheetsBtn.addEventListener('click', async () => {
            if (!state.appSettings.googleOAuth.isConnected) {
                showDemoAlert();
                return;
            }
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
        });
    }
}