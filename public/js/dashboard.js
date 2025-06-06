
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