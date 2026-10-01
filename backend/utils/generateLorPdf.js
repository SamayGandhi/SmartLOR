import PDFDocument from 'pdfkit';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

const strengthLabel = {
  'strongly-recommend': 'Strongly recommend',
  recommend: 'Recommend',
  'recommend-with-reservations': 'Recommend with reservations',
};

const assessmentLabel = {
  'top-1': 'Top 1%', 'top-5': 'Top 5%', 'top-10': 'Top 10%', 'top-25': 'Top 25%',
  'above-average': 'Above average', 'no-basis': 'No basis for judgment',
};

function wordCount(text = '') {
  return text.trim() ? text.trim().split(/\s+/).filter(Boolean).length : 0;
}

function section(doc, title) {
  doc.moveDown(0.14);
  doc.font('Helvetica-Bold').fontSize(8.2).fillColor('#4338ca').text(title.toUpperCase());
  doc.moveDown(0.08);
  doc.moveTo(doc.x, doc.y).lineTo(doc.page.width - doc.page.margins.right, doc.y)
    .lineWidth(0.55).strokeColor('#d8def0').stroke();
  doc.moveDown(0.12);
  doc.font('Helvetica').fontSize(10.2).fillColor('#172033');
}

function paragraph(doc, text) {
  if (!text) return;
  doc.font('Helvetica').fontSize(10.2).fillColor('#172033')
    .text(text, { align: 'justify', lineGap: 1.05, paragraphGap: 1.2 });
  doc.moveDown(0.10);
}

function drawCheck(doc, x, y) {
  doc.save();
  doc.circle(x + 10, y + 10, 10).fillColor('#4338ca').fill();
  doc.strokeColor('#ffffff').lineWidth(1.6)
    .moveTo(x + 5.7, y + 10.2).lineTo(x + 8.7, y + 13.2).lineTo(x + 14.7, y + 6.8).stroke();
  doc.restore();
}

export const PDF_TEMPLATE_VERSION = 3;

export function generateLorPdf({ request, student, professor }) {
  const uploadDir = path.resolve('uploads');
  fs.mkdirSync(uploadDir, { recursive: true });
  const filename = `lor-draft-${Date.now()}-${crypto.randomBytes(8).toString('hex')}.pdf`;
  const filePath = path.join(uploadDir, filename);
  const institution = professor.college || professor.university || student.university || 'Academic Institution';
  const reference = `SMARTLOR-${String(request._id).slice(-8).toUpperCase()}`;
  const generatedAt = new Date();
  const date = generatedAt.toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' });
  const verifiedAt = request.verification?.verifiedAt
    ? new Date(request.verification.verifiedAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
    : date;
  const totalWords = wordCount([request.recommendationText, request.strengths, request.evidence, request.constructiveFeedback, request.additionalRemarks].filter(Boolean).join(' '));

  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: 'A4',
      margins: { top: 38, bottom: 42, left: 48, right: 48 },
      bufferPages: true,
      info: {
        Title: `Letter of Recommendation - ${student.name}`,
        Author: professor.name,
        Subject: request.targetProgram || 'Letter of Recommendation',
        Keywords: 'SmartLOR, Letter of Recommendation',
      },
    });
    const stream = fs.createWriteStream(filePath);
    stream.on('finish', () => resolve({ filename, filePath }));
    stream.on('error', reject);
    doc.pipe(stream);

    const contentWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;
    const footer = (pageNumber) => {
      doc.save();
      doc.font('Helvetica').fontSize(6.7).fillColor('#7c8799');
      doc.text(`${institution} | ${reference}`, doc.page.margins.left, doc.page.height - 27, { width: contentWidth * .72, align: 'left' });
      doc.text(`Page ${pageNumber}`, doc.page.width - doc.page.margins.right - 55, doc.page.height - 27, { width: 55, align: 'right' });
      doc.restore();
    };

    // Compact branded header. The SL mark is application branding, not an institutional seal.
    const topY = doc.y;
    doc.roundedRect(doc.x, topY, 30, 30, 7).fillColor('#4338ca').fill();
    doc.fillColor('#fff').font('Helvetica-Bold').fontSize(9.5).text('SL', doc.x, topY + 10, { width: 30, align: 'center' });
    const brandX = doc.x + 39;
    doc.fillColor('#0f172a').font('Helvetica-Bold').fontSize(13.5).text('SMARTLOR', brandX, topY + 1);
    doc.fillColor('#64748b').font('Helvetica').fontSize(7.2).text('Recommendation workflow', brandX, topY + 16);
    doc.fillColor('#475569').font('Helvetica').fontSize(7.3).text(
      [professor.university, professor.department, professor.email].filter(Boolean).join(' | '),
      doc.page.margins.left + 170, topY + 4, { width: contentWidth - 170, align: 'right' }
    );
    doc.y = topY + 35;
    doc.moveTo(doc.page.margins.left, doc.y).lineTo(doc.page.width - doc.page.margins.right, doc.y)
      .lineWidth(1.1).strokeColor('#6366f1').stroke();
    doc.moveDown(0.42);

    doc.font('Helvetica-Bold').fontSize(16.5).fillColor('#0f172a').text('LETTER OF RECOMMENDATION', { align: 'center' });
    doc.moveDown(0.08);
    doc.font('Helvetica').fontSize(7.3).fillColor('#64748b').text(`Reference ${reference} | ${date}`, { align: 'center' });
    doc.moveDown(0.32);

    // Verification marker uses vector graphics rather than an unsupported Unicode glyph.
    const markerY = doc.y;
    doc.roundedRect(doc.page.margins.left, markerY, contentWidth, 28, 6).fillColor('#f5f3ff').fill();
    drawCheck(doc, doc.page.margins.left + 8, markerY + 4);
    doc.fillColor('#312e81').font('Helvetica-Bold').fontSize(7.7)
      .text('SMARTLOR FACULTY-VERIFIED WORKFLOW', doc.page.margins.left + 31, markerY + 6);
    doc.fillColor('#5b5b76').font('Helvetica').fontSize(6.4)
      .text(`Verified ${verifiedAt} | Draft generated ${date} | ID ${reference}`, doc.page.margins.left + 31, markerY + 16);
    doc.y = markerY + 35;

    doc.font('Helvetica-Bold').fontSize(9.8).fillColor('#0f172a')
      .text(request.recipientName || 'To the Admissions / Selection Committee');
    if (request.targetInstitution) doc.font('Helvetica').fontSize(8.8).text(request.targetInstitution);
    if (request.targetProgram) doc.text(request.targetProgram);
    if (request.recipientAddress) doc.fontSize(7.7).fillColor('#64748b').text(request.recipientAddress);
    doc.moveDown(0.28);

    doc.font('Helvetica').fontSize(10.2).fillColor('#172033').text('Subject: Recommendation for ', { continued: true })
      .font('Helvetica-Bold').text(`${student.name}${request.targetProgram ? ` - ${request.targetProgram}` : ''}`);
    doc.moveDown(0.22);
    doc.font('Helvetica').fontSize(10.2).text('Dear Sir/Madam,');
    doc.moveDown(0.08);

    paragraph(doc, `I am writing in my capacity as ${professor.designation || 'a faculty member'} at ${institution} to recommend ${student.name} for ${request.targetProgram || 'the stated opportunity'}. I have known the applicant${request.relationshipDuration ? ` for ${request.relationshipDuration}` : ''}${request.relationship ? ` as ${request.relationship}` : ''}.`);

    if (request.comparisonGroup || request.comparisonCount || request.assessmentLevel) {
      section(doc, 'Comparative assessment');
      const group = request.comparisonGroup || 'students/individuals I have evaluated';
      const count = request.comparisonCount ? ` among approximately ${request.comparisonCount} people` : '';
      paragraph(doc, `Based on my experience with ${group}${count}, I assess ${student.name} as ${assessmentLabel[request.assessmentLevel] || 'having demonstrated strong potential'}.`);
    }
    if (request.strengths) { section(doc, 'Observed strengths'); paragraph(doc, request.strengths); }
    if (request.evidence) { section(doc, 'Specific evidence and examples'); paragraph(doc, request.evidence); }
    if (request.recommendationText) { section(doc, 'Recommendation'); paragraph(doc, request.recommendationText); }
    if (request.constructiveFeedback) { section(doc, 'Developmental perspective'); paragraph(doc, request.constructiveFeedback); }
    if (request.additionalRemarks) { section(doc, 'Additional remarks'); paragraph(doc, request.additionalRemarks); }

    doc.moveDown(0.08);
    const recommendationY = doc.y;
    doc.roundedRect(doc.x, recommendationY, contentWidth, 24, 6).fillColor('#eefdf5').fill();
    doc.fillColor('#065f46').font('Helvetica-Bold').fontSize(8.0)
      .text(`Recommendation: ${strengthLabel[request.recommendationStrength] || 'Recommendation provided by the recommender'}.`, doc.x + 8, recommendationY + 7, { width: contentWidth - 16, align: 'center' });
    doc.y = recommendationY + 31;

    doc.font('Helvetica').fontSize(10.2).fillColor('#172033').text('Sincerely,');
    doc.moveDown(0.18);
    doc.font('Helvetica-Bold').fontSize(10.0).fillColor('#0f172a').text(professor.name);
    doc.font('Helvetica').fontSize(8.0).fillColor('#475569');
    [professor.designation, professor.department, professor.college, professor.university, professor.email].filter(Boolean).forEach(line => doc.text(line));
    doc.moveDown(0.25);
    doc.fontSize(7.9).text('Signature: __________________________________________');
    doc.moveDown(0.28);
    const noteY = doc.y;
    doc.roundedRect(doc.x, noteY, contentWidth, 27, 5).fillColor('#f8fafc').fill();
    doc.fillColor('#64748b').font('Helvetica').fontSize(6.4)
      .text(`Draft generated for review | ${totalWords} words of recommendation content. The final recommendation must be reviewed and signed by the authorized recommender/institution. SmartLOR branding is a workflow marker, not an institutional seal or digital signature.`, doc.x + 8, noteY + 6, { width: contentWidth - 16, align: 'center', lineGap: 0.8 });

    const range = doc.bufferedPageRange();
    for (let page = range.start; page < range.start + range.count; page += 1) {
      doc.switchToPage(page);
      footer(page - range.start + 1);
    }
    doc.flushPages();
    doc.end();
  });
}
