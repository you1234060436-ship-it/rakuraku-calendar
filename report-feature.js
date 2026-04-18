/*!
 * report-feature.js — 工事日報 / 請求書 / 領収書 PDF 統一モジュール
 *
 * Target : nichilog-pc.html（PC版のみで使用）
 * DO NOT MODIFY: nichilog-v2.html, receipt-feature.js
 *
 * Step 1 (本コミット) :
 *   - window.ReportFeature 名前空間を導入
 *   - nichiPrint / showPdfPreview を nichilog-pc.html から移設
 *   - 後方互換のため window.nichiPrint / window.showPdfPreview も公開
 *     （receipt-feature.js が window.showPdfPreview を直接呼んでいるため）
 *
 * 依存ライブラリ（nichilog-pc.html 側で読込）:
 *   - jsPDF 2.5.1
 *   - html2canvas 1.4.1
 */
(function (global) {
  'use strict';

  // ------------------------------------------------------------
  // PDF プレビュー表示
  // pdf.output('datauristring') を新規タブで <embed> 表示する。
  // ポップアップブロック等で window.open が null の場合は
  // pdf.save() にフォールバックする（従来挙動を維持）。
  // ------------------------------------------------------------
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

  // ------------------------------------------------------------
  // 要素 → PDF 汎用変換
  // 指定 id の要素を html2canvas でキャプチャ → jsPDF (A4縦, 210mm幅)
  // 化し、showPdfPreview で新規タブ表示する。
  // ------------------------------------------------------------
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

  // ------------------------------------------------------------
  // 名前空間エクスポート
  // ------------------------------------------------------------
  var ReportFeature = {
    version: '0.1.0',
    showPdfPreview: showPdfPreview,
    nichiPrint: nichiPrint
  };

  global.ReportFeature = ReportFeature;

  // 後方互換: 既存の onclick="nichiPrint(...)" 属性と
  // receipt-feature.js の showPdfPreview 呼び出しのため、
  // グローバル名でもエクスポートする。
  if (typeof global.showPdfPreview !== 'function') {
    global.showPdfPreview = showPdfPreview;
  }
  if (typeof global.nichiPrint !== 'function') {
    global.nichiPrint = nichiPrint;
  }
})(window);
