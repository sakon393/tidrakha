// Reads PUMA "Sum of Stock On Hand" PDF reports (FTW and APP) into { sku: [sizes in stock] }.
// Each page has a header row (SKU, Style, Gender, Size (Int.), Total, ...); a product's first row
// carries its 8-digit SKU, the rows under it carry only a size and its stock.
(function (root) {
  const ROW_TOLERANCE = 2;   // text items whose baselines differ by less than this are one row

  function rowsOf(items) {
    const rows = [];
    items
      .filter((it) => it.str.trim())
      .sort((a, b) => b.y - a.y || a.x - b.x)
      .forEach((it) => {
        const last = rows[rows.length - 1];
        if (last && Math.abs(last.y - it.y) < ROW_TOLERANCE) last.cells.push(it);
        else rows.push({ y: it.y, cells: [it] });
      });
    return rows;
  }

  // pages: [[{ str, x, y }]] with y growing upwards, as pdf.js reports it.
  function parseStock(pages) {
    const stock = {};
    let division = '';   // "Prod Div Short": FTW or APP
    let sku = null;
    let cols = null;   // column x positions; only the first page has the header row
    pages.forEach((items) => {
      const rows = rowsOf(items);
      const divRow = !division && rows.find((r) => r.cells.some((c) => c.str.trim() === 'Prod Div Short'));
      if (divRow) {
        const value = divRow.cells.find((c) => c.str.trim() !== 'Prod Div Short');
        division = value ? value.str.trim().toUpperCase() : '';
      }
      const header = rows.find((r) => r.cells.some((c) => c.str.trim() === 'SKU'));
      if (header) {
        const at = (name) => {
          const cell = header.cells.find((c) => c.str.trim().startsWith(name));
          return cell ? cell.x : null;
        };
        const found = { skuX: at('SKU'), sizeX: at('Size'), totalX: at('Total'), rrpX: at('RRP') };
        if (found.sizeX !== null && found.totalX !== null) cols = found;
      }
      if (!cols) return;
      const { skuX, sizeX, totalX, rrpX } = cols;
      const near = (cell, x, left, right) => cell.x >= x - left && cell.x < x + right;
      rows.filter((r) => !header || r.y < header.y).forEach((row) => {
        const first = row.cells.find((c) => near(c, skuX, 12, 40) && /^\d{6,10}$/.test(c.str.trim()));
        if (first) sku = first.str.trim();
        if (!sku) return;
        const size = row.cells.find((c) => near(c, sizeX, 6, totalX - sizeX - 4));
        if (!size || size.str.trim() === 'Total') return;
        const qtyCell = row.cells.find((c) => c !== size && c.x >= totalX - 12 && (rrpX === null || c.x < rrpX - 2));
        const qty = qtyCell ? parseInt(qtyCell.str, 10) : 1;
        if (!(qty > 0)) return;
        const list = stock[sku] || (stock[sku] = []);
        const name = size.str.trim().toUpperCase();
        if (!list.includes(name)) list.push(name);
      });
    });
    return { division, stock };
  }

  // Loads pdf.js only when a file is added; it is large and the rest of the app never needs it.
  let loading = null;
  function loadPdfJs() {
    if (!loading) {
      loading = new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = 'lib/pdf.min.js';
        script.onload = () => {
          root.pdfjsLib.GlobalWorkerOptions.workerSrc = 'lib/pdf.worker.min.js';
          resolve(root.pdfjsLib);
        };
        script.onerror = () => { loading = null; reject(new Error('pdf.js missing')); };
        document.head.appendChild(script);
      });
    }
    return loading;
  }

  async function readStockPdf(file) {
    const pdfjs = await loadPdfJs();
    const doc = await pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise;
    const pages = [];
    for (let p = 1; p <= doc.numPages; p++) {
      const page = await doc.getPage(p);
      const content = await page.getTextContent();
      pages.push(content.items.map((it) => ({ str: it.str, x: it.transform[4], y: it.transform[5] })));
      page.cleanup();
    }
    doc.destroy();
    return parseStock(pages);
  }

  // Codes are typed as 10669616, 106696-16 or 106696 16.
  const skuKey = (text) => String(text || '').replace(/\D/g, '');

  root.Stock = { parseStock, readStockPdf, skuKey };
})(globalThis);
