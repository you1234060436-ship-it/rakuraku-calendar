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
      '/* 3) 印刷時：A4 縦・上余白を整え、min-height による空白伸長を抑制 */',
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
