// Receipt Feature for nichilog-v2
// Separate file loaded by nichilog-v2.html

function initReceiptFeature() {
  if (!document.getElementById('receipt-feature-styles')) {
    const s = document.createElement('style');
    s.id = 'receipt-feature-styles';
    s.textContent = `
      #receiptFormOverlay{position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,.5);display:none;align-items:center;justify-content:center;z-index:1000}
      #receiptFormOverlay.show{display:flex}
      #receiptPreviewOverlay{position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,.7);display:none;align-items:center;justify-content:center;z-index:1100;overflow:auto;padding:20px 0}
      #receiptPreviewOverlay.show{display:flex}
      .rcpt-preview-wrap{position:relative}
      .rcpt-preview-bar{position:sticky;top:0;z-index:10;display:flex;justify-content:center;gap:10px;padding:10px 0 14px;background:linear-gradient(rgba(0,0,0,.7),transparent)}
      .rcpt-preview-bar button{padding:8px 22px;border:none;border-radius:8px;font-size:13px;cursor:pointer;font-weight:600;box-shadow:0 2px 8px rgba(0,0,0,.3)}
      .rcpt-preview-bar .bp{background:#1a237e;color:#fff}
      .rcpt-preview-bar .bc{background:rgba(255,255,255,.9);color:#333}
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
      .rp-a4{width:210mm;min-height:297mm;background:#fff;display:flex;align-items:center;justify-content:center;box-shadow:0 2px 16px rgba(0,0,0,.15);margin:0 auto}
      .rp-b5{width:182mm;border:1px solid #333;overflow:hidden;font-family:"Hiragino Sans","Yu Gothic",sans-serif}
      .rp-b5 *{margin:0;padding:0;box-sizing:border-box}
      .rp-head{display:flex;justify-content:space-between;align-items:center}
      .rp-title{background:#1a237e;color:#fff;font-size:18px;font-weight:700;letter-spacing:8px;padding:10px 28px}
      .rp-date{font-size:11px;color:#444;padding-right:16px;text-align:right;line-height:1.6}
      .rp-date span{display:block}
      .rp-to{text-align:center;padding:14px 20px 10px;border-bottom:1px solid #333;font-size:16px;font-weight:600;color:#222}
      .rp-amt-row{display:flex;align-items:stretch;border-bottom:1px solid #333}
      .rp-amt-box{flex:1;text-align:center;padding:14px 10px;border-right:1px solid #333}
      .rp-amt-val{font-size:28px;font-weight:800;color:#1a237e;letter-spacing:1px}
      .rp-stamp-box{width:72px;display:flex;align-items:center;justify-content:center;flex-direction:column;padding:6px}
      .rp-stamp-frame{width:56px;height:56px;border:2px dashed #aaa;display:flex;align-items:center;justify-content:center;font-size:9px;color:#999}
      .rp-desc{padding:10px 20px;font-size:12px;color:#333;border-bottom:1px solid #ccc}
      .rp-desc span{color:#888;margin-right:6px}
      .rp-bottom{display:flex;padding:12px 16px 14px}
      .rp-bd{flex:1;font-size:11px;color:#333}
      .rp-bd table{width:100%;border-collapse:collapse}
      .rp-bd th{text-align:left;font-weight:600;background:#f5f5f5;border:1px solid #ccc;padding:4px 8px;font-size:10px;color:#444}
      .rp-bd td{border:1px solid #ccc;padding:4px 8px;font-size:11px}
      .rp-bd td.n{text-align:right}
      .rp-bd .tot{background:#f0f0f0;font-weight:700}
      .rp-iss{width:200px;text-align:center;padding-left:12px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:4px}
      .rp-iss .nm{font-size:13px;font-weight:700;color:#1a237e}
      .rp-iss .rg{font-size:9px;color:#888}
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
        <button class="rcpt-btn-preview" onclick="previewRcpt()">PDF\u4F5C\u6210</button>
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
  const prefix = 'R-' + ym.replace('-','') + '-';
  document.getElementById('rcptNo').value = prefix + '001';
  sbGet('receipts', 'company_id=eq.' + company.id + '&receipt_no=like.' + prefix + '*&order=receipt_no.desc&limit=1').then(rows => {
    if (rows && rows.length) {
      const last = rows[0].receipt_no;
      const num = parseInt(last.split('-').pop(), 10) || 0;
      document.getElementById('rcptNo').value = prefix + String(num + 1).padStart(3, '0');
    }
  });
  document.getElementById('rcptRegNo').value = document.getElementById('invoiceRegNo') ? document.getElementById('invoiceRegNo').value : 'T0000000000000';
  document.getElementById('rcptTotal').value = '';
  document.getElementById('rcptDesc').value = '';
  document.getElementById('rcptExcl').textContent = '\u00a50';
  document.getElementById('rcptTaxAmt').textContent = '\u00a50';
  document.getElementById('rcptSubtotal').textContent = '\u00a50';
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
  const tax8 = pct === '8' ? tax : 0;
  const tax10 = pct === '10' ? tax : 0;

  const body = `<div class="rp-a4"><div class="rp-b5">
  <div class="rp-head"><div class="rp-title">\u9818\u3000\u53CE\u3000\u66F8</div><div class="rp-date"><span>No. ${no}</span><span>${fmtDate}</span></div></div>
  <div class="rp-to">${cname}\u3000\u69D8</div>
  <div class="rp-amt-row"><div class="rp-amt-box"><div class="rp-amt-val">${fmt(total)}-</div></div>${stamp ? '<div class="rp-stamp-box"><div class="rp-stamp-frame">\u53CE\u5165\u5370\u7D19</div></div>' : '<div class="rp-stamp-box"></div>'}</div>
  <div class="rp-desc"><span>\u4F46</span>${desc}\u3000\u4E0A\u8A18\u6B63\u306B\u9818\u53CE\u3044\u305F\u3057\u307E\u3057\u305F\u3002</div>
  <div class="rp-bottom"><div class="rp-bd"><table>
    <tr><th>\u5185\u8A33</th><th style="text-align:right">\u91D1\u984D</th></tr>
    <tr><td>\u5C0F\u8A08\u3000\u2460</td><td class="n">${fmt(excl)}</td></tr>
    <tr><td>\u6D88\u8CBB\u7A0E\u7B49\u3000\u2461\uFF08\u2463\uFF0B\u2464\uFF09</td><td class="n">${fmt(tax)}</td></tr>
    <tr class="tot"><td>\u5408\u8A08\u3000\u2462\uFF08\u2460\uFF0B\u2461\uFF09</td><td class="n">${fmt(total)}</td></tr>
    <tr><td>(8%)\u6D88\u8CBB\u7A0E\u5408\u8A08\u3000\u2463</td><td class="n">${fmt(tax8)}</td></tr>
    <tr><td>(10%)\u6D88\u8CBB\u7A0E\u5408\u8A08\u3000\u2464</td><td class="n">${fmt(tax10)}</td></tr>
  </table></div><div class="rp-iss"><div class="nm">${issuer}</div><div class="rg">\u30A4\u30F3\u30DC\u30A4\u30B9\u767B\u9332\u756A\u53F7</div><div class="rg">${regNo}</div></div></div>
</div></div>`;

  // Store body HTML for print
  window._rcptPrintBody = body;

  let ov = document.getElementById('receiptPreviewOverlay');
  if (!ov) {
    ov = document.createElement('div');
    ov.id = 'receiptPreviewOverlay';
    ov.addEventListener('click', function(e) { if (e.target === ov) closeRcptPreview(); });
    document.body.appendChild(ov);
  }
  ov.innerHTML = '<div class="rcpt-preview-wrap">'
    + '<div class="rcpt-preview-bar"><button class="bp" onclick="printRcpt()">PDF\u4F5C\u6210</button><button class="bc" onclick="closeRcptPreview()">\u9589\u3058\u308B</button></div>'
    + body + '</div>';
  ov.classList.add('show');
  // Hide the form overlay while preview is showing
  document.getElementById('receiptFormOverlay').classList.remove('show');
}

function closeRcptPreview() {
  const ov = document.getElementById('receiptPreviewOverlay');
  if (ov) ov.classList.remove('show');
  // Re-show the form
  document.getElementById('receiptFormOverlay').classList.add('show');
}

async function printRcpt(){const overlay=document.getElementById('receiptPreviewOverlay');if(!overlay)return;const printArea=overlay.querySelector('#receiptPage')||overlay;const canvas=await html2canvas(printArea,{scale:2,useCORS:true,backgroundColor:'#ffffff'});const imgData=canvas.toDataURL('image/jpeg',0.95);const{jsPDF}=window.jspdf;const pdf=new jsPDF('p','mm','a4');const pageWidth=pdf.internal.pageSize.getWidth();const pageHeight=pdf.internal.pageSize.getHeight();const imgHeight=(canvas.height*pageWidth)/canvas.width;pdf.addImage(imgData,'JPEG',0,0,pageWidth,Math.min(imgHeight,pageHeight));showPdfPreview(pdf,'nichilog_receipt_'+new Date().toISOString().slice(0,10)+'.pdf');}

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
