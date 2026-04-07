// generate.js — creates minimal, text-layer PDFs for testing AI Document Intelligence
// Run: node test-documents/generate.js
// No external dependencies required.

const fs = require("fs");
const path = require("path");

// ─── PDF builder ──────────────────────────────────────────────────────────────

function buildPdf(lines) {
  // lines: array of strings to render top-to-bottom
  // We use Courier (built-in font), 10pt, uncompressed content stream

  const FONT_SIZE = 10;
  const LEFT_X    = 50;
  const TOP_Y     = 780;
  const LINE_H    = 14;

  // Build content stream (BT ... ET block)
  let streamContent = "BT\n";
  streamContent += "/F1 " + FONT_SIZE + " Tf\n";
  lines.forEach((line, i) => {
    const y = TOP_Y - i * LINE_H;
    // Escape PDF special chars in string
    const escaped = line
      .replace(/\\/g, "\\\\")
      .replace(/\(/g, "\\(")
      .replace(/\)/g, "\\)");
    streamContent += "1 0 0 1 " + LEFT_X + " " + y + " Tm\n";
    streamContent += "(" + escaped + ") Tj\n";
  });
  streamContent += "ET\n";

  const streamBytes = Buffer.from(streamContent, "latin1");
  const streamLen   = streamBytes.length;

  // We'll assemble 5 objects:
  // 1 = Catalog, 2 = Pages, 3 = Page, 4 = Content, 5 = Font

  let pdf   = "";
  const off = {};  // object → byte offset

  pdf += "%PDF-1.4\n";

  // Object 1: Catalog
  off[1] = pdf.length;
  pdf += "1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n";

  // Object 2: Pages
  off[2] = pdf.length;
  pdf += "2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n";

  // Object 3: Page
  off[3] = pdf.length;
  pdf += "3 0 obj\n<< /Type /Page /Parent 2 0 R\n";
  pdf += "   /MediaBox [0 0 612 842]\n";
  pdf += "   /Contents 4 0 R\n";
  pdf += "   /Resources << /Font << /F1 5 0 R >> >> >>\nendobj\n";

  // Object 4: Content stream
  off[4] = pdf.length;
  pdf += "4 0 obj\n<< /Length " + streamLen + " >>\nstream\n";
  const pdfBuf1 = Buffer.from(pdf, "latin1");
  const combined = Buffer.concat([pdfBuf1, streamBytes]);
  let tail  = "\nendstream\nendobj\n";

  // Object 5: Font
  const obj5Start = combined.length + tail.length;
  tail += "5 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Courier >>\nendobj\n";

  // xref
  const xrefPos = combined.length + tail.length;
  tail += "xref\n";
  tail += "0 6\n";
  tail += "0000000000 65535 f \n";

  // Re-compute offsets now that we know all byte positions
  const base = pdfBuf1.length;  // header + objs 1-3 are in pdfBuf1
  // off[1], off[2], off[3] are already correct (they were string offsets = byte offsets for ASCII)
  // off[4] is also correct
  const off5 = combined.length + ("\nendstream\nendobj\n").length;

  function pad(n) { return String(n).padStart(10, "0"); }

  tail = "\nendstream\nendobj\n";
  tail += "5 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Courier >>\nendobj\n";

  const xrefOffset = combined.length + tail.length;

  tail += "xref\n";
  tail += "0 6\n";
  tail += "0000000000 65535 f \n";
  tail += pad(off[1]) + " 00000 n \n";
  tail += pad(off[2]) + " 00000 n \n";
  tail += pad(off[3]) + " 00000 n \n";
  tail += pad(off[4]) + " 00000 n \n";
  // off[5] = combined.length + "\nendstream\nendobj\n".length
  const off5actual = combined.length + "\nendstream\nendobj\n".length;
  tail += pad(off5actual) + " 00000 n \n";
  tail += "trailer\n<< /Size 6 /Root 1 0 R >>\n";
  tail += "startxref\n" + xrefOffset + "\n%%EOF\n";

  return Buffer.concat([combined, Buffer.from(tail, "latin1")]);
}

// ─── Document content ─────────────────────────────────────────────────────────

const invoice = [
  "COMMERCIAL INVOICE",
  "",
  "Invoice Number: CI-2025-04789",
  "Invoice Date: 2025-03-15",
  "Purchase Order: PO-EU-88231",
  "",
  "SHIPPER:",
  "Indra Tech Exports Pvt. Ltd.",
  "Plot 14, SEEPZ Special Economic Zone",
  "Andheri East, Mumbai - 400096, India",
  "GSTIN: 27AABCI1234F1Z5",
  "",
  "CONSIGNEE:",
  "EuroTech Distribution B.V.",
  "Transistorweg 12, 5transistorweg",
  "5616 KJ Eindhoven, Netherlands",
  "VAT: NL854321098B01",
  "",
  "ORIGIN COUNTRY: India",
  "DESTINATION COUNTRY: Netherlands",
  "PORT OF LOADING: Nhava Sheva (INNSA)",
  "PORT OF DISCHARGE: Rotterdam (NLRTM)",
  "",
  "DESCRIPTION OF GOODS:",
  "Electronic Integrated Circuits - Microprocessors",
  "HS Code: 8542.31",
  "Model: IT-PROC-X200 Series",
  "",
  "QUANTITY:   4,800 units",
  "UNIT PRICE: USD 38.55",
  "NET WEIGHT: 4,800 kg",
  "GROSS WEIGHT: 5,040 kg",
  "",
  "SUBTOTAL:   USD 185,040.00",
  "FREIGHT:    USD 3,200.00",
  "INSURANCE:  USD 555.12",
  "TOTAL INVOICE VALUE: USD 188,795.12",
  "CURRENCY: USD",
  "TERMS: CIF Rotterdam",
  "PAYMENT TERMS: 60 days from B/L date",
  "",
  "BANK DETAILS:",
  "Account Name: Indra Tech Exports Pvt. Ltd.",
  "Bank: HDFC Bank Ltd.",
  "Account No: 50200034567890",
  "SWIFT: HDFCINBB",
  "",
  "DECLARATION: We certify that the information in this",
  "invoice is true and correct and that the contents",
  "and value are as stated above.",
  "",
  "Authorised Signatory: Rajesh Kumar, Director",
  "Date: 2025-03-15",
];

const packingList = [
  "PACKING LIST",
  "",
  "Packing List Ref: PL-2025-04789",
  "Date: 2025-03-15",
  "Linked Invoice: CI-2025-04789",
  "",
  "SHIPPER:",
  "Indra Tech Exports Pvt. Ltd.",
  "Plot 14, SEEPZ Special Economic Zone",
  "Andheri East, Mumbai - 400096, India",
  "",
  "CONSIGNEE:",
  "EuroTech Distribution B.V.",
  "Transistorweg 12, 5616 KJ Eindhoven, Netherlands",
  "",
  "ORIGIN: India",
  "DESTINATION: Netherlands",
  "",
  "CARGO DETAILS:",
  "Product: Electronic Integrated Circuits - Microprocessors",
  "HS Code: 8542.31",
  "",
  "PACKING SUMMARY:",
  "Number of Cartons: 120",
  "Units per Carton: 40",
  "Total Units: 4,800",
  "",
  "WEIGHT AND VOLUME:",
  "Net Weight per Carton: 39.00 kg",
  "Total Net Weight: 4,680 kg",
  "Gross Weight per Carton: 42.00 kg",
  "Total Gross Weight: 5,040 kg",
  "Volume per Carton: 0.060 CBM",
  "Total Volume: 7.20 CBM",
  "",
  "CARTON DIMENSIONS (each):",
  "Length: 60 cm  Width: 40 cm  Height: 25 cm",
  "",
  "MARKING & NUMBERING:",
  "Cartons 1/120 through 120/120",
  "Marks: IT-PROC-X200 / PO-EU-88231",
  "Country of Origin: INDIA",
  "",
  "HAZARDOUS: No",
  "REFRIGERATION REQUIRED: No",
  "",
  "Prepared by: Suresh Patel, Logistics Manager",
  "Date: 2025-03-15",
];

const billOfLading = [
  "BILL OF LADING",
  "",
  "B/L Number: BL-MAEU-2025-9834",
  "Booking Reference: MAEU-BK-229174",
  "Date of Issue: 2025-03-18",
  "",
  "SHIPPER:",
  "Indra Tech Exports Pvt. Ltd.",
  "Plot 14, SEEPZ SEZ, Mumbai 400096, India",
  "",
  "CONSIGNEE:",
  "EuroTech B.V.",
  "Transistorweg 12, 5616 KJ Eindhoven, Netherlands",
  "",
  "NOTIFY PARTY:",
  "DHL Global Forwarding Netherlands B.V.",
  "Polarisavenue 140, 2132 JX Hoofddorp",
  "",
  "VESSEL: MSC AURELIUS  VOYAGE: 025W",
  "PORT OF LOADING: Nhava Sheva, India",
  "PORT OF DISCHARGE: Rotterdam, Netherlands",
  "PLACE OF DELIVERY: Eindhoven, Netherlands",
  "",
  "CONTAINER DETAILS:",
  "Container No: MAEU4501832",
  "Seal No: ML-229174A",
  "Container Type: 20ft Standard",
  "",
  "DESCRIPTION OF GOODS:",
  "ELECTRONIC INTEGRATED CIRCUITS",
  "MICROPROCESSORS — MODEL IT-PROC-X200",
  "HS CODE: 8542.31",
  "120 CARTONS",
  "",
  "FREIGHT DETAILS:",
  "Gross Weight: 5,040 KG",
  "Volume: 7.20 CBM",
  "Declared Value: USD 185,040.00",
  "",
  "FREIGHT: PREPAID",
  "PLACE AND DATE OF ISSUE: Mumbai, 2025-03-18",
  "",
  "SHIPPED ON BOARD DATE: 2025-03-20",
  "ETA ROTTERDAM: 2025-04-09",
  "",
  "Original B/L: 3 originals issued",
  "Carrier: Maersk Line",
  "Signed: Captain's Agent",
];

// ─── Write files ───────────────────────────────────────────────────────────────

const outDir = path.join(__dirname);

fs.writeFileSync(path.join(outDir, "commercial-invoice.pdf"),  buildPdf(invoice));
fs.writeFileSync(path.join(outDir, "packing-list.pdf"),        buildPdf(packingList));
fs.writeFileSync(path.join(outDir, "bill-of-lading.pdf"),      buildPdf(billOfLading));

console.log("✓ commercial-invoice.pdf");
console.log("✓ packing-list.pdf");
console.log("✓ bill-of-lading.pdf");
console.log("");
console.log("Intentional cross-document mismatches for testing:");
console.log("  • Net weight: Invoice=4,800 kg  Packing List=4,680 kg  (2.5% discrepancy)");
console.log("  • Consignee:  Invoice='EuroTech Distribution B.V.'  B/L='EuroTech B.V.'");
console.log("  • Declared value: Invoice=USD 185,040  B/L=USD 185,040  (consistent)");
console.log("  • HS Code 8542.31 consistent across all three documents");
