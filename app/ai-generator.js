/* ============================================================
   AI GENERATE SOAL — Frontend
   File: ai-generator.js
   - File BARU, tidak mengubah logika aplikasi yang sudah ada.
   - Soal hasil AI dikonversi ke struktur data soal aplikasi
     (sama persis dengan saveMcQuestion / saveEssayQuestion),
     lalu dimasukkan ke `questions`, `saveToStorage()`, `renderAll()`.
   - Layout/format soal AI menggunakan konfigurasi SENDIRI
     (aiState / "aiGenerationSettings": questionLayout, answerLayout,
     mcOptionCount) yang TERPISAH dari formPrefs (konfigurasi modal
     Pilihan Ganda manual). Diatur langsung di dalam modal AI ini,
     tanpa perlu membuka modal Pilihan Ganda utama.
   - API key TIDAK ada di sini — pemanggilan AI (Groq) dilakukan
     server-side melalui /api/generate-soal.
   ============================================================ */

(function () {
  'use strict';

  var AI_MAX_MC = 50;
  var AI_MAX_ESSAY = 20;
  var AI_MIN_COUNT = 1;
  var AI_MATERI_MAX = 500;
  var AI_COOLDOWN_MS = 5000; // cegah request berulang terlalu cepat

  var KELAS_BY_JENJANG = {
    SD: [1, 2, 3, 4, 5, 6],
    SMP: [7, 8, 9],
    SMA: [10, 11, 12],
    SMK: [10, 11, 12]
  };
  var JENJANG_ORDER = ['SD', 'SMP', 'SMA', 'SMK'];

  /*
   * ── STATE KHUSUS AI (aiGenerationSettings) ──────────────────
   * State ini SEPENUHNYA independen dari `formPrefs` (konfigurasi
   * Pilihan Ganda utama di index.html). Tidak ada satupun field
   * di sini yang dibaca dari atau ditulis ke `formPrefs`.
   *
   * mainMultipleChoiceLayout (formPrefs.mcLayout / mcQuestionLayout)
   * dan aiGenerationLayout (aiState.answerLayout / questionLayout)
   * adalah dua konfigurasi berbeda — mengubah salah satu TIDAK
   * mengubah yang lain.
   */
  var AI_SETTINGS_KEY = 'buatsoal_ai_generation_settings_v1';

  var aiState = {
    busy: false,
    modalOpen: false, // isAiGeneratorModalOpen — independen dari modal lain
    lastRequestAt: 0,
    jenjang: '',
    kelas: '',
    materi: '',
    difficulty: 'sedang',
    mcEnabled: true,
    essayEnabled: true,
    mcCount: 10,
    essayCount: 5,
    // Konfigurasi khusus AI — TIDAK terhubung ke form Pilihan Ganda utama
    mcOptionCount: 5,        // Jumlah Opsi AI (setara A-D / A-E)
    questionLayout: '1-column', // Layout Soal AI
    answerLayout: '1-column'    // Layout Jawaban AI
  };

  function loadAiSettings() {
    try {
      var raw = localStorage.getItem(AI_SETTINGS_KEY);
      if (!raw) return;
      var saved = JSON.parse(raw);
      if (!saved || typeof saved !== 'object') return;
      if (saved.mcOptionCount) aiState.mcOptionCount = Math.max(2, Math.min(26, parseInt(saved.mcOptionCount, 10) || 5));
      if (saved.questionLayout === '1-column' || saved.questionLayout === '2-column') aiState.questionLayout = saved.questionLayout;
      if (saved.answerLayout === '1-column' || saved.answerLayout === '2-column') aiState.answerLayout = saved.answerLayout;
      if (saved.difficulty) aiState.difficulty = saved.difficulty;
    } catch (e) { /* noop */ }
  }

  function saveAiSettings() {
    try {
      localStorage.setItem(AI_SETTINGS_KEY, JSON.stringify({
        mcOptionCount: aiState.mcOptionCount,
        questionLayout: aiState.questionLayout,
        answerLayout: aiState.answerLayout,
        difficulty: aiState.difficulty
      }));
    } catch (e) { /* noop, penyimpanan tidak kritikal */ }
  }

  loadAiSettings();

  /* ── Helper DOM ── */
  function $(id) { return document.getElementById(id); }
  function esc(str) {
    return (typeof escapeHtml === 'function') ? escapeHtml(str) : String(str == null ? '' : str);
  }
  function tt(key) { return (typeof t === 'function') ? t(key) : key; }
  function ttErr(key) {
    var v = (typeof t === 'function') ? t(key) : key;
    return (v && v !== key) ? v : key;
  }
  function aiErrorMsg(code) {
    var map = {
      AI_NOT_CONFIGURED: 'ai.errNotConfigured',
      RATE_LIMITED: 'ai.errRateLimit',
      INVALID_RESPONSE: 'ai.errInvalid',
      GENERATION_FAILED: 'ai.errFailed',
      NETWORK: 'ai.errFailed'
    };
    return ttErr(map[code] || 'ai.errFailed');
  }

  /* ============================================================
     1. CSS — mengikuti desain aplikasi (var tema, radius, shadow)
     ============================================================ */
  function injectAiStyles() {
    if ($('aiGeneratorStyles')) return;
    var css = `
      .qa-card.ai .qa-icon{background:var(--warning-soft);color:var(--warning);}
      @media (max-width:680px){ .quick-actions{grid-template-columns:1fr;} }

      /* Tombol "AI" di sebelah Ekspor PDF (header-actions & mobile header) */
      .btn-ai{background:linear-gradient(135deg,#0074fc,#0074fc);color:#fff;border:none;
        box-shadow:0 2px 8px rgba(124,58,237,.28);}
      .btn-ai:hover{background:linear-gradient(135deg,#0074fc,#0074fc);transform:translateY(-1px);
        box-shadow:0 6px 16px rgba(124,58,237,.32);}
      .btn-ai i{font-size:13px;}
      .mh-ai{background:linear-gradient(135deg,#0074fc,#0074fc);color:#fff;border:none;border-radius:8px;
        padding:8px 12px;font-size:13px;font-weight:600;display:flex;align-items:center;gap:6px;}

      .ai-jenjang-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;}
      .ai-jenjang-grid .segmented button{flex:1 1 auto;}

      /* Baris jenis soal — kartu modern dengan transisi halus */
      .ai-kind-row{
        display:flex;align-items:center;justify-content:space-between;gap:14px;
        padding:14px 16px;border:1px solid var(--border);border-radius:12px;
        background:var(--card);margin-bottom:10px;
        transition:border-color .18s var(--ease, ease), box-shadow .18s var(--ease, ease), background .18s var(--ease, ease);
      }
      .ai-kind-row:hover{border-color:var(--border-strong);box-shadow:var(--shadow-sm, 0 1px 2px rgba(20,24,40,.05));}
      .ai-kind-row:has(input:checked){border-color:var(--primary);background:var(--primary-soft);}
      .ai-kind-left{display:flex;align-items:center;gap:10px;min-width:0;}
      .ai-kind-check{display:flex;align-items:center;gap:10px;cursor:pointer;user-select:none;}
      .ai-kind-check input{width:17px;height:17px;accent-color:var(--primary);cursor:pointer;flex-shrink:0;}
      .ai-kind-name{font-size:14px;font-weight:700;color:var(--ink);}
      .ai-kind-right{display:flex;align-items:center;gap:10px;flex-shrink:0;}
      .ai-count-label{font-size:12px;font-weight:600;color:var(--ink-soft);white-space:nowrap;}
      .ai-stepper{display:inline-flex;align-items:center;border:1px solid var(--border-strong);border-radius:10px;overflow:hidden;background:var(--card);}
      .ai-stepper button{
        width:32px;height:34px;border:0;background:var(--bg);color:var(--ink-soft);cursor:pointer;
        display:flex;align-items:center;justify-content:center;font-size:11px;flex-shrink:0;
        transition:background .15s var(--ease, ease), color .15s var(--ease, ease);
      }
      .ai-stepper button:hover{background:var(--primary-soft);color:var(--primary);}
      .ai-stepper button:active{transform:scale(.93);}
      .ai-stepper input{
        width:48px;border:0;text-align:center;font-size:13.5px;font-weight:700;color:var(--ink);
        padding:6px 0;outline:none;background:var(--card);
      }
      .ai-stepper input::-webkit-outer-spin-button,
      .ai-stepper input::-webkit-inner-spin-button{-webkit-appearance:none;margin:0;}
      .ai-stepper input[type=number]{-moz-appearance:textfield;appearance:textfield;}
      .ai-kind-settings{
        margin:-2px 0 10px;padding:0 4px 0 38px;display:flex;flex-direction:column;gap:8px;align-items:flex-start;
      }
      .ai-note{
        font-size:11.5px;color:var(--ink-faint);line-height:1.55;
      }
      .ai-settings-block{
        width:100%;display:flex;flex-direction:column;gap:14px;
        padding:14px 16px;border:1px solid var(--border);border-radius:12px;
        background:var(--bg);
      }
      .ai-settings-row{display:flex;flex-direction:column;gap:6px;}
      .ai-settings-label{font-size:12px;font-weight:700;color:var(--ink-soft);text-transform:uppercase;letter-spacing:.04em;}
      .ai-settings-row select{max-width:180px;}
      .ai-inline-error{
        display:none;align-items:center;gap:7px;color:var(--danger);font-size:12.5px;font-weight:600;margin-top:10px;
        padding:10px 12px;background:var(--danger-soft);border-radius:10px;
      }
      .ai-inline-error.show{display:flex;}
      @media (max-width:560px){
        .ai-jenjang-grid{grid-template-columns:repeat(2,1fr);}
        .ai-kind-row{flex-direction:column;align-items:stretch;gap:12px;}
        .ai-kind-right{justify-content:space-between;}
        .ai-kind-settings{padding-left:4px;}
      }
    `;
    var style = document.createElement('style');
    style.id = 'aiGeneratorStyles';
    style.textContent = css;
    document.head.appendChild(style);
  }

  /* ============================================================
     2. Tombol "AI Generate" pada quick-actions (mengikuti .qa-card)
     ============================================================ */
  function injectAiButton() {
    // Desktop: taruh persis di sebelah tombol "Ekspor PDF" di header-actions
    if (!$('btnAiGenerate')) {
      var exportBtn = $('btnExportPdf');
      if (exportBtn && exportBtn.parentNode) {
        var btn = document.createElement('button');
        btn.className = 'btn btn-ai';
        btn.id = 'btnAiGenerate';
        btn.type = 'button';
        btn.title = tt('ai.btnTitle');
        btn.innerHTML = '<i class="fa-solid fa-wand-magic-sparkles"></i><span>AI</span>';
        exportBtn.parentNode.insertBefore(btn, exportBtn);
        btn.addEventListener('click', function () { openAiModal(); });
      } else {
        // Fallback lama, jika struktur header-actions tidak ditemukan
        var quick = $('quickActions');
        var btnEssay = $('btnAddEssay');
        if (quick) {
          var fbBtn = document.createElement('button');
          fbBtn.className = 'qa-card ai';
          fbBtn.id = 'btnAiGenerate';
          fbBtn.type = 'button';
          fbBtn.innerHTML =
            '<div class="qa-icon"><i class="fa-solid fa-wand-magic-sparkles"></i></div>' +
            '<div><h3 data-i18n="ai.btnTitle">' + esc(tt('ai.btnTitle')) + '</h3>' +
            '<p data-i18n="ai.btnDesc">' + esc(tt('ai.btnDesc')) + '</p></div>';
          if (btnEssay && btnEssay.parentNode === quick) {
            quick.insertBefore(fbBtn, btnEssay.nextSibling);
          } else {
            quick.appendChild(fbBtn);
          }
          fbBtn.addEventListener('click', function () { openAiModal(); });
        }
      }
    }

    // Mobile: taruh di sebelah tombol PDF di header mobile
    if (!$('btnAiGenerateMobile')) {
      var exportBtnMobile = $('btnExportPdfMobile');
      if (exportBtnMobile && exportBtnMobile.parentNode) {
        var btnM = document.createElement('button');
        btnM.className = 'mh-ai';
        btnM.id = 'btnAiGenerateMobile';
        btnM.type = 'button';
        btnM.title = tt('ai.btnTitle');
        btnM.innerHTML = '<i class="fa-solid fa-wand-magic-sparkles"></i>AI';
        exportBtnMobile.parentNode.insertBefore(btnM, exportBtnMobile);
        btnM.addEventListener('click', function () { openAiModal(); });
      }
    }
  }

  /* ============================================================
     3. Modal AI Generate
     ============================================================ */
  function buildAiModal() {
    if ($('aiModalOverlay')) return;

    var overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.id = 'aiModalOverlay';
    overlay.innerHTML =
      '<div class="modal" role="dialog" aria-modal="true" aria-labelledby="aiModalTitle">' +
        '<div class="modal-header">' +
          '<div>' +
            '<h2 id="aiModalTitle"><i class="fa-solid fa-wand-magic-sparkles" style="color:var(--warning);margin-right:6px;"></i><span data-i18n="ai.modalTitle">' + esc(tt('ai.modalTitle')) + '</span></h2>' +
            '<p id="aiModalSub" data-i18n="ai.modalSub">' + esc(tt('ai.modalSub')) + '</p>' +
          '</div>' +
          '<button class="icon-btn" type="button" data-close="aiModalOverlay" aria-label="Tutup"><i class="fa-solid fa-xmark"></i></button>' +
        '</div>' +
        '<div class="modal-body">' +

          // Jenjang
          '<div class="field">' +
            '<label class="field-label"><span data-i18n="ai.level">Jenjang Pendidikan</span><span class="req">*</span></label>' +
            '<div class="ai-jenjang-grid"><div class="segmented" id="aiJenjangToggle" style="width:100%;">' +
              JENJANG_ORDER.map(function (j) {
                return '<button type="button" data-jenjang="' + j + '">' + j + '</button>';
              }).join('') +
            '</div></div>' +
          '</div>' +

          // Kelas
          '<div class="field" id="aiKelasField">' +
            '<label class="field-label"><span data-i18n="ai.grade">Kelas</span><span class="req">*</span></label>' +
            '<select id="aiKelasSelect" disabled></select>' +
          '</div>' +

          // Materi
          '<div class="field" id="aiMateriField">' +
            '<label class="field-label"><span data-i18n="ai.material">Materi Soal</span><span class="req">*</span>' +
              '<span class="counter" id="aiMateriCounter">0 ' + esc(tt('form.chars')) + '</span></label>' +
            '<textarea id="aiMateriInput" rows="3" maxlength="' + AI_MATERI_MAX + '" data-i18n-ph="ai.materialPh" placeholder="' + esc(tt('ai.materialPh')) + '"></textarea>' +
          '</div>' +

          // Tingkat kesulitan
          '<div class="field">' +
            '<label class="field-label" data-i18n="ai.difficulty">Tingkat Kesulitan</label>' +
            '<select id="aiDifficultySelect">' +
              '<option value="mudah" data-i18n="ai.diffEasy">' + esc(tt('ai.diffEasy')) + '</option>' +
              '<option value="sedang" selected data-i18n="ai.diffMedium">' + esc(tt('ai.diffMedium')) + '</option>' +
              '<option value="sulit" data-i18n="ai.diffHard">' + esc(tt('ai.diffHard')) + '</option>' +
              '<option value="campuran" data-i18n="ai.diffMixed">' + esc(tt('ai.diffMixed')) + '</option>' +
            '</select>' +
          '</div>' +

          // Jenis soal
          '<div class="field" id="aiKindField" style="margin-bottom:0;">' +
            '<label class="field-label"><span data-i18n="ai.types">Jenis Soal</span><span class="req">*</span></label>' +

            // Pilihan ganda
            '<div class="ai-kind-row">' +
              '<div class="ai-kind-left">' +
                '<label class="ai-kind-check">' +
                  '<input type="checkbox" id="aiMcEnabled" checked>' +
                  '<span class="ai-kind-name" data-i18n="ai.typeMc">Pilihan Ganda</span>' +
                '</label>' +
              '</div>' +
              '<div class="ai-kind-right" id="aiMcCountWrap">' +
                '<span class="ai-count-label" data-i18n="ai.count">' + esc(tt('ai.count')) + '</span>' +
                '<div class="ai-stepper">' +
                  '<button type="button" id="aiMcMinus" aria-label="Kurangi"><i class="fa-solid fa-minus"></i></button>' +
                  '<input type="number" id="aiMcCount" value="10" min="' + AI_MIN_COUNT + '" max="' + AI_MAX_MC + '">' +
                  '<button type="button" id="aiMcPlus" aria-label="Tambah"><i class="fa-solid fa-plus"></i></button>' +
                '</div>' +
              '</div>' +
            '</div>' +
            '<div class="ai-kind-settings" id="aiMcSettingsWrap">' +
              '<div class="ai-settings-block">' +
                '<div class="ai-settings-row">' +
                  '<span class="ai-settings-label" data-i18n="ai.optionCount">' + esc(tt('ai.optionCount')) + '</span>' +
                  '<select id="aiOptionCount">' +
                    // Jumlah opsi pilihan ganda AI: MINIMAL 2 sampai MAKSIMAL 26 (A–Z)
                    (function () {
                      var arr = [];
                      for (var n = 2; n <= 26; n++) arr.push('<option value="' + n + '">' + n + '</option>');
                      return arr.join('');
                    })() +
                  '</select>' +
                '</div>' +
                '<div class="ai-settings-row">' +
                  '<span class="ai-settings-label" data-i18n="ai.questionLayoutAi">' + esc(tt('ai.questionLayoutAi')) + '</span>' +
                  '<div class="segmented" id="aiQuestionLayoutToggle" style="width:fit-content;">' +
                    '<button type="button" data-qlayout="1-column" data-i18n="common.col1">' + esc(tt('common.col1')) + '</button>' +
                    '<button type="button" data-qlayout="2-column" data-i18n="common.col2">' + esc(tt('common.col2')) + '</button>' +
                  '</div>' +
                '</div>' +
                '<div class="ai-settings-row">' +
                  '<span class="ai-settings-label" data-i18n="ai.answerLayoutAi">' + esc(tt('ai.answerLayoutAi')) + '</span>' +
                  '<div class="segmented" id="aiAnswerLayoutToggle" style="width:fit-content;">' +
                    '<button type="button" data-alayout="1-column" data-i18n="common.col1">' + esc(tt('common.col1')) + '</button>' +
                    '<button type="button" data-alayout="2-column" data-i18n="common.col2">' + esc(tt('common.col2')) + '</button>' +
                  '</div>' +
                '</div>' +
                '<div class="ai-note" data-i18n="ai.layoutAiHint">' + esc(tt('ai.layoutAiHint')) + '</div>' +
              '</div>' +
            '</div>' +

            // Essay
            '<div class="ai-kind-row">' +
              '<div class="ai-kind-left">' +
                '<label class="ai-kind-check">' +
                  '<input type="checkbox" id="aiEssayEnabled" checked>' +
                  '<span class="ai-kind-name" data-i18n="ai.typeEssay">Essay</span>' +
                '</label>' +
              '</div>' +
              '<div class="ai-kind-right" id="aiEssayCountWrap">' +
                '<span class="ai-count-label" data-i18n="ai.count">' + esc(tt('ai.count')) + '</span>' +
                '<div class="ai-stepper">' +
                  '<button type="button" id="aiEssayMinus" aria-label="Kurangi"><i class="fa-solid fa-minus"></i></button>' +
                  '<input type="number" id="aiEssayCount" value="5" min="' + AI_MIN_COUNT + '" max="' + AI_MAX_ESSAY + '">' +
                  '<button type="button" id="aiEssayPlus" aria-label="Tambah"><i class="fa-solid fa-plus"></i></button>' +
                '</div>' +
              '</div>' +
            '</div>' +

            '<div class="ai-inline-error" id="aiKindError">' +
              '<i class="fa-solid fa-triangle-exclamation"></i><span data-i18n="ai.errNoType">' + esc(tt('ai.errNoType')) + '</span>' +
            '</div>' +
          '</div>' +

        '</div>' +
        '<div class="modal-footer">' +
          '<button class="btn btn-outline" type="button" data-close="aiModalOverlay"><span data-i18n="common.cancel">' + esc(tt('common.cancel')) + '</span></button>' +
          '<button class="btn btn-primary" type="button" id="btnAiGenerateSubmit">' +
            '<i class="fa-solid fa-wand-magic-sparkles"></i><span data-i18n="ai.generate">' + esc(tt('ai.generate')) + '</span>' +
          '</button>' +
        '</div>' +
      '</div>';

    // Sisipkan sebelum confirmModalOverlay jika ada, jika tidak di akhir body
    var confirmOverlay = $('confirmModalOverlay');
    if (confirmOverlay && confirmOverlay.parentNode) {
      confirmOverlay.parentNode.insertBefore(overlay, confirmOverlay);
    } else {
      document.body.appendChild(overlay);
    }

    bindAiModalEvents(overlay);
    if (typeof translateDom === 'function') translateDom(overlay);
  }

  /* ── Binding event modal ── */
  function bindAiModalEvents(overlay) {
    // Tutup modal (mengikuti pola aplikasi)
    overlay.querySelectorAll('[data-close]').forEach(function (btn) {
      btn.addEventListener('click', function () { closeAiModal(); });
    });
    overlay.addEventListener('click', function (e) { if (e.target === overlay && !aiState.busy) closeAiModal(); });

    // Jenjang
    $('aiJenjangToggle').querySelectorAll('button').forEach(function (btn) {
      btn.addEventListener('click', function () {
        setAiJenjang(btn.dataset.jenjang);
      });
    });

    // Kelas
    $('aiKelasSelect').addEventListener('change', function (e) {
      aiState.kelas = e.target.value;
      clearFieldErr('aiKelasField');
    });

    // Materi
    var materiInput = $('aiMateriInput');
    materiInput.addEventListener('input', function () {
      aiState.materi = materiInput.value;
      $('aiMateriCounter').textContent = materiInput.value.length + ' ' + tt('form.chars');
      clearFieldErr('aiMateriField');
    });

    // Kesulitan
    $('aiDifficultySelect').addEventListener('change', function (e) { aiState.difficulty = e.target.value; });

    // Toggle jenis soal
    $('aiMcEnabled').addEventListener('change', function (e) {
      aiState.mcEnabled = e.target.checked;
      syncKindUI();
    });
    $('aiEssayEnabled').addEventListener('change', function (e) {
      aiState.essayEnabled = e.target.checked;
      syncKindUI();
    });

    // Stepper
    bindStepper('aiMcMinus', 'aiMcPlus', 'aiMcCount', AI_MIN_COUNT, AI_MAX_MC, function (v) { aiState.mcCount = v; });
    bindStepper('aiEssayMinus', 'aiEssayPlus', 'aiEssayCount', AI_MIN_COUNT, AI_MAX_ESSAY, function (v) { aiState.essayCount = v; });

    // Jumlah Opsi AI — state & penyimpanan SENDIRI, tidak menyentuh formPrefs.mcOptionCount
    $('aiOptionCount').addEventListener('change', function (e) {
      aiState.mcOptionCount = Math.max(2, Math.min(26, parseInt(e.target.value, 10) || 5));
      saveAiSettings();
    });

    // Layout Soal AI — state & penyimpanan SENDIRI, tidak menyentuh formPrefs.mcQuestionLayout
    $('aiQuestionLayoutToggle').addEventListener('click', function (e) {
      var btn = e.target.closest('button[data-qlayout]');
      if (!btn) return;
      aiState.questionLayout = btn.dataset.qlayout;
      $('aiQuestionLayoutToggle').querySelectorAll('button').forEach(function (b) {
        b.classList.toggle('active', b === btn);
      });
      saveAiSettings();
    });

    // Layout Jawaban AI — state & penyimpanan SENDIRI, tidak menyentuh formPrefs.mcLayout
    $('aiAnswerLayoutToggle').addEventListener('click', function (e) {
      var btn = e.target.closest('button[data-alayout]');
      if (!btn) return;
      aiState.answerLayout = btn.dataset.alayout;
      $('aiAnswerLayoutToggle').querySelectorAll('button').forEach(function (b) {
        b.classList.toggle('active', b === btn);
      });
      saveAiSettings();
    });

    // Submit
    $('btnAiGenerateSubmit').addEventListener('click', submitAiGenerate);
  }

  function bindStepper(minusId, plusId, inputId, min, max, onChange) {
    var input = $(inputId);
    var clamp = function (v) { return Math.max(min, Math.min(max, v || min)); };
    $(minusId).addEventListener('click', function () { input.value = clamp(parseInt(input.value, 10) - 1); onChange(parseInt(input.value, 10)); });
    $(plusId).addEventListener('click', function () { input.value = clamp(parseInt(input.value, 10) + 1); onChange(parseInt(input.value, 10)); });
    input.addEventListener('change', function () { input.value = clamp(parseInt(input.value, 10)); onChange(parseInt(input.value, 10)); });
  }

  function setAiJenjang(jenjang) {
    aiState.jenjang = jenjang;
    $('aiJenjangToggle').querySelectorAll('button').forEach(function (b) {
      b.classList.toggle('active', b.dataset.jenjang === jenjang);
    });
    var kelasSel = $('aiKelasSelect');
    var list = KELAS_BY_JENJANG[jenjang] || [];
    kelasSel.innerHTML = list.map(function (k) {
      return '<option value="' + k + '">' + tt('ai.gradePrefix') + ' ' + k + '</option>';
    }).join('');
    kelasSel.disabled = list.length === 0;
    aiState.kelas = list.length ? String(list[0]) : '';
    kelasSel.value = aiState.kelas;
    clearFieldErr('aiKelasField');
  }

  function syncKindUI() {
    $('aiMcCountWrap').style.opacity = aiState.mcEnabled ? '1' : '0.45';
    $('aiMcSettingsWrap').style.display = aiState.mcEnabled ? 'flex' : 'none';
    $('aiEssayCountWrap').style.opacity = aiState.essayEnabled ? '1' : '0.45';
    $('aiMcCount').disabled = !aiState.mcEnabled;
    $('aiMcMinus').disabled = !aiState.mcEnabled;
    $('aiMcPlus').disabled = !aiState.mcEnabled;
    $('aiEssayCount').disabled = !aiState.essayEnabled;
    $('aiEssayMinus').disabled = !aiState.essayEnabled;
    $('aiEssayPlus').disabled = !aiState.essayEnabled;
    if (aiState.mcEnabled || aiState.essayEnabled) $('aiKindError').classList.remove('show');
  }

  /* ── Buka / tutup modal ──────────────────────────────────────
     `aiState.modalOpen` (konsep: isAiGeneratorModalOpen) adalah
     state open/close MILIK modal AI SENDIRI. Modal ini tidak
     pernah memanggil fungsi buka/tutup modal lain (mis. modal
     Pilihan Ganda utama), sehingga menutup salah satu modal TIDAK
     ikut menutup modal yang lain. */
  function openAiModal() {
    if (typeof getActiveFile === 'function' && !getActiveFile()) {
      if (typeof setNav === 'function') setNav('bank');
      if (typeof showToast === 'function') showToast(tt('toast.needFileOpen'), 'warning');
      return;
    }
    buildAiModal();
    injectAiStyles();
    aiState.modalOpen = true;

    // Prefill dari aiState SENDIRI — TIDAK membaca/menulis formPrefs sama sekali.
    if (aiState.jenjang) setAiJenjang(aiState.jenjang);
    if (aiState.kelas) $('aiKelasSelect').value = aiState.kelas;
    $('aiDifficultySelect').value = aiState.difficulty || 'sedang';
    $('aiMcEnabled').checked = aiState.mcEnabled;
    $('aiEssayEnabled').checked = aiState.essayEnabled;
    $('aiMcCount').value = aiState.mcCount;
    $('aiEssayCount').value = aiState.essayCount;
    $('aiMateriInput').value = aiState.materi || '';
    $('aiMateriCounter').textContent = ($('aiMateriInput').value.length) + ' ' + tt('form.chars');

    // Jumlah Opsi AI
    var optSel = $('aiOptionCount');
    if (!Array.prototype.some.call(optSel.options, function (o) { return parseInt(o.value, 10) === aiState.mcOptionCount; })) {
      var extraOpt = document.createElement('option');
      extraOpt.value = String(aiState.mcOptionCount);
      extraOpt.textContent = String(aiState.mcOptionCount);
      optSel.appendChild(extraOpt);
    }
    optSel.value = String(aiState.mcOptionCount);

    // Layout Soal AI / Layout Jawaban AI
    $('aiQuestionLayoutToggle').querySelectorAll('button').forEach(function (b) {
      b.classList.toggle('active', b.dataset.qlayout === aiState.questionLayout);
    });
    $('aiAnswerLayoutToggle').querySelectorAll('button').forEach(function (b) {
      b.classList.toggle('active', b.dataset.alayout === aiState.answerLayout);
    });

    syncKindUI();

    if (typeof translateDom === 'function') translateDom($('aiModalOverlay'));
    if (typeof openModal === 'function') openModal($('aiModalOverlay'));
    else $('aiModalOverlay').classList.add('show');
    setTimeout(function () { if (!aiState.jenjang) { var f = $('aiJenjangToggle').querySelector('button'); if (f) f.focus(); } else $('aiMateriInput').focus(); }, 200);
  }

  function closeAiModal(silent) {
    var overlay = $('aiModalOverlay');
    if (!overlay) return;
    if (aiState.busy && !silent) return; // jangan tutup paksa saat generate
    // HANYA menutup overlay AI ini (id="aiModalOverlay"). Tidak memanggil
    // fungsi close untuk modal lain, sehingga popup Pilihan Ganda (atau
    // modal lain) yang sedang terbuka tetap terbuka.
    if (typeof closeModal === 'function') closeModal(overlay);
    else overlay.classList.remove('show');
    aiState.modalOpen = false;
  }

  /* ── Validasi & field error (konsisten dengan pola aplikasi) ── */
  function setFieldErr(fieldId) {
    var f = $(fieldId); if (f) f.classList.add('has-error');
  }
  function clearFieldErr(fieldId) {
    var f = $(fieldId); if (f) f.classList.remove('has-error');
  }

  function validateAiForm() {
    var ok = true;
    if (!aiState.jenjang) { ok = false; if (typeof showToast === 'function') showToast(ttErr('ai.errNoJenjang'), 'warning'); return false; }
    if (!aiState.kelas) { setFieldErr('aiKelasField'); ok = false; if (typeof showToast === 'function') showToast(ttErr('ai.errNoKelas'), 'warning'); return false; }
    var materi = ($('aiMateriInput').value || '').trim();
    if (!materi) { setFieldErr('aiMateriField'); ok = false; if (typeof showToast === 'function') showToast(ttErr('ai.errNoMateri'), 'warning'); return false; }
    if (!aiState.mcEnabled && !aiState.essayEnabled) { $('aiKindError').classList.add('show'); ok = false; if (typeof showToast === 'function') showToast(ttErr('ai.errNoType'), 'warning'); return false; }
    return ok;
  }

  /* ── Loading state tombol ── */
  function setBusy(busy) {
    aiState.busy = busy;
    var btn = $('btnAiGenerateSubmit');
    if (!btn) return;
    btn.disabled = busy;
    if (busy) {
      btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i><span>' + esc(tt('ai.generating')) + '</span>';
    } else {
      btn.innerHTML = '<i class="fa-solid fa-wand-magic-sparkles"></i><span>' + esc(tt('ai.generate')) + '</span>';
    }
  }

  /* ── Konversi hasil AI -> struktur data soal aplikasi ── */
  /*
   * PENTING: jumlah opsi diambil dari data soal itu sendiri
   * (item.options.length) — BUKAN di-hard-code dan BUKAN dipaksa
   * sama dengan preferensi saat ini. Server sudah memvalidasi
   * options.length === optionCount yang diminta, sehingga di sini
   * cukup dipastikan strukturnya masuk akal (2–26 opsi).
   *
   * Layout soal & layout jawaban mengambil nilai dari `aiState`
   * (aiGenerationSettings) — konfigurasi AI SENDIRI, TERPISAH dari
   * `formPrefs` (layout Pilihan Ganda utama). Mengubah layout di
   * form Pilihan Ganda utama TIDAK memengaruhi soal hasil AI, dan
   * sebaliknya.
   *
   * CATATAN PERBAIKAN: sebelumnya opsi yang benar dipindah paksa ke
   * posisi pertama dan correctAnswer dari server DIBUANG (tidak
   * pernah disimpan ke struktur soal). Akibatnya kunci jawaban tidak
   * pernah benar-benar akurat — hanya konvensi "selalu opsi A" yang
   * tidak terlihat oleh pengguna. Sekarang urutan opsi dari AI
   * dipertahankan apa adanya, dan indeks jawaban benar disimpan ke
   * field `correctIndex` agar bisa dipakai oleh fitur kunci jawaban.
   */
  function mapAiToApp(item) {
    if (!item || typeof item.question !== 'string') return null;
    var question = item.question.trim();
    if (!question) return null;

    if (item.type === 'multiple_choice' && Array.isArray(item.options)) {
      var optionCount = item.options.length;
      if (optionCount < 2 || optionCount > 26) return null;
      var correctIdx = Number(item.correctAnswer);
      if (!Number.isInteger(correctIdx) || correctIdx < 0 || correctIdx >= optionCount) return null;

      var labels = item.options.map(function (_, i) {
        return (typeof labelFor === 'function') ? labelFor(i) : String.fromCharCode(65 + i);
      });
      var texts = item.options.map(function (o) { return String(o || '').trim(); });
      if (texts.some(function (x) { return !x; })) return null;

      // Urutan opsi TIDAK diubah — correctIndex menunjuk posisi asli dari AI.
      var options = texts.map(function (text, i) { return { label: labels[i], text: text }; });

      return {
        id: (typeof uid === 'function') ? uid() : (Date.now() + '-' + Math.random().toString(36).slice(2, 8)),
        type: 'multiple-choice',
        question: question,
        image: null,
        imageSize: (typeof formPrefs !== 'undefined' && formPrefs.mcImageSize) ? formPrefs.mcImageSize : 'medium',
        imgW: null,
        imgH: null,
        options: options,
        correctIndex: correctIdx,
        layout: aiState.answerLayout || '1-column',
        questionLayout: aiState.questionLayout || '1-column',
        forceNewPage: false
      };
    }

    if (item.type === 'essay') {
      return {
        id: (typeof uid === 'function') ? uid() : (Date.now() + '-' + Math.random().toString(36).slice(2, 8)),
        type: 'essay',
        question: question,
        answerKey: (typeof item.answerKey === 'string') ? item.answerKey.trim() : '',
        forceNewPage: false
      };
    }

    return null;
  }

  /* ── Submit: panggil /api/generate-soal, validasi, masukkan ke questions ── */
  function submitAiGenerate() {
    if (aiState.busy) return;

    var now = Date.now();
    if (now - aiState.lastRequestAt < AI_COOLDOWN_MS) {
      if (typeof showToast === 'function') showToast(ttErr('ai.errRateLimit'), 'warning');
      return;
    }

    if (!validateAiForm()) return;

    var mcCount = aiState.mcEnabled ? Math.max(AI_MIN_COUNT, Math.min(AI_MAX_MC, parseInt($('aiMcCount').value, 10) || AI_MIN_COUNT)) : 0;
    var essayCount = aiState.essayEnabled ? Math.max(AI_MIN_COUNT, Math.min(AI_MAX_ESSAY, parseInt($('aiEssayCount').value, 10) || AI_MIN_COUNT)) : 0;
    aiState.mcCount = mcCount || aiState.mcCount;
    aiState.essayCount = essayCount || aiState.essayCount;
    aiState.materi = $('aiMateriInput').value.trim().slice(0, AI_MATERI_MAX);
    aiState.kelas = $('aiKelasSelect').value;

    /*
     * Kumpulkan pertanyaan yang sudah ada di lembar soal sebagai
     * konteks EXCLUDE_QUESTIONS — server akan menginstruksikan
     * AI untuk tidak mengulangnya (mencegah duplikat saat
     * generate ulang). Dibatasi 30 terakhir agar prompt tidak
     * membesar.
     */
    var excludeQuestions = [];
    if (typeof questions !== 'undefined' && Array.isArray(questions)) {
      excludeQuestions = questions
        .map(function (q) { return (q && q.question) ? String(q.question).trim() : ''; })
        .filter(Boolean)
        .slice(-30);
    }

    var payload = {
      jenjang: aiState.jenjang,
      kelas: parseInt(aiState.kelas, 10),
      materi: aiState.materi,
      difficulty: aiState.difficulty || 'sedang',
      mcCount: mcCount,
      essayCount: essayCount,
      optionCount: aiState.mcOptionCount,
      excludeQuestions: excludeQuestions
    };

    setBusy(true);
    aiState.lastRequestAt = now;

    fetch('/api/generate-soal', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    })
      .then(function (res) {
        return res.json().catch(function () { return {}; }).then(function (data) {
          if (!res.ok) {
            var code = (data && data.error) ? data.error : 'GENERATION_FAILED';
            throw new Error(code);
          }
          return data;
        });
      })
      .then(function (data) {
        if (!data || !Array.isArray(data.questions) || data.questions.length === 0) {
          throw new Error('INVALID_RESPONSE');
        }
        var mapped = data.questions.map(mapAiToApp).filter(Boolean);
        if (!mapped.length) throw new Error('INVALID_RESPONSE');

        // Masukkan ke sistem Daftar Soal yang sudah ada — biarkan aplikasi
        // yang mengatur nomor, preview, pagination, export, dan penyimpanan.
        questions.push.apply(questions, mapped);
        if (typeof saveToStorage === 'function') saveToStorage();
        if (typeof renderAll === 'function') renderAll();

        var n = mapped.length;
        if (typeof showToast === 'function') {
          // Jika server melaporkan kekurangan (mis. sebagian soal duplikat
          // dan top-up habis), tampilkan info parsial, bukan error.
          var short = (data && data.shortfall) ? ((data.shortfall.mc || 0) + (data.shortfall.essay || 0)) : 0;
          var msg;
          if (short > 0) {
            msg = (typeof tf === 'function') ? tf('ai.successPartial', { n: n, m: short }) : (n + ' soal berhasil dibuat (' + short + ' duplikat/tidak valid dilewati).');
            showToast(msg, 'warning');
          } else {
            msg = (typeof tf === 'function') ? tf('ai.success', { n: n }) : (n + ' soal berhasil dibuat dengan AI.');
            showToast(msg, 'success');
          }
        }
        setBusy(false);
        closeAiModal(true);
        // Tutup modal setelah berhasil
        var overlay = $('aiModalOverlay');
        if (overlay) overlay.classList.remove('show');
      })
      .catch(function (err) {
        setBusy(false);
        var code = (err && err.message) ? err.message : 'GENERATION_FAILED';
        if (typeof showToast === 'function') showToast(aiErrorMsg(code), 'error');
      });
  }

  /* ── Init: inject tombol & styles setelah DOM siap ── */
  function init() {
    injectAiStyles();
    injectAiButton();
    buildAiModal();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  // Expose untuk debugging/integrasi lanjutan
  window.AIGenerate = { open: openAiModal };
})();
