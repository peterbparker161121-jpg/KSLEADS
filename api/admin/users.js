// ==============================================================================
// KS LEADS — ADMIN PRIVILEGED MANAGEMENT API (VERCEL SERVERLESS)
// ==============================================================================
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método não permitido. Use POST.' });
  }

  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Acesso não autorizado.' });
  }
  const token = authHeader.replace('Bearer ', '');

  if (!supabaseUrl || !supabaseServiceKey) {
    return res.status(500).json({ error: 'Configuração do servidor Supabase incompleta.' });
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: { autoRefreshToken: false, persistSession: false }
  });

  try {
    // 1. Validar autenticação do administrador
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    if (userError || !user) {
      return res.status(401).json({ error: 'Sessão inválida ou expirada.' });
    }

    const { data: adminProfile } = await supabase
      .from('profiles')
      .select('id, role')
      .eq('id', user.id)
      .single();

    if (!adminProfile || adminProfile.role !== 'admin') {
      return res.status(403).json({ error: 'Acesso negado. Apenas administradores podem executar esta ação.' });
    }

    const { action, target_user_id, amount, plan_id, reason } = req.body || {};

    // 2. Executar ações administrativas
    switch (action) {
      case 'add_credits': {
        if (!target_user_id || !amount || amount <= 0) {
          return res.status(400).json({ error: 'Informe o ID do usuário e quantidade positiva de créditos.' });
        }
        const { data, error } = await supabase.rpc('add_user_credits', {
          p_user_id: target_user_id,
          p_amount: parseInt(amount, 10),
          p_operation: 'manual_adjustment',
          p_description: `Ajuste manual pelo administrador: ${reason || 'Créditos adicionados'}`,
          p_reference_id: `admin_${user.id}`
        });
        if (error) throw error;

        // Log de auditoria
        await supabase.from('audit_logs').insert({
          user_id: user.id,
          action: 'admin_add_credits',
          target_type: 'profile',
          target_id: target_user_id,
          details: { amount, reason }
        });

        return res.status(200).json({ success: true, message: 'Créditos adicionados com sucesso.', result: data });
      }

      case 'remove_credits': {
        if (!target_user_id || !amount || amount <= 0) {
          return res.status(400).json({ error: 'Informe o ID do usuário e quantidade de créditos.' });
        }
        const { data, error } = await supabase.rpc('deduct_user_credits', {
          p_user_id: target_user_id,
          p_amount: parseInt(amount, 10),
          p_operation: 'manual_adjustment',
          p_description: `Remoção manual pelo administrador: ${reason || 'Créditos removidos'}`,
          p_reference_id: `admin_${user.id}`
        });
        if (error) throw error;

        await supabase.from('audit_logs').insert({
          user_id: user.id,
          action: 'admin_remove_credits',
          target_type: 'profile',
          target_id: target_user_id,
          details: { amount, reason }
        });

        return res.status(200).json({ success: true, message: 'Créditos removidos com sucesso.', result: data });
      }

      case 'change_plan': {
        if (!target_user_id || !plan_id) {
          return res.status(400).json({ error: 'Informe o usuário e o novo plano.' });
        }
        const { error } = await supabase
          .from('profiles')
          .update({ current_plan_id: plan_id, updated_at: new Date().toISOString() })
          .eq('id', target_user_id);
        if (error) throw error;

        await supabase.from('audit_logs').insert({
          user_id: user.id,
          action: 'admin_change_plan',
          target_type: 'profile',
          target_id: target_user_id,
          details: { plan_id, reason }
        });

        return res.status(200).json({ success: true, message: 'Plano do usuário atualizado.' });
      }

      case 'suspend_user': {
        if (!target_user_id) return res.status(400).json({ error: 'Informe o usuário.' });
        const { error } = await supabase
          .from('profiles')
          .update({ status: 'suspended', updated_at: new Date().toISOString() })
          .eq('id', target_user_id);
        if (error) throw error;

        await supabase.from('audit_logs').insert({
          user_id: user.id,
          action: 'admin_suspend_user',
          target_type: 'profile',
          target_id: target_user_id,
          details: { reason }
        });

        return res.status(200).json({ success: true, message: 'Conta do usuário suspensa.' });
      }

      case 'reactivate_user': {
        if (!target_user_id) return res.status(400).json({ error: 'Informe o usuário.' });
        const { error } = await supabase
          .from('profiles')
          .update({ status: 'active', updated_at: new Date().toISOString() })
          .eq('id', target_user_id);
        if (error) throw error;

        await supabase.from('audit_logs').insert({
          user_id: user.id,
          action: 'admin_reactivate_user',
          target_type: 'profile',
          target_id: target_user_id,
          details: { reason }
        });

        return res.status(200).json({ success: true, message: 'Conta do usuário reativada.' });
      }

      default:
        return res.status(400).json({ error: `Ação '${action}' não reconhecida.` });
    }

  } catch (err) {
    console.error('[Admin API] Erro ao executar ação:', err);
    return res.status(500).json({ error: 'Erro interno ao processar operação administrativa.' });
  }
}
