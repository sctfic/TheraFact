// helpers/documentHelper.js
const { jsPDF } = require("jspdf");
// Ajout du support pour l'encodage UTF-8
// require('jspdf-font-roboto');
const autoTable = require('jspdf-autotable').default;

function generatePdfWithJspdf(data) {
    console.log("generatePdfWithJspdf: Début de la génération du PDF.");
    
    // Créer le document PDF avec encodage UTF-8
    const doc = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4',
        putOnlyUsedFonts: true,
        compress: true
    });
    
    // Configuration de la police pour supporter les caractères français
    doc.setFont('helvetica');
    
    const margin = 15;
    const pageWidth = doc.internal.pageSize.width;
    const pageHeight = doc.internal.pageSize.height;
    let cursorY = margin;

    const isDevis = !!data.devisNumber;
    const docNumber = isDevis ? data.devisNumber : data.invoiceNumber;
    console.log(`generatePdfWithJspdf: Document type: ${isDevis ? 'Devis' : 'Facture'}, Numéro: ${docNumber}`);
    
    const docDate = isDevis ? data.devisDate : data.invoiceDate;
    const effectiveDueDateOrValidity = isDevis ? data.validityDate : data.dueDate;
    const docTitle = isDevis ? 'DEVIS' : 'FACTURE';
    const clientLabel = isDevis ? "Adressé à :" : "Facturé à :";

    const manager = data.manager || {};
    const client = data.client || {};
    const legal = data.legal || {};
    
   // --- Entête améliorée ---
   const headerY = margin;
   doc.setFontSize(10);
   doc.setFont('helvetica', 'bold');
   
   // Bloc gauche (coordonnées cabinet)
   doc.text(manager.name || 'Nom du gestionnaire', margin, headerY);
   doc.setFont('helvetica', 'normal');
   let nextY = headerY + 5;
   if(manager.title) { 
       doc.text(manager.title, margin, nextY); 
       nextY += 5;
   }
   if(manager.address) { 
       doc.text(manager.address, margin, nextY);
       nextY += 5;
   }
   if(manager.city) {
       doc.text(manager.city, margin, nextY);
       nextY += 5;
   }
   if(manager.phone) {
       doc.text(`Téléphone : ${manager.phone}`, margin, nextY);
       nextY += 5;
   }
   if(manager.email) {
       doc.text(`Email : ${manager.email}`, margin, nextY);
       nextY += 5;
   }

   // Bloc droit (numéro + dates)
   const rightX = 210 - margin;
   doc.setFont('helvetica', 'bold');
   doc.text(`${isDevis ? 'Devis N°' : 'Facture N°'} : ${docNumber}`, rightX, headerY, { align: 'right' });
   doc.setFont('helvetica', 'normal');
   doc.text(`Date d'émission : ${docDate}`, rightX, headerY + 5, { align: 'right' });
   const dueLabel = isDevis ? "Valide jusqu'au :" : "Date d'échéance :";
   doc.text(`${dueLabel} ${effectiveDueDateOrValidity}`, rightX, headerY + 10, { align: 'right' });

   // --- Titre centré ---
   cursorY = Math.max(nextY, headerY + 20) + 10;
   doc.setFontSize(22);
   doc.setFont('helvetica', 'bold');
   doc.text(docTitle, 105, cursorY, { align: 'center' });
   cursorY += 15;

   // --- Client ---
   doc.setFontSize(11);
   doc.setFont('helvetica', 'bold');
   doc.text(clientLabel, margin, cursorY);
   cursorY += 6;
   doc.setFont('helvetica', 'normal');
   doc.text(client.name || 'Nom du client', margin, cursorY);
   cursorY += 5;
   if(client.address) { 
       doc.text(client.address, margin, cursorY); 
       cursorY += 5;
   }
   if(client.city) { 
       doc.text(client.city, margin, cursorY); 
       cursorY += 5;
   }
   cursorY += 10;

    // --- Tableau des prestations ---
    console.log("generatePdfWithJspdf: Préparation et dessin du tableau des prestations.");
    const formatCurrency = (value) => {
        const numValue = typeof value === 'number' ? value : parseFloat(value || 0);
        return numValue.toFixed(2).replace('.', ',') + ' €';
    };
    
    const tableBody = data.service.map(item => [
        item.Date || docDate,
        item.description || 'Service',
        (item.quantity || 1).toString(),
        formatCurrency(item.unitPrice),
        formatCurrency((item.quantity || 1) * (item.unitPrice || 0))
    ]);

    // Calculer les totaux
    const total_ht = data.service.reduce((sum, item) => sum + (item.quantity || 1) * (item.unitPrice || 0), 0);
    const tvaRate = parseFloat(data.tva) || 0;
    const tvaAmount = total_ht * (tvaRate / 100);
    const total_ttc = total_ht + tvaAmount;

    autoTable(doc, {
        startY: cursorY,
        head: [['Date', 'Description', 'Qté', 'P.U. (€)', 'Total HT (€)']],
        body: tableBody,
        theme: 'grid',
        headStyles: { 
            fillColor: [240, 240, 240], 
            textColor: [0, 0, 0], 
            fontStyle: 'bold',
            fontSize: 10
        },
        bodyStyles: { 
            fontSize: 9,
            textColor: [0, 0, 0]
        },
        columnStyles: {
            0: { cellWidth: 25 },
            1: { cellWidth: 'auto' },
            2: { halign: 'right', cellWidth: 15 },
            3: { halign: 'right', cellWidth: 25 },
            4: { halign: 'right', cellWidth: 25 }
        },
        styles: {
            cellPadding: 3,
            lineColor: [0, 0, 0],
            lineWidth: 0.1
        },
        didDrawPage: (data) => {
            cursorY = data.cursor.y;
        }
    });
    console.log("generatePdfWithJspdf: Tableau des prestations dessiné.");

    cursorY += 5;
   // --- Totaux alignés à droite ---
   cursorY += 10;
   doc.setFont('helvetica', 'normal');
   doc.text(`Total HT: ${formatCurrency(total_ht)}`, rightX, cursorY, { align: 'right' });
   cursorY += 7;
   doc.text(`TVA (${tvaRate.toFixed(2).replace('.', ',')}%): ${formatCurrency(tvaAmount)}`, rightX, cursorY, { align: 'right' });
   cursorY += 7;
   doc.setFont('helvetica', 'bold');
   doc.text(`Total TTC: ${formatCurrency(total_ttc)}`, rightX, cursorY, { align: 'right' });
   cursorY += 12;

   // Montant à régeler
   const paymentLabel = isDevis ? "MONTANT TOTAL DU DEVIS :" : "MONTANT À RÉGLER :";
   doc.text(`${paymentLabel} ${formatCurrency(total_ttc)}`, rightX, cursorY, { align: 'right' });
   cursorY += 20;

   // --- Mentions légales structurées ---
   doc.setLineWidth(0.5);
   doc.line(margin, cursorY, 210 - margin, cursorY);
   cursorY += 8;

   doc.setFontSize(10);
   doc.setFont('helvetica', 'bold');
   doc.text("Mentions Légales", margin, cursorY);
   cursorY += 6;
   
   doc.setFontSize(9);
   doc.setFont('helvetica', 'normal');
   
   // Colonne gauche
   doc.text(`SIRET : ${legal.siret || 'N/A'}`, margin, cursorY);
   doc.text(`Code APE : ${legal.ape || 'N/A'}`, margin, cursorY + 5);
   doc.text(`N° ADELI : ${legal.adeli || 'N/A'}`, margin, cursorY + 10);
   
   // Colonne droite
   doc.text(`IBAN : ${legal.iban || 'N/A'}`, 110, cursorY);
   doc.text(`BIC : ${legal.bic || 'N/A'}`, 110, cursorY + 5);
   
   cursorY += 15;
   
   // Mentions TVA
   const tvaText = legal.tvaMention || 
                  (tvaRate === 0 ? "TVA non applicable - Art. 293B du CGI" : 
                   `TVA applicable au taux de ${tvaRate.toFixed(2).replace('.', ',')}%`);
   doc.text(tvaText, margin, cursorY, { maxWidth: 180 });
   cursorY += 10;
   
   // Conditions de paiement
   if (!isDevis) {
       doc.text(`Conditions de règlement : ${legal.paymentTerms || 'Paiement à réception.'}`, 
               margin, cursorY, { maxWidth: 180 });
       cursorY += 10;
   }
   
   // Assurance
   doc.text(`Assurance RCP : ${legal.insurance || 'N/A'}`, margin, cursorY, { maxWidth: 180 });


    console.log("generatePdfWithJspdf: Génération du buffer de sortie du PDF.");
    
    // Générer le buffer PDF
    const pdfOutput = doc.output('arraybuffer');
    const pdfBuffer = Buffer.from(pdfOutput);
    
    console.log(`generatePdfWithJspdf: PDF finalisé. Taille : ${pdfBuffer.byteLength} octets.`);
    return pdfBuffer;
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

    const formatCurrency = (value) => {
        const numValue = typeof value === 'number' ? value : parseFloat(value || 0);
        return numValue.toFixed(2).replace('.', ',') + ' €';
    };

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
                    <td>${item.Date || docDate}</td>
                    <td>${item.description || 'Service'}</td>
                    <td style="text-align:right;">${itemQuantity}</td>
                    <td style="text-align:right;">${formatCurrency(itemUnitPrice)}</td>
                    <td style="text-align:right;">${formatCurrency(itemTotal)}</td>
                </tr>
            `;
        });
    }

    const tvaRate = parseFloat(data.tva) || 0;
    const tvaAmount = total_ht * (tvaRate / 100);
    const total_ttc = total_ht + tvaAmount;

    const manager = data.manager || {};
    const client = data.client || {};
    const legal = data.legal || {};

    return `
    <!DOCTYPE html>
    <html lang="fr">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>${docTypeLabel} ${docNumber}</title>
        <style>
            body { 
                font-family: Arial, sans-serif; 
                margin: 0; 
                padding: 20px; 
                background-color: #f5f5f5;
            }
            .container {
                max-width: 800px;
                margin: 0 auto;
                background-color: white;
                padding: 30px;
                border-radius: 8px;
                box-shadow: 0 2px 10px rgba(0,0,0,0.1);
            }
            .header { 
                display: flex; 
                justify-content: space-between; 
                margin-bottom: 30px;
                flex-wrap: wrap;
            }
            .manager-info { 
                flex: 1; 
                min-width: 300px;
                margin-bottom: 20px;
            }
            .manager-info h3 {
                margin: 0 0 10px 0;
                color: #333;
            }
            .invoice-info { 
                text-align: right; 
                flex: 1; 
                min-width: 250px;
                margin-bottom: 20px;
            }
            .invoice-title { 
                text-align: center; 
                font-size: 2rem; 
                color: #0056b3; 
                margin: 30px 0; 
                font-weight: bold; 
                text-transform: uppercase;
            }
            .client-section {
                margin-bottom: 30px;
                padding: 15px;
                background-color: #f8f9fa;
                border-left: 4px solid #0056b3;
            }
            .client-section h4 {
                margin: 0 0 10px 0;
                color: #333;
            }
            table { 
                width: 100%; 
                border-collapse: collapse; 
                margin-bottom: 20px; 
            }
            th, td { 
                border: 1px solid #ddd; 
                padding: 12px 8px; 
                text-align: left; 
                font-size: 0.9em; 
            }
            th { 
                background-color: #f0f0f0; 
                font-weight: bold;
                color: #333;
            }
            .totals-table {
                width: auto;
                margin-left: auto;
                margin-top: 20px;
            }
            .totals-table td {
                border: none;
                padding: 5px 15px;
            }
            .total-row td { 
                font-weight: bold; 
                background-color: #f8f9fa;
                border-top: 2px solid #0056b3;
            }
            .right { text-align: right; }
            .payment-amount {
                text-align: right;
                font-size: 1.2em;
                font-weight: bold;
                color: #0056b3;
                margin: 20px 0;
                padding: 15px;
                background-color: #e7f3ff;
                border-radius: 5px;
            }
            .legal-mentions {
                margin-top: 40px;
                padding-top: 20px;
                border-top: 1px solid #ddd;
                font-size: 0.8em;
                color: #666;
            }
            .legal-mentions h4 {
                margin-top: 0;
                color: #333;
            }
            .legal-grid {
                display: grid;
                grid-template-columns: 1fr 1fr;
                gap: 20px;
                margin-bottom: 15px;
            }
            @media (max-width: 600px) {
                .header { flex-direction: column; }
                .invoice-info { text-align: left; }
                .legal-grid { grid-template-columns: 1fr; }
            }
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <div class="manager-info">
                    <h3>${manager.name || 'Nom du Thérapeute'}</h3>
                    ${manager.title ? `<p><strong>${manager.title}</strong></p>` : ''}
                    ${manager.description ? `<p>${manager.description}</p>` : ''}
                    ${manager.address ? `<p>${manager.address}</p>` : ''}
                    ${manager.city ? `<p>${manager.city}</p>` : ''}
                    ${manager.phone ? `<p>Téléphone : ${manager.phone}</p>` : ''}
                    ${manager.email ? `<p>Email : ${manager.email}</p>` : ''}
                </div>
                <div class="invoice-info">
                    <p><strong>${docTypeLabel} N° : ${docNumber}</strong></p>
                    <p>Date d'émission : ${docDate}</p>
                    <p>${isDevis ? 'Valide jusqu\'au :' : 'Date d\'échéance :'} ${effectiveDueDateOrValidity}</p>
                </div>
            </div>

            <div class="invoice-title">${docTitle}</div>

            <div class="client-section">
                <h4>${clientLabel}</h4>
                <p><strong>${client.name || 'Nom Client'}</strong></p>
                ${client.address ? `<p>${client.address}</p>` : ''}
                ${client.city ? `<p>${client.city}</p>` : ''}
            </div>

            <table>
                <thead>
                    <tr>
                        <th>Date</th>
                        <th>Description</th>
                        <th class="right">Qté</th>
                        <th class="right">P.U. (€)</th>
                        <th class="right">Total HT (€)</th>
                    </tr>
                </thead>
                <tbody>
                    ${itemsHtml}
                </tbody>
            </table>

            <table class="totals-table">
                <tbody>
                    <tr>
                        <td class="right">Total HT</td>
                        <td class="right">${formatCurrency(total_ht)}</td>
                    </tr>
                    <tr>
                        <td class="right">TVA (${tvaRate.toFixed(2).replace('.', ',')}%)</td>
                        <td class="right">${formatCurrency(tvaAmount)}</td>
                    </tr>
                    <tr class="total-row">
                        <td class="right">Total TTC</td>
                        <td class="right">${formatCurrency(total_ttc)}</td>
                    </tr>
                </tbody>
            </table>
            
            <div class="payment-amount">
                ${paymentLabel} : ${formatCurrency(total_ttc)}
            </div>

            <div class="legal-mentions">
                <h4>Mentions Légales</h4>
                <div class="legal-grid">
                    <div>
                        ${legal.siret ? `<p>SIRET : ${legal.siret}</p>` : ''}
                        ${legal.ape ? `<p>Code APE : ${legal.ape}</p>` : ''}
                        ${legal.adeli ? `<p>N° ADELI : ${legal.adeli}</p>` : ''}
                    </div>
                    <div>
                        ${legal.iban ? `<p>IBAN : ${legal.iban}</p>` : ''}
                        ${legal.bic ? `<p>BIC : ${legal.bic}</p>` : ''}
                    </div>
                </div>
                <p>TVA : ${legal.tvaMention || (tvaRate === 0 ? "TVA non applicable selon l'article 293B du Code Général des Impôts" : `TVA applicable au taux de ${tvaRate.toFixed(2).replace('.', ',')}%`)}</p>
                ${!isDevis && legal.paymentTerms ? `<p>Conditions de règlement : ${legal.paymentTerms}</p>` : ''}
                ${legal.insurance ? `<p>Assurance RCP : ${legal.insurance}</p>` : ''}
            </div>
        </div>
    </body>
    </html>
    `;
}

module.exports = {
    generatePdfWithJspdf,
    generateDocumentHtmlForEmail
};