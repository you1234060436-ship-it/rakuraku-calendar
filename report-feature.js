/*!
 * report-feature.js — 工事日報 / 請求書 / 領収書 PDF 統一モジュール
 *
 * Target : nichilog-pc.html（PC版のみで使用）
 * DO NOT MODIFY: nichilog-v2.html, receipt-feature.js
 *
 * Step 1 : nichiPrint / showPdfPreview 移設、ReportFeature 名前空間
 * Step 2 : generateKoujiNippo 実装（A4固定・28行最小・プレビュー）
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
  // 名前空間エクスポート
  // ============================================================
  var ReportFeature = {
    version: '0.2.0',
    showPdfPreview: showPdfPreview,
    nichiPrint: nichiPrint,
    generateKoujiNippo: generateKoujiNippo,
    _internals: {
      aggregateEntries: aggregateEntries,
      formatTimeRange: formatTimeRange,
      buildKoujiNippoHtml: buildKoujiNippoHtml
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
