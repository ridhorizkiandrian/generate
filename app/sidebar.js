(function(){
  var mount = document.getElementById('sidebarMount');

  if (!mount) return;

  mount.innerHTML = `
    <aside class="sidebar" id="sidebar">

      <!-- BRAND -->
      <a class="sidebar-brand" href="/" title="Kembali ke halaman utama" style="text-decoration:none;color:inherit;">
        <div class="brand-icon">
          <img 
            src="images/side.png" 
            alt="Logo" 
            onerror="if(window.handleLogoImgError)handleLogoImgError(this)"
          >
        </div>

        <div class="brand-name">
          Generate Soal Ujian
        </div>
      </a>


      <!-- NAVIGATION -->
      <nav class="sidebar-nav">

        <!-- MENU -->
        <div class="nav-label" data-i18n="nav.menu">
          Menu
        </div>

        <button 
          class="nav-item active" 
          data-nav="home" 
          title="Beranda" 
          data-i18n-title="nav.home"
        >
          <i class="fa-solid fa-house"></i>

          <span 
            class="nav-text" 
            data-i18n="nav.home"
          >
            Beranda
          </span>
        </button>


        <!-- BANK SOAL -->
        <!--
          Catatan: menu "Semua Soal", "Pilihan Ganda", dan "Essay" sengaja
          dihilangkan dari sidebar (semua jenis soal sudah bisa diakses lewat
          menu Beranda). Fungsinya (nav "all"/"mc"/"essay" di setNav) TIDAK
          dihapus dari kode, hanya tidak ada lagi tombolnya di sini.
        -->
        <div 
          class="nav-label" 
          data-i18n="nav.bank"
        >
          Bank Soal
        </div>


        <button 
          class="nav-item" 
          data-nav="bank" 
          title="Bank Soal" 
          data-i18n-title="nav.bank"
        >
          <i class="fa-solid fa-folder-open"></i>

          <span 
            class="nav-text" 
            data-i18n="nav.bank"
          >
            Bank Soal
          </span>

          <span 
            class="count" 
            id="navCountFiles"
          >
            0
          </span>
        </button>


        <button 
          class="nav-item" 
          data-nav="downloads" 
          title="Download Center" 
          data-i18n-title="nav.downloads"
        >
          <i class="fa-solid fa-download"></i>

          <span 
            class="nav-text" 
            data-i18n="nav.downloads"
          >
            Download Center
          </span>
        </button>


        <!-- LAINNYA -->
        <div 
          class="nav-label" 
          data-i18n="nav.others"
        >
          Lainnya
        </div>


        <button 
          class="nav-item" 
          data-nav="settings" 
          title="Pengaturan" 
          data-i18n-title="nav.settings"
        >
          <i class="fa-solid fa-gear"></i>

          <span 
            class="nav-text" 
            data-i18n="nav.settings"
          >
            Pengaturan
          </span>
        </button>


        <!-- TEMA -->
        <button 
          class="nav-item" 
          data-nav="theme" 
          title="Tema Tampilan" 
          data-i18n-title="nav.theme"
        >
          <i class="fa-solid fa-palette"></i>

          <span 
            class="nav-text" 
            data-i18n="nav.theme"
          >
            Tema
          </span>
        </button>

      </nav>


      <!-- SIDEBAR FOOTER -->
      <div class="sidebar-footer">


        <!-- LANGUAGE -->
        <div 
          class="sidebar-lang" 
          id="sidebarLangBlock"
        >

          <div 
            class="sidebar-lang-options" 
            role="group" 
            aria-label="Language switcher"
          >


            <!-- INDONESIA -->
            <button 
              class="sidebar-lang-btn" 
              type="button" 
              data-lang="id" 
              title="Indonesia" 
              aria-label="Indonesia"
            >

              <img
                src="images/bendera/indonesia.png"
                alt="Bendera Indonesia"
                class="sidebar-lang-flag"
              >

              <span class="sidebar-lang-text">
                id
              </span>

            </button>


            <!-- ENGLISH -->
            <button 
              class="sidebar-lang-btn" 
              type="button" 
              data-lang="en" 
              title="English" 
              aria-label="English"
            >

              <img
                src="images/bendera/english.png"
                alt="United Kingdom Flag"
                class="sidebar-lang-flag"
              >

              <span class="sidebar-lang-text">
                en
              </span>

            </button>


          </div>

        </div>


        <!-- PRIVACY -->
        <button 
          class="nav-item" 
          data-nav="privacy" 
          title="Privasi" 
          data-i18n-title="nav.privacy"
        >
          <i class="fa-solid fa-shield-halved"></i>

          <span 
            class="nav-text" 
            data-i18n="nav.privacy"
          >
            Privasi
          </span>
        </button>


        <!-- CONTACT -->
        <button 
          class="nav-item" 
          id="btnContact" 
          title="Kontak" 
          data-i18n-title="nav.contact"
        >
          <i class="fa-regular fa-envelope"></i>

          <span 
            class="nav-text" 
            data-i18n="nav.contact"
          >
            Kontak
          </span>
        </button>


        <!-- HELP -->
        <button 
          class="nav-item" 
          id="btnHelp" 
          title="Bantuan" 
          data-i18n-title="nav.help"
        >
          <i class="fa-regular fa-circle-question"></i>

          <span 
            class="nav-text" 
            data-i18n="nav.help"
          >
            Bantuan
          </span>
        </button>


        <!-- COLLAPSE -->
        <button 
          class="nav-item sidebar-collapse-btn" 
          id="btnCollapseSidebar" 
          title="Ciutkan sidebar" 
          data-i18n-title="nav.collapseTitle"
        >
          <i class="fa-solid fa-angles-left"></i>

          <span 
            class="nav-text" 
            data-i18n="nav.collapse"
          >
            Ciutkan
          </span>
        </button>


      </div>

    </aside>


    <!-- OVERLAY -->
    <div 
      class="sidebar-overlay" 
      id="sidebarOverlay"
    ></div>
  `;
})();