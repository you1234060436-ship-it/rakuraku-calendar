// Receipt Feature for nichilog-v2
// Separate file loaded by nichilog-v2.html

function initReceiptFeature() {
  if (!document.getElementById('receipt-feature-styles')) {
    const s = document.createElement('style');
    s.id = 'receipt-feature-styles';
    s.textContent = `
      #receiptFormOverlay{position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,.5);display:none;align-items:center;justify-content:center;z-index:1000}
      #receiptFormOverlay.show{display:flex}
      .rcpt-form{background:#fff;border-radius:12px;padding:24px;width:90%;max-width:500px;max-height:85vh;overflow-y:auto;position:relative}
      .rcpt-form h2{margin:0 0 18px;color:#1a237e;font-size:20px}
      .rcpt-fg{margin-bottom:14px}
      .rcpt-fg label{display:block;font-weight:600;margin-bottom:4px;color:#333;font-size:13px}
      .rcpt-fg input,.rcpt-fg select{width:100%;padding:8px 10px;border:1px solid #ddd;border-radius:6px;font-size:14px;box-sizing:border-box}
      .rcpt-fg input:focus,.rcpt-fg select:focus{outline:none;border-color:#2563EB}
      .rcpt-fg input[readonly]{background:#f5f5f5;color:#666}
      .rcpt-row{display:grid;grid-template-columns:1fr 1fr;gap:12px}
      .rcpt-calc{background:#f5f5f5;border-radius:6px;padding:10px 14px;margin-bottom:14px;font-size:13px}
      .rcpt-calc div{display:flex;justify-content:space-between;padding:3px 0;color:#555}
      .rcpt-calc .total{font-size:15px;font-weight:700;color:#1a237e;border-top:1px solid #ddd;padding-top:6px;margin-top:6px}
      .rcpt-actions{display:flex;gap:10px;margin-top:18px;justify-content:flex-end}
      .rcpt-actions button{padding:8px 18px;border:none;border-radius:6px;cursor:pointer;font-weight:600;font-size:13px}
      .rcpt-btn-cancel{background:#999;color:#fff}
      .rcpt-btn-preview{background:#FF9800;color:#fff}
      .rcpt-btn-save{background:#4CAF50;color:#fff}
    `;
    document.head.appendChild(s);
  }
  if (!document.getElementById('receiptFormOverlay')) {
    const o = document.createElement('div');
    o.id = 'receiptFormOverlay';
    o.innerHTML = `<div class="rcpt-form">
      <h2>\u9818\u53ce\u66f8\u4f5c\u6210</h2>
      <div class="rcpt-fg"><label>\u767a\u884c\u5143\u4f1a\u793e\u540d</label><input type="text" id="rcptIssuer" readonly></div>
      <div class="rcpt-fg"><label>\u5b9b\u5148\u4f1a\u793e</label><select id="rcptClient"><option value="">-- \u9078\u629e --</option></select></div>
      <div class="rcpt-row">
        <div class="rcpt-fg"><label>\u5408\u8a08\u91d1\u984d\uff08\u7a0e\u8fbc\uff09</label><input type="number" id="rcptTotal" placeholder="0" min="0" oninput="calcRcptTax()"></div>
        <div class="rcpt-fg"><label>\u7a0e\u7387</label><select id="rcptTaxRate" onchange="calcRcptTax()"><option value="0.08">8%</option><option value="0.10" selected>10%</option></select></div>
      </div>
      <div class="rcpt-calc">
        <div><span>\u7a0e\u629c\u91d1\u984d:</span><span id="rcptExcl">&yen;0</span></div>
        <div><span>\u6d88\u8cbb\u7a0e\u984d:</span><span id="rcptTaxAmt">&yen;0</span></div>
        <div class="total"><span>\u5408\u8a08:</span><span id="rcptSubtotal">&yen;0</span></div>
      </div>
      <div class="rcpt-fg"><label>\u4f46\u3057\u66f8\u304d</label><input type="text" id="rcptDesc" placeholder="\u5de5\u4e8b\u4ee3\u91d1\u3068\u3057\u3066"></div>
      <div class="rcpt-row">
        <div class="rcpt-fg"><label>\u767a\u884c\u65e5</label><input type="date" id="rcptDate"></div>
        <div class="rcpt-fg"><label>\u9818\u53ce\u66f8No.</label><input type="text" id="rcptNo" readonly></div>
      </div>
      <div class="rcpt-fg"><label>\u30a4\u30f3\u30dc\u30a4\u30b9\u767b\u9332\u756a\u53f7</label><input type="text" id="rcptRegNo" readonly></div>
      <div class="rcpt-actions">
        <button class="rcpt-btn-cancel" onclick="closeRcptForm()">\u30ad\u30e3\u30f3\u30bb\u30eb</button>
        <button class="rcpt-btn-preview" onclick="previewRcpt()">\u30d7\u30ec\u30d3\u30e5\u30fc / \u5370\u5237</button>
        <button class="rcpt-btn-save" onclick="saveRcpt()">\u4fdd\u5b58</button>
      </div>
    </div>`;
    document.body.appendChild(o);
  }
}

function openRcptForm() {
  initReceiptFeature();
  const ov = document.getElementById('receiptFormOverlay');
  const today = new Date();
  const ym = today.getFullYear() + '-' + String(today.getMonth()+1).padStart(2,'0');
  const ymd = ym + '-' + String(today.getDate()).padStart(2,'0');
  document.getElementById('rcptIssuer').value = company ? company.name : '';
  document.getElementById('rcptDate').value = ymd;
  document.getElementById('rcptNo').value = 'R-' + ym.replace('-','') + '-' + String(Math.floor(Math.random()*999)+1).padStart(3,'0');
  document.getElementById('rcptRegNo').value = document.getElementById('invoiceRegNo') ? document.getElementById('invoiceRegNo').value : 'T0000000000000';
  document.getElementById('rcptTotal').value = '';
  document.getElementById('rcptDesc').value = '';
  document.getElementById('rcptExcl').textContent = '\u00a50';
  document.getElementById('rcptTaxAmt').textContent = '\u00a50';
  document.getElementById('rcptSubtotal').textContent = '\u00a50';
  // load client companies
  const sel = document.getElementById('rcptClient');
  sel.innerHTML = '<option value="">-- \u9078\u629e --</option>';
  sbGet('client_companies', 'company_id=eq.' + company.id).then(data => {
    if (Array.isArray(data)) data.forEach(c => {
      sel.innerHTML += '<option value="' + c.id + '">' + c.name + '</option>';
    });
  });
  ov.classList.add('show');
}

function closeRcptForm() {
  const ov = document.getElementById('receiptFormOverlay');
  if (ov) ov.classList.remove('show');
}

function calcRcptTax() {
  const total = parseFloat(document.getElementById('rcptTotal').value) || 0;
  const rate = parseFloat(document.getElementById('rcptTaxRate').value) || 0.10;
  const excl = Math.round(total / (1 + rate));
  const tax = Math.round(total - excl);
  document.getElementById('rcptExcl').textContent = '\u00a5' + excl.toLocaleString();
  document.getElementById('rcptTaxAmt').textContent = '\u00a5' + tax.toLocaleString();
  document.getElementById('rcptSubtotal').textContent = '\u00a5' + total.toLocaleString();
}

function previewRcpt() {
  const date = document.getElementById('rcptDate').value;
  const no = document.getElementById('rcptNo').value;
  const csel = document.getElementById('rcptClient');
  const cname = csel.options[csel.selectedIndex] ? csel.options[csel.selectedIndex].text : '';
  const total = parseFloat(document.getElementById('rcptTotal').value) || 0;
  const rate = parseFloat(document.getElementById('rcptTaxRate').value) || 0.10;
  const desc = document.getElementById('rcptDesc').value || '\u5DE5\u4E8B\u4EE3\u91D1\u3068\u3057\u3066';
  const regNo = document.getElementById('rcptRegNo').value;
  const issuer = document.getElementById('rcptIssuer').value;
  const excl = Math.round(total / (1 + rate));
  const tax = Math.round(total - excl);
  const pct = (rate * 100).toFixed(0);
  const stamp = total >= 50000;
  const fmtDate = date ? new Date(date + 'T00:00:00').toLocaleDateString('ja-JP') : '';
  const fmt = n => '\u00a5' + n.toLocaleString();

  const h = `<!DOCTYPE html><html lang="ja"><head><meta charset="UTF-8"><title>\u9818\u53CE\u66F8 ${no}</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:"Hiragino Sans","Yu Gothic",sans-serif;background:#f5f5f5;padding:20px}
.rc{width:210mm;min-height:297mm;background:#fff;margin:0 auto;padding:40px;box-shadow:0 2px 10px rgba(0,0,0,.1);position:relative}
.rh{background:linear-gradient(135deg,#1a237e 0%,#283593 100%);color:#fff;padding:24px;margin:-40px -40px 30px;text-align:center}
.rh h1{font-size:42px;font-weight:700;letter-spacing:6px}
.rm{display:flex;justify-content:space-between;margin-bottom:24px;font-size:13px}
.rm div{display:flex;flex-direction:column}
.rm label{font-weight:600;color:#888;margin-bottom:2px;font-size:11px}
.rm span{color:#333;font-weight:500}
.rt{margin-bottom:24px;padding:16px 20px;background:#f9f9f9;border-left:4px solid #1a237e}
.rt small{font-size:11px;color:#999;font-weight:600}
.rt .name{font-size:20px;font-weight:600;color:#333;margin-top:4px}
.ra{text-align:center;margin:30px 0;padding:20px;border:2px solid #1a237e;border-radius:8px}
.ra .lbl{font-size:11px;color:#888;margin-bottom:8px;font-weight:600}
.ra .amt{font-size:38px;font-weight:700;color:#1a237e;letter-spacing:2px}
.ra .sub{font-size:12px;color:#666;margin-top:4px}
.rd{margin-bottom:24px;padding:14px;background:#fafafa;border:1px solid #eee;border-radius:4px}
.rd small{font-size:11px;color:#999;font-weight:600}
.rd p{font-size:14px;color:#333;margin-top:6px}
table{width:100%;border-collapse:collapse;margin-bottom:24px;font-size:13px}
th{background:#f0f0f0;border:1px solid #ddd;padding:8px 12px;text-align:right;font-weight:600}
td{border:1px solid #ddd;padding:8px 12px;text-align:right}
.tl{text-align:left}
.totrow{background:#f0f0f0;font-weight:700}
.stamp{margin:20px auto;width:80px;height:80px;border:3px solid #d32f2f;border-radius:50%;display:flex;align-items:center;justify-content:center;font-weight:700;color:#d32f2f;font-size:16px}
.inkan{text-align:center;margin:20px 0}
.ack{text-align:center;margin:20px 0;font-size:14px;color:#333}
.ri{text-align:center;margin-top:30px;padding-top:20px;border-top:1px solid #ddd}
.ri .nm{font-size:16px;font-weight:600;color:#1a237e;margin-bottom:6px}
.ri .rg{font-size:11px;color:#999}
.noprint{text-align:center;margin-bottom:20px}
.noprint button{padding:10px 24px;background:#1a237e;color:#fff;border:none;border-radius:6px;font-size:14px;cursor:pointer;font-weight:600}
@media print{body{padding:0;background:#fff}.rc{box-shadow:none;margin:0;padding:30px;width:100%;min-height:auto}.noprint{display:none!important}}
</style></head><body>
<div class="noprint"><button onclick="window.print()">\u5370\u5237 / PDF</button></div>
<div class="rc">
<div class="rh"><h1>\u9818\u53CE\u66F8</h1></div>
<div class="rm"><div><label>\u9818\u53CE\u66F8No.</label><span>${no}</span></div><div><label>\u767A\u884C\u65E5</label><span>${fmtDate}</span></div></div>
<div class="rt"><small>\u4E0B\u8A18\u306E\u901A\u308A\u9818\u53CE\u3044\u305F\u3057\u307E\u3059</small><div class="name">${cname} \u69D8</div></div>
<div class="ra"><div class="lbl">\u91D1\u984D</div><div class="amt">${fmt(total)}-</div><div class="sub">\uFF08\u7A0E\u8FBC\u307F\uFF09</div></div>
<div class="rd"><small>\u4F46\u3057\u66F8\u304D</small><p>${desc}</p></div>
<table><thead><tr><th class="tl">\u9805\u76EE</th><th>\u91D1\u984D</th></tr></thead><tbody>
<tr><td class="tl">\u7A0E\u629C\u91D1\u984D</td><td>${fmt(excl)}</td></tr>
<tr><td class="tl">\u6D88\u8CBB\u7A0E\uFF08${pct}%\uFF09</td><td>${fmt(tax)}</td></tr>
<tr class="totrow"><td class="tl">\u5408\u8A08</td><td>${fmt(total)}</td></tr>
</tbody></table>
${stamp ? '<div class="inkan"><div style="display:inline-block;padding:12px 20px;border:2px dashed #ccc;color:#999;font-size:11px;margin-bottom:10px">\u53CE\u5165\u5370\u7D19</div></div>' : ''}
<div class="ack">\u4E0A\u8A18\u6B63\u306B\u9818\u53CE\u3044\u305F\u3057\u307E\u3057\u305F</div>
<div class="ri">
  <div class="nm">${issuer}</div>
  <div class="rg">\u30A4\u30F3\u30DC\u30A4\u30B5\u767B\u9332\u756A\u53F7: ${regNo}</div>
  <div style="margin-top:16px"><div class="stamp">\u5370</div></div>
</div>
</div></body></html>`;

  const w = window.open('', '_blank');
  if (w) { w.document.write(h); w.document.close(); }
  else { alert('\u30DD\u30C3\u30D7\u30A2\u30C3\u30D7\u304C\u30D6\u30ED\u30C3\u30AF\u3055\u308C\u307E\u3057\u305F'); }
}

function saveRcpt() {
  const cid = document.getElementById('rcptClient').value;
  if (!cid) { alert('\u5B9B\u5148\u4F1A\u793E\u3092\u9078\u629E\u3057\u3066\u304F\u3060\u3055\u3044'); return; }
  const total = parseFloat(document.getElementById('rcptTotal').value) || 0;
  if (!total) { alert('\u91D1\u984D\u3092\u5165\u529B\u3057\u3066\u304F\u3060\u3055\u3044'); return; }
  const rate = parseFloat(document.getElementById('rcptTaxRate').value) || 0.10;
  const excl = Math.round(total / (1 + rate));
  const tax = Math.round(total - excl);
  sbPost('receipts', {
    company_id: company.id,
    client_company_id: parseInt(cid),
    receipt_no: document.getElementById('rcptNo').value,
    issue_date: document.getElementById('rcptDate').value,
    total_amount: total,
    tax_rate: rate,
    tax_excluded: excl,
    tax_amount: tax,
    description: document.getElementById('rcptDesc').value || null,
    registration_no: document.getElementById('rcptRegNo').value
  }).then(r => {
    if (r && r.length) { showToast('\u9818\u53CE\u66F8\u3092\u4FDD\u5B58\u3057\u307E\u3057\u305F'); closeRcptForm(); }
    else { showToast('\u4FDD\u5B58\u306B\u5931\u6557\u3057\u307E\u3057\u305F'); }
  }).catch(e => { console.error(e); showToast('\u4FDD\u5B58\u30A8\u30E9\u30FC'); });
}
