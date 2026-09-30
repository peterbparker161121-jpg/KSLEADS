// ==============================================================================
// KS LEADS — SUPABASE CLIENT & AUTH MANAGEMENT (FRONTEND)
// ==============================================================================
import { CONFIG } from './config.js';

let supabaseInstance = null;

export function getSupabase() {
  if (supabaseInstance) return supabaseInstance;

  if (typeof window.supabase !== 'undefined' && window.supabase.createClient) {
    supabaseInstance = window.supabase.createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_ANON_KEY);
    return supabaseInstance;
  }

  console.warn('[KS Leads] Biblioteca do Supabase CDN ainda carregando ou não detectada.');
  return null;
}

export const Auth = {
  // Login com e-mail e senha
  async signIn(email, password) {
    const sb = getSupabase();
    if (!sb) throw new Error('Cliente Supabase não inicializado.');

    const { data, error } = await sb.auth.signInWithPassword({
      email: email.trim(),
      password: password
    });

    if (error) {
      if (error.message.includes('Invalid login credentials')) {
        throw new Error('E-mail ou senha incorretos. Verifique suas credenciais.');
      }
      throw new Error(error.message);
    }

    return data;
  },

  // Cadastro de novo usuário
  async signUp(email, password, fullName, phone) {
    const sb = getSupabase();
    if (!sb) throw new Error('Cliente Supabase não inicializado.');

    const { data, error } = await sb.auth.signUp({
      email: email.trim(),
      password: password,
      options: {
        data: {
          full_name: fullName,
          phone: phone || ''
        }
      }
    });

    if (error) throw new Error(error.message);
    return data;
  },

  // Logout
  async signOut() {
    const sb = getSupabase();
    if (sb) {
      await sb.auth.signOut();
    }
    window.location.href = '/login.html';
  },

  // Recuperação de senha
  async resetPasswordForEmail(email) {
    const sb = getSupabase();
    if (!sb) throw new Error('Cliente Supabase não inicializado.');

    const { error } = await sb.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${window.location.origin}/redefinir-senha.html`
    });

    if (error) throw new Error(error.message);
  },

  // Atualizar nova senha
  async updatePassword(newPassword) {
    const sb = getSupabase();
    if (!sb) throw new Error('Cliente Supabase não inicializado.');

    const { error } = await sb.auth.updateUser({ password: newPassword });
    if (error) throw new Error(error.message);
  },

  // Obtém o usuário atual autenticado
  async getCurrentUser() {
    const sb = getSupabase();
    if (!sb) return null;
    const { data: { user } } = await sb.auth.getUser();
    return user;
  },

  // Obtém o perfil completo do usuário
  async getProfile() {
    const sb = getSupabase();
    if (!sb) return null;
    const user = await this.getCurrentUser();
    if (!user) return null;

    const { data: profile } = await sb
      .from('profiles')
      .select('*, plans(*)')
      .eq('id', user.id)
      .maybeSingle();

    return profile;
  },

  // Guarda de Rota para páginas restritas
  async requireAuth(options = { requireAdmin: false, checkSubscription: true }) {
    const sb = getSupabase();
    if (!sb) {
      // Se supabase falhar em carregar, aguarda evento de script
      return new Promise((resolve) => {
        setTimeout(async () => {
          resolve(await Auth.requireAuth(options));
        }, 500);
      });
    }

    const { data: { session } } = await sb.auth.getSession();
    if (!session || !session.user) {
      sessionStorage.setItem('redirect_after_login', window.location.pathname + window.location.search);
      window.location.href = '/login.html';
      return null;
    }

    const profile = await this.getProfile();
    if (!profile) {
      return { user: session.user, profile: null };
    }

    // Se requer admin e não for admin
    if (options.requireAdmin && profile.role !== 'admin') {
      window.location.href = '/app/';
      return null;
    }

    // Se a conta estiver bloqueada ou suspensa (e não for admin)
    if (profile.role !== 'admin') {
      if (profile.status === 'suspended' || profile.status === 'blocked') {
        if (!window.location.pathname.includes('/bloqueado.html')) {
          window.location.href = '/app/bloqueado.html';
          return null;
        }
      }
    }

    // Renderiza dados do usuário no header e sidebar se os elementos existirem
    this.populateUserSnippet(profile);

    return { user: session.user, profile, token: session.access_token };
  },

  populateUserSnippet(profile) {
    if (!profile) return;
    const nameEls = document.querySelectorAll('.user-name');
    const creditEls = document.querySelectorAll('.user-credits');
    const avatarEls = document.querySelectorAll('.user-avatar');

    const displayName = profile.full_name || profile.email.split('@')[0];
    const initial = displayName.charAt(0).toUpperCase();

    nameEls.forEach(el => el.textContent = displayName);
    avatarEls.forEach(el => el.textContent = initial);
    creditEls.forEach(el => {
      if (profile.role === 'admin') {
        el.innerHTML = '<strong>Administrador</strong> (Ilimitado)';
      } else {
        el.innerHTML = `<strong>${profile.credit_balance}</strong> créditos disponíveis`;
      }
    });
  }
};
