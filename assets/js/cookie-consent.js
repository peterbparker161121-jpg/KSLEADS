// ==============================================================================
// KS LEADS — LGPD COOKIE CONSENT BANNER & PREFERENCES
// ==============================================================================

(function() {
  const CONSENT_KEY = 'ks_leads_cookie_consent';

  function getStoredConsent() {
    try {
      const data = localStorage.getItem(CONSENT_KEY);
      return data ? JSON.parse(data) : null;
    } catch (e) {
      return null;
    }
  }

  function saveConsent(preferences) {
    const record = {
      necessary: true,
      analytics: Boolean(preferences.analytics),
      marketing: Boolean(preferences.marketing),
      timestamp: new Date().toISOString()
    };
    try {
      localStorage.setItem(CONSENT_KEY, JSON.stringify(record));
    } catch (e) {}

    // Remove banner e modal
    const banner = document.getElementById('cookie-consent-banner');
    if (banner) banner.remove();
    const modal = document.getElementById('cookie-preferences-modal');
    if (modal) modal.remove();
  }

  function renderBanner() {
    if (getStoredConsent()) return; // Já consentiu anteriormente

    const banner = document.createElement('div');
    banner.id = 'cookie-consent-banner';
    banner.style.cssText = `
      position: fixed;
      bottom: 20px;
      left: 20px;
      right: 20px;
      max-width: 600px;
      background: #0f172a;
      border: 1px solid rgba(255, 255, 255, 0.15);
      border-radius: 12px;
      padding: 1.25rem;
      box-shadow: 0 10px 30px rgba(0, 0, 0, 0.6);
      z-index: 9999;
      display: flex;
      flex-direction: column;
      gap: 1rem;
      color: #f8fafc;
      font-family: inherit;
    `;

    banner.innerHTML = `
      <div>
        <p style="font-size: 0.9rem; line-height: 1.4; color: #cbd5e1; margin-bottom: 0.4rem;">
          <strong>Privacidade e Cookies (LGPD):</strong> Utilizamos cookies essenciais para o funcionamento do sistema e tecnologias analíticas para aprimorar sua experiência. Você pode gerenciar suas preferências a qualquer momento.
        </p>
        <a href="/privacidade.html" style="font-size: 0.8rem; color: #38bdf8; text-decoration: underline;">Saiba mais na nossa Política de Privacidade</a>
      </div>
      <div style="display: flex; gap: 0.5rem; flex-wrap: wrap; justify-content: flex-end;">
        <button id="btn-cookie-prefs" class="btn btn-outline btn-sm">Preferências</button>
        <button id="btn-cookie-reject" class="btn btn-secondary btn-sm">Apenas Essenciais</button>
        <button id="btn-cookie-accept" class="btn btn-primary btn-sm">Aceitar Todos</button>
      </div>
    `;

    document.body.appendChild(banner);

    document.getElementById('btn-cookie-accept').addEventListener('click', () => {
      saveConsent({ analytics: true, marketing: true });
    });

    document.getElementById('btn-cookie-reject').addEventListener('click', () => {
      saveConsent({ analytics: false, marketing: false });
    });

    document.getElementById('btn-cookie-prefs').addEventListener('click', () => {
      openPreferencesModal();
    });
  }

  function openPreferencesModal() {
    const current = getStoredConsent() || { analytics: false, marketing: false };

    let modal = document.getElementById('cookie-preferences-modal');
    if (modal) modal.remove();

    modal = document.createElement('div');
    modal.id = 'cookie-preferences-modal';
    modal.className = 'modal-overlay active';
    modal.innerHTML = `
      <div class="modal-card" style="max-width: 500px;">
        <div class="modal-header">
          <h3>Preferências de Cookies</h3>
          <button class="modal-close" id="btn-close-cookie-modal">&times;</button>
        </div>
        <p style="font-size: 0.875rem; color: var(--text-secondary); margin-bottom: 1.25rem;">
          Selecione as categorias de cookies que você autoriza o KS Leads a utilizar em conformidade com a LGPD.
        </p>
        
        <div style="display: flex; flex-direction: column; gap: 1rem; margin-bottom: 1.5rem;">
          <div style="padding: 0.75rem; background: var(--bg-elevated); border-radius: var(--radius-md);">
            <div style="display: flex; justify-content: space-between; align-items: center;">
              <strong>Necessários (Essenciais)</strong>
              <input type="checkbox" checked disabled>
            </div>
            <p style="font-size: 0.8rem; color: var(--text-muted); margin-top: 0.25rem;">
              Imprescindíveis para login seguro, validação de sessão e navegação no aplicativo.
            </p>
          </div>

          <div style="padding: 0.75rem; background: var(--bg-elevated); border-radius: var(--radius-md);">
            <div style="display: flex; justify-content: space-between; align-items: center;">
              <strong>Analíticos e Desempenho</strong>
              <input type="checkbox" id="chk-cookie-analytics" ${current.analytics ? 'checked' : ''}>
            </div>
            <p style="font-size: 0.8rem; color: var(--text-muted); margin-top: 0.25rem;">
              Ajudam a entender quais recursos são mais úteis para continuarmos melhorando a plataforma.
            </p>
          </div>

          <div style="padding: 0.75rem; background: var(--bg-elevated); border-radius: var(--radius-md);">
            <div style="display: flex; justify-content: space-between; align-items: center;">
              <strong>Marketing e Comunicação</strong>
              <input type="checkbox" id="chk-cookie-marketing" ${current.marketing ? 'checked' : ''}>
            </div>
            <p style="font-size: 0.8rem; color: var(--text-muted); margin-top: 0.25rem;">
              Permitem sugerir ofertas de planos e novidades adequadas ao seu perfil de negócio.
            </p>
          </div>
        </div>

        <div style="display: flex; justify-content: flex-end; gap: 0.75rem;">
          <button class="btn btn-secondary btn-sm" id="btn-save-cookie-prefs">Salvar Preferências</button>
        </div>
      </div>
    `;

    document.body.appendChild(modal);

    document.getElementById('btn-close-cookie-modal').addEventListener('click', () => modal.remove());
    document.getElementById('btn-save-cookie-prefs').addEventListener('click', () => {
      const analytics = document.getElementById('chk-cookie-analytics').checked;
      const marketing = document.getElementById('chk-cookie-marketing').checked;
      saveConsent({ analytics, marketing });
    });
  }

  window.openCookiePreferences = openPreferencesModal;

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', renderBanner);
  } else {
    renderBanner();
  }
})();
