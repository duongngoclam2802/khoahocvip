/**
 * ============================================================
 * KHOAHOCVIP SECURITY GUARD v1.0
 * Chạy sớm nhất có thể (non-module, synchronous)
 * ============================================================
 */
(function() {
  'use strict';

  // ─── 1. CHẶN CHUỘT PHẢI ─────────────────────────────────
  document.addEventListener('contextmenu', function(e) {
    e.preventDefault();
    return false;
  });

  // ─── 2. CHẶN PHÍM TẮT DEVTOOLS & XEM NGUỒN ─────────────
  document.addEventListener('keydown', function(e) {
    const key = e.key || e.keyCode;
    const ctrl = e.ctrlKey || e.metaKey;
    const shift = e.shiftKey;
    const alt = e.altKey;

    // F12
    if (key === 'F12' || e.keyCode === 123) {
      e.preventDefault(); return false;
    }

    // Ctrl+Shift+I (DevTools)
    if (ctrl && shift && (key === 'I' || key === 'i' || e.keyCode === 73)) {
      e.preventDefault(); return false;
    }

    // Ctrl+Shift+J (Console)
    if (ctrl && shift && (key === 'J' || key === 'j' || e.keyCode === 74)) {
      e.preventDefault(); return false;
    }

    // Ctrl+Shift+C (Element picker)
    if (ctrl && shift && (key === 'C' || key === 'c' || e.keyCode === 67)) {
      e.preventDefault(); return false;
    }

    // Ctrl+U (View source)
    if (ctrl && (key === 'U' || key === 'u' || e.keyCode === 85)) {
      e.preventDefault(); return false;
    }

    // Ctrl+S (Save page)
    if (ctrl && (key === 'S' || key === 's' || e.keyCode === 83)) {
      e.preventDefault(); return false;
    }

    // Ctrl+P (Print / Save as PDF)
    if (ctrl && (key === 'P' || key === 'p' || e.keyCode === 80)) {
      e.preventDefault(); return false;
    }

    // Ctrl+Shift+K (Firefox DevTools)
    if (ctrl && shift && (key === 'K' || key === 'k' || e.keyCode === 75)) {
      e.preventDefault(); return false;
    }

    // Ctrl+Shift+E (Firefox Network)
    if (ctrl && shift && (key === 'E' || key === 'e' || e.keyCode === 69)) {
      e.preventDefault(); return false;
    }

    // F5 — allow reload (don't block normal usage)
    // Ctrl+A on non-input elements (block select all on page)
    if (ctrl && (key === 'A' || key === 'a') && e.target.tagName !== 'INPUT' && e.target.tagName !== 'TEXTAREA') {
      e.preventDefault(); return false;
    }
  });

  // ─── 3. CHẶN KÉO THẢ ẢNH / NỘI DUNG ───────────────────
  document.addEventListener('dragstart', function(e) {
    if (e.target.tagName === 'IMG' || e.target.tagName === 'VIDEO') {
      e.preventDefault(); return false;
    }
  });

  // ─── 4. PHÁT HIỆN DEVTOOLS MỞ (timing trick) ────────────
  let devToolsOpen = false;
  const _devToolsCheck = function() {
    const start = performance.now();
    // Expanding an object in console takes significantly longer
    debugger; // eslint-disable-line no-debugger
    const elapsed = performance.now() - start;
    if (elapsed > 100 && !devToolsOpen) {
      devToolsOpen = true;
      _onDevToolsDetected();
    } else if (elapsed <= 100 && devToolsOpen) {
      devToolsOpen = false;
    }
  };

  // Secondary: window size check (DevTools docked changes inner vs outer size)
  const _sizeCheck = function() {
    const threshold = 160;
    if (
      (window.outerWidth - window.innerWidth > threshold) ||
      (window.outerHeight - window.innerHeight > threshold)
    ) {
      if (!devToolsOpen) {
        devToolsOpen = true;
        _onDevToolsDetected();
      }
    } else {
      devToolsOpen = false;
    }
  };

  function _onDevToolsDetected() {
    // Blur nội dung nhạy cảm, không redirect mạnh (UX friendly)
    document.body.style.filter = 'blur(6px)';
    document.body.style.pointerEvents = 'none';

    // Hiện cảnh báo
    const warn = document.getElementById('_sec_devtools_warn');
    if (warn) { warn.style.display = 'flex'; return; }

    const overlay = document.createElement('div');
    overlay.id = '_sec_devtools_warn';
    overlay.style.cssText = `
      position: fixed; inset: 0; z-index: 999999;
      display: flex; flex-direction: column;
      align-items: center; justify-content: center;
      background: rgba(0,0,0,0.92); backdrop-filter: blur(10px);
      color: white; text-align: center; padding: 2rem;
      font-family: 'Be Vietnam Pro', sans-serif;
    `;
    overlay.innerHTML = `
      <div style="font-size:3rem; margin-bottom:1rem;">🔒</div>
      <h2 style="font-size:1.5rem; font-weight:900; margin-bottom:0.5rem; color:#f97316;">
        Phát hiện công cụ kiểm tra!
      </h2>
      <p style="color:#94a3b8; font-size:0.9rem; max-width:340px; line-height:1.6">
        Nội dung được bảo vệ bản quyền.<br>
        Vui lòng đóng DevTools để tiếp tục học.
      </p>
      <button onclick="window.location.reload()" style="
        margin-top:1.5rem; padding:0.6rem 2rem;
        background: linear-gradient(to right, #f97316, #ef4444);
        color: white; border: none; border-radius: 999px;
        font-weight: 800; font-size: 0.9rem; cursor: pointer;
      ">Tải lại trang</button>
    `;
    document.body.appendChild(overlay);
  }

  // Run checks periodically
  setInterval(_sizeCheck, 1000);
  // Debugger check only when tab is active (avoid false positives on slow devices)
  document.addEventListener('visibilitychange', function() {
    if (!document.hidden) _devToolsCheck();
  });

  // ─── 5. CSS: TẮT COPY TRÊN NỘI DUNG HỌC TẬP ────────────
  // Áp dụng sau khi DOM sẵn sàng
  document.addEventListener('DOMContentLoaded', function() {
    const style = document.createElement('style');
    style.textContent = `
      /* Chặn chọn văn bản trên các phần nội dung học tập */
      .lecture-content, .video-player-wrap, #course-outline,
      #current-lecture-title, #lecture-description,
      .card-content, .content-container h2, .content-container h3,
      #view-learning .main-view-inner {
        -webkit-user-select: none !important;
        -moz-user-select: none !important;
        user-select: none !important;
      }
      /* Cho phép chọn trong input/textarea (ghi chú) */
      input, textarea, [contenteditable] {
        -webkit-user-select: text !important;
        user-select: text !important;
      }
      /* Chặn kéo ảnh */
      img { -webkit-user-drag: none; user-drag: none; }
      /* Tắt print */
      @media print { body { display: none !important; } }
    `;
    document.head.appendChild(style);
  });

  // ─── 6. CHẶN COPY NỘI DUNG (chỉ trong vùng học) ─────────
  document.addEventListener('copy', function(e) {
    const sel = window.getSelection();
    if (!sel || sel.isCollapsed) return;
    // Cho phép copy trong input/textarea
    const tag = document.activeElement ? document.activeElement.tagName : '';
    if (tag === 'INPUT' || tag === 'TEXTAREA') return;
    // Kiểm tra có đang ở view học không
    const learningView = document.getElementById('view-learning');
    if (learningView && !learningView.classList.contains('hidden')) {
      e.preventDefault();
      // Thay nội dung copy bằng watermark
      e.clipboardData && e.clipboardData.setData('text/plain',
        '© Khoahocvip.io.vn – Nội dung được bảo vệ bản quyền.');
    }
  });

  // ─── 7. NOSCRIPT WARNING (inject sớm) ───────────────────
  // (Handled in HTML via <noscript> tag)

})();
