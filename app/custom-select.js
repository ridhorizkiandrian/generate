/* ============================================================
   CUSTOM SELECT — Generate Soal Ujian
   File: custom-select.js
   ------------------------------------------------------------
   - Menggantikan tampilan <select> native tanpa mengubah logika
     aplikasi. Event 'change' asli tetap terpicu, sehingga kode
     lain yang mendengarkan (mis. mcOptionCount, identity-field-col)
     tetap berjalan seperti semula.
   - Menyediakan MutationObserver:
       * Jika <select> baru dibuat oleh JS (mis. saat render
         identity fields), ia otomatis dienhance.
       * Jika <option> di <select> yang sudah dienhance berubah
         (mis. countSel diisi lewat appendChild), UI custom
         otomatis di-refresh.
   - Adaptif ke SEMUA tema (styling via CSS var di theme.css).
   ============================================================ */

(function () {
  'use strict';

  const ENHANCED_FLAG = '__csEnhanced';

  /* ================================================
     UTIL
     ================================================ */
  function h(tag, cls, text) {
    const el = document.createElement(tag);
    if (cls) el.className = cls;
    if (text != null) el.textContent = text;
    return el;
  }

  function isDisabledSelect(sel) {
    return sel.disabled || sel.hasAttribute('disabled');
  }

  /* ================================================
     ENHANCE ONE <select>
     ================================================ */
  function enhance(sel) {
    if (!sel || sel[ENHANCED_FLAG]) return;
    if (sel.multiple) return;                 // multi-select tidak didukung
    if (sel.dataset.csIgnore === 'true') return;

    sel[ENHANCED_FLAG] = true;

    /* Sembunyikan <select> asli tapi tetap ada di DOM
       agar event 'change' & form submit tetap normal. */
    sel.classList.add('cs-native-hidden');
    sel.style.position = 'absolute';
    sel.style.opacity  = '0';
    sel.style.pointerEvents = 'none';
    sel.style.width = '1px';
    sel.style.height = '1px';
    sel.style.overflow = 'hidden';
    sel.setAttribute('tabindex', '-1');
    sel.setAttribute('aria-hidden', 'true');

    /* Wrapper */
    const wrap = h('div', 'cs-select cs-block');
    // Copy alignment/width hint kalau ada class khusus di <select>
    if (sel.className.indexOf('identity-field-col') !== -1) {
      wrap.classList.add('cs-identity-col');
    }

    /* Tombol yang terlihat */
    const btn = h('button', 'cs-selected');
    btn.type = 'button';
    btn.setAttribute('aria-haspopup', 'listbox');
    btn.setAttribute('aria-expanded', 'false');

    const label = h('span', 'cs-selected-label');
    const caret = document.createElement('i');
    caret.className = 'cs-selected-caret fa-solid fa-chevron-down';
    btn.appendChild(label);
    btn.appendChild(caret);

    /* Menu */
    const menu = h('div', 'cs-menu');
    menu.setAttribute('role', 'listbox');

    wrap.appendChild(btn);
    wrap.appendChild(menu);

    /* Sisipkan wrapper tepat sebelum <select> asli */
    sel.parentNode.insertBefore(wrap, sel);
    wrap.appendChild(sel); // pindahkan <select> ke dalam wrapper agar rapi

    /* Simpan referensi bolak-balik */
    sel.__csWrap  = wrap;
    sel.__csLabel = label;
    sel.__csMenu  = menu;
    sel.__csBtn   = btn;

    /* Render awal */
    renderOptions(sel);
    syncLabel(sel);

    /* Disabled state */
    if (isDisabledSelect(sel)) wrap.classList.add('cs-is-disabled', 'is-disabled');

    /* ── Event: buka/tutup ── */
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      if (isDisabledSelect(sel)) return;
      const isOpen = wrap.classList.contains('is-open');
      closeAll();
      if (!isOpen) openMenu(sel);
    });

    /* ── Keyboard support ── */
    btn.addEventListener('keydown', (e) => {
      if (isDisabledSelect(sel)) return;
      const opts = Array.from(menu.querySelectorAll('.cs-option:not(.is-disabled)'));
      const hoverIdx = opts.findIndex(o => o.classList.contains('is-hover'));
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        if (!wrap.classList.contains('is-open')) { openMenu(sel); return; }
        hover(opts, Math.min(opts.length - 1, hoverIdx + 1));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        if (!wrap.classList.contains('is-open')) { openMenu(sel); return; }
        hover(opts, Math.max(0, hoverIdx - 1));
      } else if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        if (!wrap.classList.contains('is-open')) { openMenu(sel); return; }
        const target = opts[hoverIdx] || opts[0];
        if (target) selectValue(sel, target.dataset.value);
      } else if (e.key === 'Escape') {
        closeMenu(sel);
      } else if (e.key === 'Tab') {
        closeMenu(sel);
      }
    });

    /* Sinkron jika value <select> diubah dari luar (mis. JS setter) */
    sel.addEventListener('change', () => {
      syncLabel(sel);
      // update highlight is-selected
      menu.querySelectorAll('.cs-option').forEach(o => {
        o.classList.toggle('is-selected', o.dataset.value === sel.value);
      });
    });

    /* Observe perubahan <option> di dalam <select> (mis. mcOptionCount
       yang diisi 2..26 via appendChild setelah enhance). */
    const optObserver = new MutationObserver(() => {
      renderOptions(sel);
      syncLabel(sel);
    });
    optObserver.observe(sel, { childList: true, subtree: false, attributes: true, attributeFilter: ['disabled'] });
    sel.__csObserver = optObserver;

    /* Ubah state disabled */
    const attrObserver = new MutationObserver(() => {
      wrap.classList.toggle('is-disabled', isDisabledSelect(sel));
    });
    attrObserver.observe(sel, { attributes: true, attributeFilter: ['disabled'] });
  }

  /* ================================================
     RENDER OPTIONS ke menu custom
     ================================================ */
  function renderOptions(sel) {
    const menu = sel.__csMenu;
    if (!menu) return;
    menu.innerHTML = '';
    Array.from(sel.options).forEach(opt => {
      const item = h('div', 'cs-option', opt.textContent);
      item.dataset.value = opt.value;
      item.setAttribute('role', 'option');
      if (opt.disabled) item.classList.add('is-disabled');
      if (opt.value === sel.value) {
        item.classList.add('is-selected');
      }
      item.addEventListener('mouseenter', () => {
        menu.querySelectorAll('.cs-option.is-hover').forEach(x => x.classList.remove('is-hover'));
        item.classList.add('is-hover');
      });
      item.addEventListener('click', (e) => {
        e.stopPropagation();
        if (opt.disabled) return;
        selectValue(sel, opt.value);
      });
      menu.appendChild(item);
    });
  }

  /* ================================================
     SELECT VALUE (dan trigger 'change' asli)
     ================================================ */
  function selectValue(sel, value) {
    if (sel.value !== value) {
      sel.value = value;
      // Trigger 'change' agar handler asli aplikasi (mis. renderPreview)
      // tetap tereksekusi.
      sel.dispatchEvent(new Event('change', { bubbles: true }));
      sel.dispatchEvent(new Event('input',  { bubbles: true }));
    } else {
      // Nilai tidak berubah — tetap update label saja
      syncLabel(sel);
    }
    closeMenu(sel);
    if (sel.__csBtn) sel.__csBtn.focus();
  }

  /* ================================================
     SYNC LABEL tombol
     ================================================ */
  function syncLabel(sel) {
    const label = sel.__csLabel;
    if (!label) return;
    const opt = sel.options[sel.selectedIndex];
    if (opt) {
      label.textContent = opt.textContent;
      label.classList.remove('is-placeholder');
    } else {
      label.textContent = sel.getAttribute('data-placeholder') || '—';
      label.classList.add('is-placeholder');
    }
    /* Update highlight is-selected di menu */
    if (sel.__csMenu) {
      sel.__csMenu.querySelectorAll('.cs-option').forEach(o => {
        o.classList.toggle('is-selected', o.dataset.value === sel.value);
      });
    }
  }

  /* ================================================
     OPEN / CLOSE
     ================================================ */
  function openMenu(sel) {
    const wrap = sel.__csWrap;
    const menu = sel.__csMenu;
    const btn  = sel.__csBtn;
    if (!wrap || !menu) return;

    wrap.classList.add('is-open');
    btn.setAttribute('aria-expanded', 'true');

    /* Hover default = item terpilih */
    menu.querySelectorAll('.cs-option').forEach(o => o.classList.remove('is-hover'));
    const active = menu.querySelector('.cs-option.is-selected') || menu.querySelector('.cs-option');
    if (active) {
      active.classList.add('is-hover');
      // scroll ke item aktif
      try { active.scrollIntoView({ block: 'nearest' }); } catch (e) {}
    }

    /* Cek apakah menu perlu buka ke atas (agar tidak keluar viewport) */
    positionMenu(sel);
  }

  function closeMenu(sel) {
    const wrap = sel.__csWrap;
    const btn  = sel.__csBtn;
    if (!wrap) return;
    wrap.classList.remove('is-open');
    if (btn) btn.setAttribute('aria-expanded', 'false');
    // reset flip-up
    if (sel.__csMenu) sel.__csMenu.classList.remove('cs-menu-up');
  }

  function closeAll() {
    document.querySelectorAll('.cs-select.is-open').forEach(w => {
      w.classList.remove('is-open');
      const b = w.querySelector('.cs-selected');
      if (b) b.setAttribute('aria-expanded', 'false');
      const m = w.querySelector('.cs-menu');
      if (m) m.classList.remove('cs-menu-up');
    });
  }

  function positionMenu(sel) {
    const menu = sel.__csMenu;
    const btn  = sel.__csBtn;
    if (!menu || !btn) return;
    const rect = btn.getBoundingClientRect();
    const menuHeight = Math.min(menu.scrollHeight, 260);
    const spaceBelow = window.innerHeight - rect.bottom;
    const spaceAbove = rect.top;
    if (spaceBelow < menuHeight + 16 && spaceAbove > spaceBelow) {
      menu.classList.add('cs-menu-up');
    } else {
      menu.classList.remove('cs-menu-up');
    }
  }

  /* ================================================
     GLOBAL LISTENERS — tutup saat klik luar / scroll
     ================================================ */
  document.addEventListener('click', (e) => {
    if (!e.target.closest('.cs-select')) closeAll();
  });
  window.addEventListener('resize', closeAll);
  window.addEventListener('scroll', () => {
    // reposition semua yang sedang terbuka
    document.querySelectorAll('.cs-select.is-open').forEach(w => {
      const sel = w.querySelector('select');
      if (sel) positionMenu(sel);
    });
  }, true);

  /* Ketika tema berubah, tidak perlu apa-apa (CSS var otomatis mengikuti),
     tapi kita pastikan menu yang sedang terbuka tetap terposisi rapi. */
  window.addEventListener('themechange', () => {
    document.querySelectorAll('.cs-select.is-open').forEach(w => {
      const sel = w.querySelector('select');
      if (sel) positionMenu(sel);
    });
  });

  /* ================================================
     SCAN & OBSERVE seluruh dokumen
     ================================================ */
  function enhanceAll(root) {
    (root || document).querySelectorAll('select').forEach(sel => {
      if (sel.dataset.csIgnore === 'true') return;
      if (!sel[ENHANCED_FLAG]) enhance(sel);
    });
  }

  const globalObserver = new MutationObserver((mutations) => {
    for (const m of mutations) {
      if (m.type !== 'childList') continue;
      m.addedNodes.forEach(node => {
        if (node.nodeType !== 1) return;
        if (node.tagName === 'SELECT') {
          if (!node[ENHANCED_FLAG]) enhance(node);
        } else if (node.querySelectorAll) {
          node.querySelectorAll('select').forEach(sel => {
            if (!sel[ENHANCED_FLAG]) enhance(sel);
          });
        }
      });
    }
  });

  function init() {
    enhanceAll(document);
    globalObserver.observe(document.body || document.documentElement, {
      childList: true,
      subtree: true,
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  /* ── Expose API global ── */
  window.CustomSelect = {
    enhance,
    enhanceAll,
    refresh: (sel) => { renderOptions(sel); syncLabel(sel); },
  };

})();
