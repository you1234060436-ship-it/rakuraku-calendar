/*!
 * report-feature.js — 工事日報 / 請求書 / 領収書 PDF 統一モジュール
 *
 * Target : nichilog-pc.html（PC版のみで使用）
 * DO NOT MODIFY: nichilog-v2.html, receipt-feature.js
 *
 * Step 1 : nichiPrint / showPdfPreview 移設、ReportFeature 名前空間
 * Step 2 : generateKoujiNippo 実装（A4固定・28行最小・プレビュー）
 * Step 3 : generateInvoicePdf 実装（A4固定・1ページ・明細行padding）
 * Step 4 : generateReceiptPdf 実装（A4上部配置・収入印紙欄・8%/10%分離）
 * Step 5 : 請求書レイアウト刷新（御請求書タイトル帯・宛先中央・ヘッダー縦1列・
 *          備考colspan・8%/10%分離・「○○,○○○円」表記）
 *
 * 依存ライブラリ（nichilog-pc.html 側で読込）:
 *   - jsPDF 2.5.1
 *   - html2canvas 1.4.1
 */
(function (global) {
  'use strict';

  // ============================================================
  // 汎用ユーティリティ
  // ============================================================
  function escHtml(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  // ============================================================
  // PDF プレビュー表示
  //   pdf.output('datauristring') を新規タブで <embed> 表示する。
  //   ポップアップブロック等で window.open が null の場合は
  //   pdf.save() にフォールバックする。
  // ============================================================
  function showPdfPreview(pdf, filename) {
    try {
      var dataUrl = pdf.output('datauristring');
      var w = global.open('', '_blank');
      if (w) {
        w.document.write(
          '<html><head><title>' + filename + '<\/title><\/head>' +
          '<body style="margin:0;padding:0;">' +
          '<embed src="' + dataUrl + '" type="application/pdf" width="100%" height="100%">' +
          '<\/body><\/html>'
        );
      } else {
        pdf.save(filename);
      }
    } catch (e) {
      console.error('[ReportFeature] showPdfPreview error:', e);
      try { pdf.save(filename); } catch (_) { /* noop */ }
    }
  }

  // ============================================================
  // 要素 → PDF 汎用変換
  //   指定 id の要素を html2canvas でキャプチャ → jsPDF (A4縦, 210mm幅)
  //   化し、showPdfPreview で新規タブ表示する。動的高さ版。
  // ============================================================
  async function nichiPrint(id) {
    try {
      var element = document.getElementById(id);
      if (!element) { alert('要素が見つかりません: ' + id); return; }
      if (typeof html2canvas === 'undefined') { alert('html2canvas未読込'); return; }
      if (typeof global.jspdf === 'undefined') { alert('jsPDF未読込'); return; }

      var canvas = await html2canvas(element, {
        scale: 2,
        useCORS: true,
        backgroundColor: '#ffffff'
      });
      var imgData = canvas.toDataURL('image/jpeg', 0.95);
      var jsPDF = global.jspdf.jsPDF;
      var pageWidth = 210;
      var imgHeight = (canvas.height * pageWidth) / canvas.width;
      var pdf = new jsPDF('p', 'mm', [pageWidth, Math.max(imgHeight, 297)]);
      pdf.addImage(imgData, 'JPEG', 0, 0, pageWidth, imgHeight);
      showPdfPreview(
        pdf,
        'nichilog_' + id + '_' + new Date().toISOString().slice(0, 10) + '.pdf'
      );
    } catch (e) {
      alert('エラー: ' + (e && e.message ? e.message : e));
    }
  }

  // ============================================================
  // 工事日報 PDF
  //   A4縦固定（210×297mm）、タイトル「工事日報（○月）」、右上に担当者、
  //   6列テーブル（日・曜日・時間・現場名・作業内容・人員）、
  //   時間は work_type×time_slot で算出、人員はカンマ区切り（半日は
  //   「名前（半日）」）、最低28行まで空行で埋める。
  //
  //   params = {
  //     year, month,                  // number
  //     companyName, ownerName,       // string
  //     entries: [{
  //       work_date,                  // 'YYYY-MM-DD'
  //       member_name,
  //       site_name,
  //       client_name,
  //       work_type,                  // 'full' | 'half'
  //       time_slot,                  // 'full' | 'am' | 'pm'
  //       note
  //     }, ...]
  //   }
  // ============================================================

  // 同じ (work_date, site_name) を1行に集約する
  function aggregateEntries(entries) {
    var map = {};
    var order = [];
    (entries || []).forEach(function (e) {
      var key = (e.work_date || '') + '__' + (e.site_name || '');
      if (!map[key]) {
        map[key] = {
          work_date: e.work_date || '',
          site_name: e.site_name || '',
          client_name: e.client_name || '',
          note: e.note || '',
          members: [],
          slots: {}
        };
        order.push(key);
      }
      var g = map[key];
      g.members.push({
        name: e.member_name || '',
        half: e.work_type === 'half'
      });
      // time_slot 優先。未指定なら work_type から推定（half→am、それ以外→full）
      var slot = e.time_slot || (e.work_type === 'half' ? 'am' : 'full');
      g.slots[slot] = true;
      if (!g.client_name && e.client_name) g.client_name = e.client_name;
      if (!g.note && e.note) g.note = e.note;
    });
    return order.map(function (k) { return map[k]; })
      .sort(function (a, b) {
        if (a.work_date < b.work_date) return -1;
        if (a.work_date > b.work_date) return 1;
        return (a.site_name || '').localeCompare(b.site_name || '');
      });
  }

  // 集約済み行から時間帯文字列を算出
  function formatTimeRange(slots) {
    var hasFull = !!slots.full;
    var hasAM = !!slots.am;
    var hasPM = !!slots.pm;
    if (hasFull) return '8:00〜17:00';
    if (hasAM && hasPM) return '8:00〜17:00';
    if (hasAM) return '8:00〜12:00';
    if (hasPM) return '12:00〜17:00';
    return '';
  }

  function formatMembers(members) {
    return members.map(function (m) {
      return escHtml(m.name) + (m.half ? '（半日）' : '');
    }).join('、');
  }

  // 日報スタイルを1回だけ注入
  function ensureReportStyles() {
    if (document.getElementById('rf-report-styles')) return;
    var s = document.createElement('style');
    s.id = 'rf-report-styles';
    s.textContent = [
      '.rf-report-host{position:fixed;top:-10000px;left:-10000px;z-index:-1;pointer-events:none}',
      '.rf-report-page{width:210mm;min-height:297mm;padding:12mm 10mm;background:#fff;',
      'font-family:"Hiragino Sans","Yu Gothic","MS Gothic",sans-serif;color:#222;box-sizing:border-box}',
      '.rf-report-hd{display:flex;justify-content:space-between;align-items:flex-end;',
      'margin-bottom:5mm;padding-bottom:3mm;border-bottom:2px solid #333}',
      '.rf-report-title{font-size:18pt;font-weight:700;letter-spacing:2px}',
      '.rf-report-meta{font-size:10pt;text-align:right;line-height:1.6}',
      '.rf-report-meta div{white-space:nowrap}',
      '.rf-report-table{width:100%;border-collapse:collapse;font-size:9pt;table-layout:fixed}',
      '.rf-report-table th,.rf-report-table td{border:0.35mm solid #333;padding:1.6mm 1.4mm;',
      'vertical-align:middle;overflow:hidden;word-break:break-all}',
      '.rf-report-table th{background:#f3f4f6;text-align:center;font-weight:600}',
      '.rf-report-table td.rf-c{text-align:center}',
      '.rf-report-table th:nth-child(1),.rf-report-table td:nth-child(1){width:7%;text-align:center}',
      '.rf-report-table th:nth-child(2),.rf-report-table td:nth-child(2){width:6%;text-align:center}',
      '.rf-report-table th:nth-child(3),.rf-report-table td:nth-child(3){width:15%;text-align:center}',
      '.rf-report-table th:nth-child(4),.rf-report-table td:nth-child(4){width:23%}',
      '.rf-report-table th:nth-child(5),.rf-report-table td:nth-child(5){width:23%}',
      '.rf-report-table th:nth-child(6),.rf-report-table td:nth-child(6){width:26%}',
      '.rf-report-table .rf-sub{display:block;font-size:7.5pt;color:#6b7280;margin-top:0.5mm}',
      '.rf-report-table tr.rf-empty td{height:6mm}'
    ].join('');
    document.head.appendChild(s);
  }

  // 日報HTML組み立て（28行最小）
  function buildKoujiNippoHtml(year, month, companyName, ownerName, entries) {
    var MIN_ROWS = 28;
    var DOW = '日月火水木金土';

    var groups = aggregateEntries(entries);
    var rowsHtml = '';
    var emptyCell =
      '<td class="rf-c">&nbsp;</td><td class="rf-c"></td><td class="rf-c"></td>' +
      '<td></td><td></td><td></td>';

    groups.forEach(function (g) {
      var d = g.work_date ? new Date(g.work_date + 'T00:00:00') : null;
      var dayStr = d ? String(d.getDate()) : '';
      var dowStr = d ? DOW.charAt(d.getDay()) : '';
      var timeStr = formatTimeRange(g.slots);
      var siteCell = escHtml(g.site_name || '-');
      if (g.client_name) {
        siteCell += '<span class="rf-sub">' + escHtml(g.client_name) + '</span>';
      }
      var noteCell = escHtml(g.note || '');
      var peopleCell = formatMembers(g.members);
      rowsHtml +=
        '<tr>' +
        '<td class="rf-c">' + dayStr + '</td>' +
        '<td class="rf-c">' + dowStr + '</td>' +
        '<td class="rf-c">' + escHtml(timeStr) + '</td>' +
        '<td>' + siteCell + '</td>' +
        '<td>' + noteCell + '</td>' +
        '<td>' + peopleCell + '</td>' +
        '</tr>';
    });

    var padCount = Math.max(0, MIN_ROWS - groups.length);
    for (var i = 0; i < padCount; i++) {
      rowsHtml += '<tr class="rf-empty">' + emptyCell + '</tr>';
    }

    var metaParts = [];
    if (companyName) metaParts.push('<div>' + escHtml(companyName) + '</div>');
    if (ownerName)   metaParts.push('<div>担当者: ' + escHtml(ownerName) + '</div>');
    metaParts.push('<div>' + year + '年 ' + month + '月</div>');

    return '' +
      '<div class="rf-report-page">' +
        '<div class="rf-report-hd">' +
          '<div class="rf-report-title">工事日報（' + month + '月）</div>' +
          '<div class="rf-report-meta">' + metaParts.join('') + '</div>' +
        '</div>' +
        '<table class="rf-report-table">' +
          '<thead><tr>' +
            '<th>日</th><th>曜日</th><th>時間</th>' +
            '<th>現場名</th><th>作業内容</th><th>人員</th>' +
          '</tr></thead>' +
          '<tbody>' + rowsHtml + '</tbody>' +
        '</table>' +
      '</div>';
  }

  async function generateKoujiNippo(params) {
    var p = params || {};
    var year = p.year;
    var month = p.month;
    var companyName = p.companyName || '';
    var ownerName = p.ownerName || '';
    var entries = Array.isArray(p.entries) ? p.entries : [];

    if (typeof html2canvas === 'undefined') { alert('html2canvas未読込'); return; }
    if (typeof global.jspdf === 'undefined') { alert('jsPDF未読込'); return; }
    if (!year || !month) { alert('年月が指定されていません'); return; }

    ensureReportStyles();

    var host = document.createElement('div');
    host.className = 'rf-report-host';
    host.innerHTML = buildKoujiNippoHtml(year, month, companyName, ownerName, entries);
    document.body.appendChild(host);

    try {
      var page = host.querySelector('.rf-report-page');
      var canvas = await html2canvas(page, {
        scale: 2,
        useCORS: true,
        backgroundColor: '#ffffff'
      });
      var imgData = canvas.toDataURL('image/jpeg', 0.95);
      var jsPDF = global.jspdf.jsPDF;
      // A4縦 固定
      var pdf = new jsPDF('p', 'mm', 'a4');
      var pageWidth = 210;
      var pageHeight = 297;
      var imgHeight = (canvas.height * pageWidth) / canvas.width;
      // 高さがA4を超える場合はA4に合わせて縮小（歪まないよう幅も同比率で調整）
      var drawWidth = pageWidth;
      var drawHeight = imgHeight;
      if (imgHeight > pageHeight) {
        drawHeight = pageHeight;
        drawWidth = (canvas.width * pageHeight) / canvas.height;
      }
      var offsetX = (pageWidth - drawWidth) / 2;
      var offsetY = 0;
      pdf.addImage(imgData, 'JPEG', offsetX, offsetY, drawWidth, drawHeight);

      var filename = '工事日報_' + year + '_' + String(month).padStart(2, '0') + '.pdf';
      showPdfPreview(pdf, filename);
    } catch (e) {
      console.error('[ReportFeature] generateKoujiNippo failed:', e);
      alert('PDF生成に失敗しました: ' + (e && e.message ? e.message : e));
    } finally {
      host.remove();
    }
  }

  // ============================================================
  // 請求書 PDF
  //   A4縦固定（210×297mm）、1ページ固定、明細行は15行に満たない
  //   場合は空行でpadding。showPdfPreview で新規タブ表示。
  //
  //   params = {
  //     invoiceNo, issueDate, dueDate,          // string
  //     clientCompany, clientTanto,             // string
  //     subject,                                // 件名
  //     from,                                   // 自社名
  //     fromAddress,                            // 任意の自社住所/連絡先
  //     remarks,                                // 備考
  //     taxRate,                                // 既定 0.10
  //     bank: { name, branch, type, no, holder },
  //     rows: [{ name, spec, qty, unit, price }, ...]
  //   }
  // ============================================================
  var INVOICE_MIN_ROWS = 15;

  // 金額フォーマット: ¥ 付き (ヘッダー用)
  function yenFmt(n) {
    return '¥' + Math.round(Number(n) || 0).toLocaleString();
  }
  // 金額フォーマット: 円 サフィックス (明細・合計欄用)
  function yenSuffix(n) {
    return Math.round(Number(n) || 0).toLocaleString() + '円';
  }
  // 日付 YYYY-MM-DD → YYYY/MM/DD
  function dateSlash(s) {
    if (!s || typeof s !== 'string') return '';
    var m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
    if (!m) return s;
    return m[1] + '/' + String(m[2]).padStart(2, '0') + '/' + String(m[3]).padStart(2, '0');
  }

  function ensureInvoiceStyles() {
    if (document.getElementById('rf-invoice-styles')) return;
    var s = document.createElement('style');
    s.id = 'rf-invoice-styles';
    s.textContent = [
      '.rf-invoice-host{position:fixed;top:-10000px;left:-10000px;z-index:-1;pointer-events:none}',
      // base: flexible（プレビューでも使える）
      '.rf-invoice-page{background:#fff;color:#222;padding:12mm 14mm;',
      'font-family:"Hiragino Mincho ProN","Yu Mincho","MS Mincho",serif;font-size:10pt;box-sizing:border-box;position:relative}',
      // PDF出力時のみ A4 固定
      '.rf-invoice-host .rf-invoice-page{width:210mm;min-height:297mm}',
      // 右上: ページ / No
      '.rf-iv-top-right{position:absolute;top:8mm;right:14mm;text-align:right;font-size:9.5pt;line-height:1.55}',
      '.rf-iv-page-num{margin-bottom:1.5mm}',
      '.rf-iv-no-line{border-bottom:0.4mm solid #222;padding:0 2mm 1mm 2mm;display:inline-block;min-width:40mm}',
      // タイトル (青帯・白文字・左寄せ・横長)
      '.rf-iv-title-bar{background:#1a4b8c;color:#fff;font-size:18pt;font-weight:700;padding:3.5mm 8mm;letter-spacing:6px;text-align:left;margin:14mm 0 7mm 0}',
      // 宛先 (中央・下線)
      '.rf-iv-to-center{text-align:center;margin:4mm 0 7mm 0}',
      '.rf-iv-to-name{font-size:16pt;font-weight:700;border-bottom:0.4mm solid #222;padding:0 6mm 1.8mm 6mm;display:inline-block;min-width:120mm;letter-spacing:2px}',
      // 発行者 (右寄せ・下線)
      '.rf-iv-from-right{text-align:right;margin-bottom:6mm;font-size:10pt;line-height:1.8}',
      '.rf-iv-from-line{border-bottom:0.3mm solid #666;padding:0 3mm 0.8mm 3mm;display:inline-block;min-width:55mm;margin-bottom:1mm}',
      // 挨拶文
      '.rf-iv-greeting{font-size:10pt;line-height:1.85;margin:5mm 0 6mm 0}',
      // ヘッダー情報（縦1列・各行下線）
      '.rf-iv-header-info{margin:5mm 0 5mm 0}',
      '.rf-iv-hi-row{display:flex;border-bottom:0.3mm solid #666;padding:1.5mm 0;font-size:10pt;line-height:1.4}',
      '.rf-iv-hi-label{width:40mm;font-weight:600}',
      '.rf-iv-hi-value{flex:1}',
      '.rf-iv-hi-row.rf-iv-hi-total .rf-iv-hi-value{font-weight:700;font-size:12pt}',
      // 明細テーブル
      '.rf-iv-table{width:100%;border-collapse:collapse;font-size:9pt;margin-top:4mm;table-layout:fixed}',
      '.rf-iv-table th,.rf-iv-table td{border:0.35mm solid #333;padding:1.6mm 1.5mm;',
      'vertical-align:middle;overflow:hidden;word-break:break-all}',
      '.rf-iv-table th{background:#e8eef5;text-align:center;font-weight:600}',
      '.rf-iv-table td.rf-n{text-align:right}',
      '.rf-iv-table td.rf-c{text-align:center}',
      '.rf-iv-table tr.rf-empty td{height:6mm}',
      '.rf-iv-table th:nth-child(1),.rf-iv-table td:nth-child(1){width:24%}',
      '.rf-iv-table th:nth-child(2),.rf-iv-table td:nth-child(2){width:20%}',
      '.rf-iv-table th:nth-child(3),.rf-iv-table td:nth-child(3){width:8%;text-align:right}',
      '.rf-iv-table th:nth-child(4),.rf-iv-table td:nth-child(4){width:8%;text-align:center}',
      '.rf-iv-table th:nth-child(5),.rf-iv-table td:nth-child(5){width:20%;text-align:right}',
      '.rf-iv-table th:nth-child(6),.rf-iv-table td:nth-child(6){width:20%;text-align:right}',
      // tfoot: 備考 (colspan4) + 合計ラベル + 値
      '.rf-iv-table tfoot .rf-iv-remark{vertical-align:top;text-align:left;background:#fafafa;padding:2mm 2.5mm}',
      '.rf-iv-table tfoot .rf-iv-remark .rf-iv-remark-lbl{font-weight:700;margin-bottom:1mm;font-size:9.5pt}',
      '.rf-iv-table tfoot .rf-iv-remark .rf-iv-remark-body{min-height:12mm;font-size:9pt;white-space:pre-wrap;line-height:1.5}',
      '.rf-iv-table tfoot .rf-iv-sum-lbl{text-align:center;background:#f3f4f6;font-weight:600}',
      '.rf-iv-table tfoot .rf-iv-sum-val{text-align:right;background:#fafafa;font-weight:600}',
      '.rf-iv-table tfoot .rf-iv-total .rf-iv-sum-lbl{background:#f0eae0;font-weight:700;font-size:10pt}',
      '.rf-iv-table tfoot .rf-iv-total .rf-iv-sum-val{background:#f0eae0;font-weight:700;font-size:10pt}',
      // 税率分離（テーブル外・右寄せ）
      '.rf-iv-tax-breakdown{margin-top:3mm;text-align:right;font-size:9.5pt;line-height:1.9}',
      '.rf-iv-tax-breakdown div{text-align:right}'
    ].join('');
    document.head.appendChild(s);
  }

  function buildInvoiceHtml(p, subtotal, tax, total) {
    var rows = Array.isArray(p.rows) ? p.rows : [];
    var rowHtml = '';

    rows.forEach(function (r) {
      var qty = Number(r.qty) || 0;
      var price = Number(r.price) || 0;
      var amt = qty * price;
      rowHtml +=
        '<tr>' +
          '<td>' + escHtml(r.name || '') + '</td>' +
          '<td>' + escHtml(r.spec || '') + '</td>' +
          '<td class="rf-n">' + qty + '</td>' +
          '<td class="rf-c">' + escHtml(r.unit || '') + '</td>' +
          '<td class="rf-n">' + yenSuffix(price) + '</td>' +
          '<td class="rf-n">' + yenSuffix(amt) + '</td>' +
        '</tr>';
    });

    var padCount = Math.max(0, INVOICE_MIN_ROWS - rows.length);
    for (var i = 0; i < padCount; i++) {
      rowHtml +=
        '<tr class="rf-empty">' +
        '<td>&nbsp;</td><td></td><td></td><td></td><td></td><td></td>' +
        '</tr>';
    }

    var taxRate = (typeof p.taxRate === 'number') ? p.taxRate : 0.10;
    var tax8 = (taxRate === 0.08) ? tax : 0;
    var tax10 = (taxRate === 0.10) ? tax : 0;

    return '' +
      '<div class="rf-invoice-page">' +
        // 右上: 1/1 ページ + No
        '<div class="rf-iv-top-right">' +
          '<div class="rf-iv-page-num">1/1 ページ</div>' +
          '<div class="rf-iv-no-line">No. ' + escHtml(p.invoiceNo || '') + '</div>' +
        '</div>' +
        // タイトル
        '<div class="rf-iv-title-bar">御請求書</div>' +
        // 宛先 (中央)
        '<div class="rf-iv-to-center">' +
          '<span class="rf-iv-to-name">' + escHtml(p.clientCompany || '') + '　御中</span>' +
        '</div>' +
        // 発行者 (右寄せ) — 自社名 + インボイス登録番号
        '<div class="rf-iv-from-right">' +
          '<div class="rf-iv-from-line">' + escHtml(p.from || '') + '</div>' +
          '<div class="rf-iv-from-line">登録番号: ' + escHtml(p.registrationNo || '') + '</div>' +
        '</div>' +
        // 挨拶文
        '<div class="rf-iv-greeting">' +
          '平素は格別のお引き立てを賜り厚く御礼申し上げます。<br>' +
          '下記の通りご請求申し上げます。' +
        '</div>' +
        // ヘッダー情報
        '<div class="rf-iv-header-info">' +
          '<div class="rf-iv-hi-row"><span class="rf-iv-hi-label">請求日</span><span class="rf-iv-hi-value">' + escHtml(dateSlash(p.issueDate || '')) + '</span></div>' +
          '<div class="rf-iv-hi-row"><span class="rf-iv-hi-label">振込期限</span><span class="rf-iv-hi-value">' + escHtml(dateSlash(p.dueDate || '')) + '</span></div>' +
          '<div class="rf-iv-hi-row"><span class="rf-iv-hi-label">工事名</span><span class="rf-iv-hi-value">' + escHtml(p.subject || '') + '</span></div>' +
          '<div class="rf-iv-hi-row rf-iv-hi-total"><span class="rf-iv-hi-label">御請求金額（税込）</span><span class="rf-iv-hi-value">' + yenFmt(total) + '</span></div>' +
        '</div>' +
        // 明細テーブル
        '<table class="rf-iv-table">' +
          '<thead><tr>' +
            '<th>名称</th><th>仕様</th><th>数量</th>' +
            '<th>単位</th><th>単価</th><th>金額</th>' +
          '</tr></thead>' +
          '<tbody>' + rowHtml + '</tbody>' +
          '<tfoot>' +
            // 備考は colspan=4 で rowspan=3。右2列に 小計 / 消費税等 / 合計金額
            '<tr>' +
              '<td colspan="4" rowspan="3" class="rf-iv-remark">' +
                '<div class="rf-iv-remark-lbl">備考</div>' +
                '<div class="rf-iv-remark-body">' + escHtml(p.remarks || '') + '</div>' +
              '</td>' +
              '<td class="rf-iv-sum-lbl">小計　①</td>' +
              '<td class="rf-iv-sum-val">' + yenSuffix(subtotal) + '</td>' +
            '</tr>' +
            '<tr>' +
              '<td class="rf-iv-sum-lbl">消費税等　②（④＋⑤）</td>' +
              '<td class="rf-iv-sum-val">' + yenSuffix(tax) + '</td>' +
            '</tr>' +
            '<tr class="rf-iv-total">' +
              '<td class="rf-iv-sum-lbl">合計金額　③（①＋②）</td>' +
              '<td class="rf-iv-sum-val">' + yenSuffix(total) + '</td>' +
            '</tr>' +
          '</tfoot>' +
        '</table>' +
        // テーブル外・右寄せの税率分離
        '<div class="rf-iv-tax-breakdown">' +
          '<div>（8%）消費税合計　④　' + yenSuffix(tax8) + '</div>' +
          '<div>（10%）消費税合計　⑤　' + yenSuffix(tax10) + '</div>' +
        '</div>' +
      '</div>';
  }

  async function generateInvoicePdf(params) {
    var p = params || {};
    var rows = Array.isArray(p.rows) ? p.rows : [];
    var subtotal = 0;
    rows.forEach(function (r) {
      subtotal += (Number(r.qty) || 0) * (Number(r.price) || 0);
    });
    var taxRate = (typeof p.taxRate === 'number') ? p.taxRate : 0.10;
    var tax = Math.floor(subtotal * taxRate);
    var total = subtotal + tax;

    if (typeof html2canvas === 'undefined') { alert('html2canvas未読込'); return; }
    if (typeof global.jspdf === 'undefined') { alert('jsPDF未読込'); return; }

    ensureInvoiceStyles();

    var host = document.createElement('div');
    host.className = 'rf-invoice-host';
    host.innerHTML = buildInvoiceHtml(p, subtotal, tax, total);
    document.body.appendChild(host);

    try {
      var page = host.querySelector('.rf-invoice-page');
      var canvas = await html2canvas(page, {
        scale: 2,
        useCORS: true,
        backgroundColor: '#ffffff'
      });
      var imgData = canvas.toDataURL('image/jpeg', 0.95);
      var jsPDF = global.jspdf.jsPDF;
      var pdf = new jsPDF('p', 'mm', 'a4');
      var pageWidth = 210;
      var pageHeight = 297;
      var imgHeight = (canvas.height * pageWidth) / canvas.width;
      var drawWidth = pageWidth;
      var drawHeight = imgHeight;
      // 高さオーバー時はA4に収まるよう縮小（1ページ固定）
      if (imgHeight > pageHeight) {
        drawHeight = pageHeight;
        drawWidth = (canvas.width * pageHeight) / canvas.height;
      }
      var offsetX = (pageWidth - drawWidth) / 2;
      pdf.addImage(imgData, 'JPEG', offsetX, 0, drawWidth, drawHeight);

      var safeNo = (p.invoiceNo || new Date().toISOString().slice(0, 10))
        .replace(/[\/\\:*?"<>|]/g, '_');
      showPdfPreview(pdf, '請求書_' + safeNo + '.pdf');
    } catch (e) {
      console.error('[ReportFeature] generateInvoicePdf failed:', e);
      alert('PDF生成に失敗しました: ' + (e && e.message ? e.message : e));
    } finally {
      host.remove();
    }
  }

  // ============================================================
  // 領収書 PDF
  //   A4縦、内容は上部配置（下半分は空き）、¥50,000 以上で収入印紙欄、
  //   内訳表は 8%/10% を分離して掲載。インボイス登録番号を右下に表示。
  //
  //   params = {
  //     receiptNo, issueDate,               // string
  //     issuer,                             // 発行元（自社名）
  //     clientCompany,                      // 宛先（会社名のみ。'様' は自動付与）
  //     total,                              // 合計金額（税込・整数円）
  //     taxRate,                            // 0.08 | 0.10
  //     description,                        // 但し書き
  //     registrationNo                      // インボイス登録番号 (T + 13桁)
  //   }
  // ============================================================

  // プレビューとPDFで共通利用する内訳計算
  function calcReceiptBreakdown(total, taxRate) {
    var t = Number(total) || 0;
    var r = (typeof taxRate === 'number') ? taxRate : 0.10;
    var excl = Math.round(t / (1 + r));
    var tax = Math.round(t - excl);
    return {
      excl: excl,
      tax: tax,
      tax8: (r === 0.08) ? tax : 0,
      tax10: (r === 0.10) ? tax : 0,
      stamp: t >= 50000,
      taxRate: r
    };
  }

  function ensureReceiptStyles() {
    if (document.getElementById('rf-receipt-styles')) return;
    var s = document.createElement('style');
    s.id = 'rf-receipt-styles';
    s.textContent = [
      '.rf-receipt-host{position:fixed;top:-10000px;left:-10000px;z-index:-1;pointer-events:none}',
      // base: flexible (使える)
      '.rf-receipt-page{background:#fff;color:#222;padding:14mm 14mm;',
      'font-family:"Hiragino Mincho ProN","Yu Mincho","MS Mincho",serif;font-size:10pt;box-sizing:border-box}',
      // PDF出力時のみ A4 固定
      '.rf-receipt-host .rf-receipt-page{width:210mm;min-height:297mm}',
      '.rf-rc-head{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:6mm}',
      '.rf-rc-title{font-size:26pt;letter-spacing:12px;font-weight:700}',
      '.rf-rc-meta{font-size:10pt;line-height:1.6;text-align:right;min-width:35mm}',
      '.rf-rc-to{text-align:center;padding:3mm 0 3mm;border-bottom:1.5px solid #222;',
      'font-size:14pt;font-weight:600;margin-bottom:5mm}',
      '.rf-rc-amt-row{display:flex;align-items:stretch;border-top:2px solid #222;',
      'border-bottom:2px solid #222;margin-bottom:5mm}',
      '.rf-rc-amt-box{flex:1;text-align:center;padding:6mm 4mm;display:flex;align-items:center;justify-content:center}',
      '.rf-rc-amt-val{font-size:28pt;font-weight:700;letter-spacing:3px}',
      '.rf-rc-amt-suffix{font-size:16pt;margin-left:4mm;font-weight:600}',
      '.rf-rc-stamp-box{width:32mm;display:flex;flex-direction:column;align-items:center;',
      'justify-content:center;border-left:1px solid #333;padding:3mm}',
      '.rf-rc-stamp-frame{width:22mm;height:22mm;border:1.5px dashed #888;display:flex;',
      'align-items:center;justify-content:center;font-size:8pt;color:#888;text-align:center;line-height:1.4}',
      '.rf-rc-desc{margin:4mm 0;font-size:11pt;line-height:1.7;padding:2mm 0}',
      '.rf-rc-desc .rf-rc-lbl{margin-right:4mm;font-weight:600}',
      '.rf-rc-break-wrap{display:flex;justify-content:space-between;gap:8mm;margin-top:4mm;align-items:flex-start}',
      '.rf-rc-breakdown{width:90mm;border-collapse:collapse;font-size:9pt}',
      '.rf-rc-breakdown th,.rf-rc-breakdown td{border:0.35mm solid #666;padding:1.6mm 2mm}',
      '.rf-rc-breakdown th{background:#f3f4f6;text-align:center}',
      '.rf-rc-breakdown td.rf-n{text-align:right}',
      '.rf-rc-breakdown tr.rf-rc-sum td{background:#fafafa;font-weight:700}',
      '.rf-rc-issuer{min-width:60mm;text-align:right;font-size:10pt;line-height:1.7}',
      '.rf-rc-issuer .rf-rc-iss-name{font-size:13pt;font-weight:700;margin-bottom:2mm}',
      '.rf-rc-issuer .rf-rc-reg-lbl{font-size:8.5pt;color:#555;margin-top:2mm}',
      '.rf-rc-issuer .rf-rc-reg-no{font-size:9.5pt;letter-spacing:1px}'
    ].join('');
    document.head.appendChild(s);
  }

  function buildReceiptHtml(p, b) {
    var issueDateStr = '';
    if (p.issueDate) {
      try {
        issueDateStr = new Date(p.issueDate + 'T00:00:00').toLocaleDateString('ja-JP');
      } catch (_) { issueDateStr = p.issueDate; }
    }
    var desc = p.description || '工事代金として';

    var stampHtml = b.stamp
      ? '<div class="rf-rc-stamp-box"><div class="rf-rc-stamp-frame">収入<br>印紙</div></div>'
      : '';

    return '' +
      '<div class="rf-receipt-page">' +
        '<div class="rf-rc-head">' +
          '<div class="rf-rc-title">領　収　書</div>' +
          '<div class="rf-rc-meta">' +
            '<div>No. ' + escHtml(p.receiptNo || '') + '</div>' +
            '<div>' + escHtml(issueDateStr) + '</div>' +
          '</div>' +
        '</div>' +
        '<div class="rf-rc-to">' + escHtml(p.clientCompany || '') + '　様</div>' +
        '<div class="rf-rc-amt-row">' +
          '<div class="rf-rc-amt-box">' +
            '<div class="rf-rc-amt-val">' + yenFmt(b.total || 0) +
            '<span class="rf-rc-amt-suffix">也</span></div>' +
          '</div>' +
          stampHtml +
        '</div>' +
        '<div class="rf-rc-desc">' +
          '<span class="rf-rc-lbl">但し</span>' + escHtml(desc) +
          ' として、上記正に領収いたしました。' +
        '</div>' +
        '<div class="rf-rc-break-wrap">' +
          '<table class="rf-rc-breakdown">' +
            '<thead><tr><th>内訳</th><th>金額</th></tr></thead>' +
            '<tbody>' +
              '<tr><td>小計 ①</td><td class="rf-n">' + yenFmt(b.excl) + '</td></tr>' +
              '<tr><td>消費税等 ②（④＋⑤）</td><td class="rf-n">' + yenFmt(b.tax) + '</td></tr>' +
              '<tr class="rf-rc-sum"><td>合計 ③（①＋②）</td><td class="rf-n">' + yenFmt(b.total) + '</td></tr>' +
              '<tr><td>(8%)消費税合計 ④</td><td class="rf-n">' + yenFmt(b.tax8) + '</td></tr>' +
              '<tr><td>(10%)消費税合計 ⑤</td><td class="rf-n">' + yenFmt(b.tax10) + '</td></tr>' +
            '</tbody>' +
          '</table>' +
          '<div class="rf-rc-issuer">' +
            '<div class="rf-rc-iss-name">' + escHtml(p.issuer || '') + '</div>' +
            '<div class="rf-rc-reg-lbl">インボイス登録番号</div>' +
            '<div class="rf-rc-reg-no">' + escHtml(p.registrationNo || 'T0000000000000') + '</div>' +
          '</div>' +
        '</div>' +
      '</div>';
  }

  async function generateReceiptPdf(params) {
    var p = params || {};
    var total = Number(p.total) || 0;
    var taxRate = (typeof p.taxRate === 'number') ? p.taxRate : 0.10;
    var b = calcReceiptBreakdown(total, taxRate);
    b.total = total;

    if (typeof html2canvas === 'undefined') { alert('html2canvas未読込'); return; }
    if (typeof global.jspdf === 'undefined') { alert('jsPDF未読込'); return; }

    ensureReceiptStyles();

    var host = document.createElement('div');
    host.className = 'rf-receipt-host';
    host.innerHTML = buildReceiptHtml(p, b);
    document.body.appendChild(host);

    try {
      var page = host.querySelector('.rf-receipt-page');
      var canvas = await html2canvas(page, {
        scale: 2,
        useCORS: true,
        backgroundColor: '#ffffff'
      });
      var imgData = canvas.toDataURL('image/jpeg', 0.95);
      var jsPDF = global.jspdf.jsPDF;
      var pdf = new jsPDF('p', 'mm', 'a4');
      var pageWidth = 210, pageHeight = 297;
      var imgHeight = (canvas.height * pageWidth) / canvas.width;
      var drawWidth = pageWidth, drawHeight = imgHeight;
      if (imgHeight > pageHeight) {
        drawHeight = pageHeight;
        drawWidth = (canvas.width * pageHeight) / canvas.height;
      }
      var offsetX = (pageWidth - drawWidth) / 2;
      pdf.addImage(imgData, 'JPEG', offsetX, 0, drawWidth, drawHeight);
      var safeNo = (p.receiptNo || new Date().toISOString().slice(0, 10))
        .replace(/[\/\\:*?"<>|]/g, '_');
      showPdfPreview(pdf, '領収書_' + safeNo + '.pdf');
    } catch (e) {
      console.error('[ReportFeature] generateReceiptPdf failed:', e);
      alert('PDF生成に失敗しました: ' + (e && e.message ? e.message : e));
    } finally {
      host.remove();
    }
  }

  // ============================================================
  // 名前空間エクスポート
  // ============================================================
  var ReportFeature = {
    version: '0.5.0',
    showPdfPreview: showPdfPreview,
    nichiPrint: nichiPrint,
    generateKoujiNippo: generateKoujiNippo,
    generateInvoicePdf: generateInvoicePdf,
    generateReceiptPdf: generateReceiptPdf,
    _internals: {
      aggregateEntries: aggregateEntries,
      formatTimeRange: formatTimeRange,
      buildKoujiNippoHtml: buildKoujiNippoHtml,
      buildInvoiceHtml: buildInvoiceHtml,
      buildReceiptHtml: buildReceiptHtml,
      calcReceiptBreakdown: calcReceiptBreakdown,
      ensureInvoiceStyles: ensureInvoiceStyles,
      ensureReceiptStyles: ensureReceiptStyles
    }
  };

  global.ReportFeature = ReportFeature;

  // 後方互換: 既存の onclick 属性と receipt-feature.js から
  // グローバル名で呼ばれるため、エイリアスを公開する。
  if (typeof global.showPdfPreview !== 'function') {
    global.showPdfPreview = showPdfPreview;
  }
  if (typeof global.nichiPrint !== 'function') {
    global.nichiPrint = nichiPrint;
  }
})(window);
