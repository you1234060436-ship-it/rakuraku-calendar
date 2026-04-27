// receipt-preview-v2.js
// Plan B 並行実装：既存 receipt-feature.js の領収書プレビューを「A4 上端寄せ」に補正する
// 既存の青バー / 宛名 / 金額 / 内訳 / 収入印紙 / 発行元レイアウトは一切触らず、
// 2層 flex centering（#receiptPreviewOverlay + .rp-a4）の解除のみ行う。
//
// 読み込み位置: nichilog-v2.html で receipt-feature.js の直後
// 影響範囲: 領収書プレビュー（#receiptPreviewOverlay / .rp-a4）固有。
//   請求書(#invoiceOverlay) / 工事日報(#nippo-overlay) / receipt-print.html には無影響。

(function () {
  'use strict';

  function inject() {
    if (document.getElementById('receipt-preview-v2-styles')) return;
    var s = document.createElement('style');
    s.id = 'receipt-preview-v2-styles';
    s.textContent = [
      '/* receipt-preview-v2.js — A4 上端寄せ補正（!important で specificity 勝負） */',
      '',
      '/* 1) モーダル外側：viewport 中央寄せ → 上端寄せ */',
      '#receiptPreviewOverlay {',
      '  align-items: flex-start !important;',
      '  padding-top: 20px !important;',
      '}',
      '',
      '/* 2) A4 用紙内：.rp-b5 の縦中央寄せを解除して上端寄せに */',
      '.rp-a4 {',
      '  align-items: flex-start !important;',
      '  justify-content: center !important;',
      '  padding-top: 6mm !important;',
      '}',
      '',
      '/* 3) スマホ表示：A4 を画面幅に合わせて自動縮小（width:210mm 固定はみ出し対策） */',
      '@media (max-width: 800px) {',
      '  .rcpt-preview-wrap {',
      '    width: 100% !important;',
      '    overflow-x: auto !important;',
      '  }',
      '  .rp-a4 {',
      '    transform: scale(calc((100vw - 40px) / 793)) !important;',
      '    transform-origin: top center !important;',
      '    margin: 0 auto !important;',
      '  }',
      '}',
      '',
      '/* 4) 印刷時：A4 縦・上余白を整え、min-height による空白伸長を抑制 */',
      '@media print {',
      '  #receiptPreviewOverlay { padding-top: 0 !important; }',
      '  .rp-a4 {',
      '    padding-top: 5mm !important;',
      '    min-height: auto !important;',
      '  }',
      '}'
    ].join('\n');
    document.head.appendChild(s);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', inject);
  } else {
    inject();
  }
})();


// =============================================================================
// window.printRcpt 上書き（案C + clone 方式）
// =============================================================================
// 目的:
//   1. 「ビクッ」現象の解消 — bar.style.display 'none'/'' のレイアウトシフトを排除
//   2. スマホ transform:scale 適用時の PDF 解像度低下を回避 — 原寸 clone でキャプチャ
//
// 仕組み:
//   - .rp-a4 を cloneNode(true) で完全複製
//   - clone から transform を解除し、画面外（left:-99999px）に position:fixed 配置
//   - 元 DOM (.rp-a4) は一切触らない → ユーザー画面に変化ゼロ
//   - clone を html2canvas でキャプチャ → 高解像度の PDF を生成
//   - try/finally で必ず clone を削除
//
// 副作用:
//   - 領収書プレビュー以外には無影響
//   - 請求書 / 工事日報 / receipt-print.html とは経路が異なるため干渉なし
// =============================================================================
(function () {
  'use strict';

  // receipt-feature.js が先に読み込まれて window.printRcpt を定義している前提
  // （v2.html の <script> タグ順序で保証）
  window.printRcpt = async function () {
    try {
      const overlay = document.getElementById('receiptPreviewOverlay');
      if (!overlay) return;
      const a4 = overlay.querySelector('.rp-a4');
      if (!a4) return;

      // .rp-a4 を一時複製（transform 解除 + 画面外配置）
      const clone = a4.cloneNode(true);
      clone.style.transform = 'none';
      clone.style.transformOrigin = '';
      clone.style.position = 'fixed';
      clone.style.top = '0';
      clone.style.left = '-99999px';
      clone.style.margin = '0';
      document.body.appendChild(clone);

      let canvas;
      try {
        canvas = await html2canvas(clone, {
          scale: 2,
          useCORS: true,
          backgroundColor: '#ffffff'
        });
      } finally {
        // 例外が出ても必ず clone を削除
        if (clone && clone.parentNode) clone.parentNode.removeChild(clone);
      }

      const imgData = canvas.toDataURL('image/jpeg', 0.95);
      const { jsPDF } = window.jspdf;
      const pageWidth = 210;
      const imgHeight = (canvas.height * pageWidth) / canvas.width;
      const pdf = new jsPDF('p', 'mm', [pageWidth, Math.max(imgHeight, 297)]);
      pdf.addImage(imgData, 'JPEG', 0, 0, pageWidth, imgHeight);
      if (typeof showPdfPreview === 'function') {
        showPdfPreview(pdf, 'nichilog_receipt_' + new Date().toISOString().slice(0, 10) + '.pdf');
      }
    } catch (e) {
      console.error(e);
    }
  };
})();
