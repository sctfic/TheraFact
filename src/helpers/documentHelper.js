// helpers/documentHelper.js
const { jsPDF } = require("jspdf");
// On importe explicitement la fonction autoTable du plugin
const autoTable = require('jspdf-autotable').default;

function generatePdfWithJspdf(data) {
    const doc = new jsPDF();
    const margin = 15;
    const pageHeight = doc.internal.pageSize.height;
    let cursorY = margin;

    const isDevis = !!data.devisNumber;
    const docNumber = isDevis ? data.devisNumber : data.invoiceNumber;
    const docDate = isDevis ? data.devisDate : data.invoiceDate;
    const effectiveDueDateOrValidity = isDevis ? data.validityDate : data.dueDate;
    const docTitle = isDevis ? 'DEVIS' : 'FACTURE';
    const clientLabel = isDevis ? "Adressé à :" : "Facturé à :";

    const manager = data.manager || {};
    const client = data.client || {};
    const legal = data.legal || {};
    
    // --- Entête ---
doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.text(manager.name || 'Nom du gestionnaire', margin, cursorY);
    cursorY += 5;
    doc.setFont('helvetica', 'normal');
    if(manager.title) { doc.text(manager.title, margin, cursorY); cursorY += 5; }
    if(manager.address) { doc.text(`${manager.address}, ${manager.city || ''}`, margin, cursorY); cursorY += 5; }
    if(manager.phone) { doc.text(`Téléphone : ${manager.phone}`, margin, cursorY); cursorY += 5; }
    if(manager.email) { doc.text(`Email : ${manager.email}`, margin, cursorY); cursorY += 5; }
    
    const initialCursorY = cursorY;
    cursorY = margin;
    doc.setFontSize(10);
    doc.text(`Date d'émission : ${docDate}`, 210 - margin, cursorY, { align: 'right' });
    cursorY += 5;
    const dueDateLabel = isDevis ? "Valide jusqu'au :" : "Date d'échéance :";
    doc.text(`${dueDateLabel} ${effectiveDueDateOrValidity}`, 210 - margin, cursorY, { align: 'right' });
    
    cursorY = Math.max(initialCursorY, cursorY) + 15;
    doc.setFontSize(22);
    doc.setFont('helvetica', 'bold');
    doc.text(docTitle, 105, cursorY, { align: 'center' });
    cursorY += 8;
    doc.setFontSize(12);
    doc.text(`${isDevis ? 'Devis N°' : 'Facture N°'} : ${docNumber}`, 105, cursorY, { align: 'center' });
    cursorY += 15;
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text(clientLabel, margin, cursorY);
    cursorY += 6;
    doc.setFont('helvetica', 'normal');
    doc.text(client.name || 'Nom du client', margin + 5, cursorY);
    cursorY += 5;
    if(client.address) { doc.text(client.address, margin + 5, cursorY); cursorY += 5; }
    if(client.city) { doc.text(client.city, margin + 5, cursorY); cursorY += 5; }
    cursorY += 5;

    // --- Tableau des prestations ---
    const formatCurrency = (value) => (typeof value === 'number' ? value : parseFloat(value || 0)).toFixed(2).replace('.', ',') + ' €';
    const tableBody = data.service.map(item => [
        item.Date || docDate,
        item.description || 'Service',
        item.quantity || 1,
        formatCurrency(item.unitPrice),
        formatCurrency((item.quantity || 1) * (item.unitPrice || 0))
    ]);

    // MODIFICATION : On appelle autoTable(doc, ...) au lieu de doc.autoTable(...)
    autoTable(doc, {
        startY: cursorY,
        head: [['Date', 'Description', 'Qté', 'P.U. HT', 'Total HT']],
        body: tableBody,
        theme: 'grid',
        headStyles: { fillColor: [220, 220, 220], textColor: 20, fontStyle: 'bold' },
        styles: { fontSize: 10 },
        columnStyles: {
            2: { halign: 'right' },
            3: { halign: 'right' },
            4: { halign: 'right' }
        },
        // 'didDrawPage' est utilisé pour mettre à jour la position Y après le tableau
        didDrawPage: (data) => {
            cursorY = data.cursor.y;
        }
    });

    cursorY += 10;

    // --- Tableau des totaux ---
    const tvaRate = parseFloat(data.tva) || 0;
    const total_ht = data.service.reduce((sum, item) => sum + (item.quantity || 1) * (item.unitPrice || 0), 0);
    const tvaAmount = total_ht * (tvaRate / 100);
    const total_ttc = total_ht + tvaAmount;

    // MODIFICATION : On appelle autoTable(doc, ...) ici aussi
    autoTable(doc, {
        startY: cursorY,
        body: [
            ['Total HT', formatCurrency(total_ht)],
            [`TVA (${tvaRate.toFixed(2).replace('.', ',')}%)`, formatCurrency(tvaAmount)],
            ['Total TTC', formatCurrency(total_ttc)],
        ],
        theme: 'plain',
        tableWidth: 'wrap',
        styles: { fontSize: 10, cellPadding: 2 },
        columnStyles: {
             0: { halign: 'right', fontStyle: 'bold' },
             1: { halign: 'right' }
        },
        margin: { left: 115 },
        didDrawPage: (data) => {
            cursorY = data.cursor.y;
        }
    });

    // --- Montant à régler ---
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    const paymentLabel = isDevis ? "MONTANT TOTAL DU DEVIS :" : "MONTANT À RÉGLER :";
    doc.text(`${paymentLabel} ${formatCurrency(total_ttc)}`, 210 - margin, cursorY + 10, { align: 'right' });
    

    
    
    // --- Pied de page / Mentions légales ---
    cursorY = pageHeight - 70; 
    doc.setLineWidth(0.5);
    doc.line(margin, cursorY, 210 - margin, cursorY);
    cursorY += 8;

    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.text("Mentions Légales", margin, cursorY);
    cursorY += 6;
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');

    const legalCol1 = [
        `SIRET : ${legal.siret || 'N/A'}`,
        `Code APE : ${legal.ape || 'N/A'}`,
        `N° ADELI : ${legal.adeli || 'N/A'}`
    ];
    const legalCol2 = [
        `IBAN : ${legal.iban || 'N/A'}`,
        `BIC : ${legal.bic || 'N/A'}`
    ];
    doc.text(legalCol1, margin, cursorY);
    doc.text(legalCol2, 110, cursorY);
    cursorY += legalCol1.length * 5 + 2;

    const tvaMention = legal.tvaMention || (tvaRate === 0 ? "TVA non applicable - Art. 293B du CGI" : `TVA au taux de ${tvaRate.toFixed(2).replace('.', ',')}%`);
    doc.text(tvaMention, margin, cursorY, { maxWidth: 180 });
    cursorY += 10;
    
    if (!isDevis) {
        doc.text(`Conditions de règlement : ${legal.paymentTerms || 'Paiement à réception.'}`, margin, cursorY, { maxWidth: 180 });
        cursorY += 10;
    }
    
    doc.text(`Assurance RCP : ${legal.insurance || 'N/A'}`, margin, cursorY, { maxWidth: 180 });

    return doc.output('arraybuffer');
}

function generateDocumentHtmlForEmail(data) { 
    const isDevis = !!data.devisNumber;
    const docNumber = isDevis ? data.devisNumber : data.invoiceNumber;
    const docDate = isDevis ? data.devisDate : data.invoiceDate;
    const effectiveDueDateOrValidity = isDevis ? data.validityDate : data.dueDate; 
    const docTitle = isDevis ? 'DEVIS' : 'FACTURE';
    const docTypeLabel = isDevis ? 'Devis' : 'Facture';
    const paymentLabel = isDevis ? "MONTANT TOTAL DU DEVIS" : "MONTANT À RÉGLER";
    const clientLabel = isDevis ? 'Adressé à :' : 'Facturé à :';
    const itemDateLabel = isDevis ? 'Date Prestation Prévue' : 'Date';

    const formatDateForHtml = (dateStr) => {
        if (!dateStr) return 'N/A';
        if (/^\d{2}\/\d{2}\/\d{4}$/.test(dateStr)) return dateStr; 
        try {
            return new Date(dateStr).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' });
        } catch(e) { return dateStr; }
    };
    const formatCurrency = (value) => (typeof value === 'number' ? value : parseFloat(value || 0)).toFixed(2).replace('.', ',') + ' €';

    let itemsHtml = '';
    let total_ht = 0;
    if (data.service && Array.isArray(data.service)) {
        data.service.forEach(item => {
            const itemQuantity = parseFloat(item.quantity) || 1;
            const itemUnitPrice = parseFloat(item.unitPrice) || 0;
            const itemTotal = itemQuantity * itemUnitPrice;
            total_ht += itemTotal;
            itemsHtml += `
                <tr>
                    <td>${item.Date || formatDateForHtml(docDate)}</td>
                    <td>${item.description || 'Service'}</td>
                    <td style="text-align:right;">${itemQuantity}</td>
                    <td style="text-align:right;">${formatCurrency(itemUnitPrice)}</td>
                    <td style="text-align:right;">${formatCurrency(itemTotal)}</td>
                </tr>
            `;
        });
    }

    const tvaRate = parseFloat(data.tva) || 0;
    const tvaPercentage = tvaRate > 1 ? tvaRate : tvaRate * 100;
    const tvaAsDecimal = tvaRate > 1 ? tvaRate / 100 : tvaRate;
    const tvaAmount = total_ht * tvaAsDecimal;
    const total_ttc = total_ht + tvaAmount;

    const manager = data.manager || {};
    const client = data.client || {};
    const legal = data.legal || {};

    return `
    <!DOCTYPE html>
    <html lang="fr">
    <head>
        <meta charset="UTF-8">
        <title>${docTypeLabel} ${docNumber}</title>
        <style>
            body { font-family: Arial, sans-serif; margin: 20px; padding: 20px; border: 1px solid #eee; max-width: 800px; margin-left: auto; margin-right: auto; }
            .header, .client-info, .totals, .legal-mentions { margin-bottom: 20px; }
            .header { display: flex; justify-content: space-between; flex-wrap: wrap; }
            .manager-info { flex: 1 1 300px; margin-bottom:10px;}
            .invoice-info { text-align: right; flex: 1 1 300px; margin-bottom:10px;}
            .invoice-title { text-align: center; font-size: 1.8rem; color: #0056b3; margin: 20px 0; font-weight: bold; }
            table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
            th, td { border: 1px solid #ddd; padding: 8px; text-align: left; font-size:0.9em; }
            th { background-color: #f2f2f2; }
            .total-row td { font-weight: bold; background-color: #f8f9fa;}
            .right { text-align: right; }
            .legal-mentions p {margin: 5px 0; font-size: 0.85em;}
            h4 {margin-top: 10px; margin-bottom:5px;}
        </style>
    </head>
    <body>
        <div class="header">
            <div class="manager-info">
                <strong>${manager.name || 'Nom du Thérapeute'}</strong><br>
                ${manager.title || ''}<br>
                ${manager.description || ''}<br>
                ${manager.address || 'Adresse Manager'}<br>
                ${manager.city || 'Ville Manager'}<br>
                Téléphone : ${manager.phone || ''}<br>
                Email : ${manager.email || ''}
            </div>
            <div class="invoice-info">
                <strong>${docTypeLabel} N° : ${docNumber || (isDevis ? 'DEV-YYYY-XXXX' : 'FAC-YYYY-XXXX')}</strong><br>
                Date d'émission : ${docDate || formatDateForHtml(new Date().toISOString())}<br>
                ${isDevis ? 'Valide jusqu\'au :' : 'Date d\'échéance :'} ${effectiveDueDateOrValidity || formatDateForHtml(new Date(new Date().setDate(new Date().getDate() + 30)).toISOString())}
            </div>
        </div>

        <div class="invoice-title">${docTitle}</div>

        <div class="client-info">
            <strong>${clientLabel}</strong><br>
            ${client.name || 'Nom Client'}<br>
            ${client.address || 'Adresse Client'}<br>
            ${client.city || 'Ville Client'}
        </div>

        <table>
            <thead>
                <tr><th>${itemDateLabel}</th><th>Description</th><th class="right">Qté</th><th class="right">P.U. (€)</th><th class="right">Total HT (€)</th></tr>
            </thead>
            <tbody>
                ${itemsHtml}
            </tbody>
        </table>

        <div class="totals">
            <table>
                <tbody>
                    <tr><td colspan="4" class="right">Total HT</td><td class="right">${formatCurrency(total_ht)}</td></tr>
                    <tr><td colspan="4" class="right">TVA (${tvaPercentage.toFixed(2).replace('.', ',')}%)</td><td class="right">${formatCurrency(tvaAmount)}</td></tr>
                    <tr class="total-row"><td colspan="4" class="right">Total TTC</td><td class="right">${formatCurrency(total_ttc)}</td></tr>
                </tbody>
            </table>
            <h3 class="right" style="color: #0056b3;">${paymentLabel} : ${formatCurrency(total_ttc)}</h3>
        </div>

        <div class="legal-mentions">
            <h4>Mentions Légales</h4>
            <p>SIRET : ${legal.siret || 'N/A'}<br>
            Code APE : ${legal.ape || 'N/A'}<br>
            N° ADELI : ${legal.adeli || 'N/A'}</p>
            <p>IBAN : ${legal.iban || 'N/A'}<br>
            BIC : ${legal.bic || 'N/A'}</p>
            <p>TVA : ${legal.tvaMention || (tvaPercentage === 0 ? "TVA non applicable - Art. 293B du CGI" : `TVA au taux de ${tvaPercentage.toFixed(2).replace('.', ',')}%`)}</p>
            ${!isDevis ? `<p>Conditions de règlement : ${legal.paymentTerms || 'Paiement à réception.'}</p>` : ''}
            <p>Assurance RCP : ${legal.insurance || 'N/A'}</p>
        </div>
    </body>
    </html>
    `;
}

module.exports = {
    generatePdfWithJspdf,
    generateDocumentHtmlForEmail
};