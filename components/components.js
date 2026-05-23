// ================================================
// ホリエモンAI学校 共通ヘッダー・フッター
// ナビのリンクを変えたいときはこのファイルだけ編集すればOK
// ================================================

class SiteHeader extends HTMLElement {
  connectedCallback() {
    this.innerHTML = `
      <header class="ai-header">
        <div class="ai-header-inner">
          <a href="/index.html" class="ai-logo">
            <img src="/assets/img/logo.png" alt="ホリエモンAI学校" class="ai-logo-img"
              onerror="this.style.display='none';this.nextElementSibling.style.display='inline'">
            <span class="ai-logo-text">ホリエモンAI学校</span>
          </a>
          <nav class="ai-nav" id="aiNav">
            <ul>
              <li><a href="/kiri/">AI切り抜き</a></li>
              <li><a href="/" class="ai-nav-cta">サービス一覧</a></li>
            </ul>
          </nav>
          <button class="ai-menu-btn" id="aiMenuBtn" aria-label="メニュー">
            <span></span><span></span><span></span>
          </button>
        </div>
      </header>
    `;

    const btn = this.querySelector('#aiMenuBtn');
    const nav = this.querySelector('#aiNav');
    btn.addEventListener('click', () => {
      nav.classList.toggle('open');
      btn.classList.toggle('active');
    });
  }
}

class SiteFooter extends HTMLElement {
  connectedCallback() {
    this.innerHTML = `
      <footer class="ai-footer">
        <div class="ai-footer-inner">
          <div class="ai-footer-top">
            <div class="ai-footer-brand">
              <a href="/index.html">
                <img src="/assets/img/logo.png" alt="ホリエモンAI学校" class="ai-logo-img"
                  onerror="this.style.display='none';this.nextElementSibling.style.display='inline'">
                <span class="ai-logo-text">ホリエモンAI学校</span>
              </a>
              <p class="ai-footer-tagline">AIで、ビジネスの未来を切り開く</p>
            </div>
            <nav class="ai-footer-nav">
              <ul>
                <li><a href="/kiri/">AI切り抜き</a></li>
                <li><a href="/">サービス一覧</a></li>
                <li><a href="/privacy.html">プライバシーポリシー</a></li>
                <li><a href="/terms.html">利用規約</a></li>
              </ul>
            </nav>
          </div>
          <div class="ai-footer-bottom">
            <p>© 2026 ホリエモンAI学校株式会社. All rights reserved.</p>
          </div>
        </div>
      </footer>
    `;
  }
}

customElements.define('site-header', SiteHeader);
customElements.define('site-footer', SiteFooter);
