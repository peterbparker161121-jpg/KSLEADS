// ==============================================================================
// KS LEADS — CAKTO PAYMENT WEBHOOK HANDLER (VERCEL SERVERLESS)
// ==============================================================================
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método não permitido. Use POST.' });
  }

  if (!supabaseUrl || !supabaseServiceKey) {
    console.error('Erro de configuração: Variáveis do Supabase não encontradas no servidor.');
    return res.status(500).json({ error: 'Configuração do servidor incompleta.' });
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: { autoRefreshToken: false, persistSession: false }
  });

  try {
    const payload = req.body;
    if (!payload || typeof payload !== 'object') {
      return res.status(400).json({ error: 'Payload de webhook inválido.' });
    }

    // Identificação do evento Cakto
    // A Cakto envia eventos como 'payment.approved', 'order.paid', 'subscription.renewed', 'chargeback', etc.
    const eventId = payload.id || payload.event_id || payload.transaction_id || `evt_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const eventType = payload.event || payload.type || payload.status || 'unknown';
    const customerData = payload.customer || payload.data?.customer || {};
    const customerEmail = (customerData.email || payload.email || '').trim().toLowerCase();
    const offerId = payload.offer_id || payload.product_id || payload.data?.offer_id;
    const orderId = payload.order_id || payload.transaction_id || payload.data?.id;

    // 1. Verificar idempotência na tabela payment_events
    const { data: existingEvent } = await supabase
      .from('payment_events')
      .select('id, status')
      .eq('event_id', String(eventId))
      .maybeSingle();

    if (existingEvent) {
      console.log(`[Cakto Webhook] Evento ${eventId} já processado anteriormente.`);
      return res.status(200).json({ message: 'Evento já processado anteriormente.', event_id: eventId });
    }

    // 2. Registrar evento como recebido
    const { data: eventRecord, error: eventInsertErr } = await supabase
      .from('payment_events')
      .insert({
        event_id: String(eventId),
        event_type: eventType,
        payload: payload,
        order_id: String(orderId || ''),
        status: 'pending'
      })
      .select()
      .single();

    if (eventInsertErr) {
      console.error('[Cakto Webhook] Erro ao registrar evento:', eventInsertErr);
    }

    // Se não tiver e-mail do cliente, não há como associar à conta
    if (!customerEmail) {
      console.warn('[Cakto Webhook] Payload sem e-mail do comprador.');
      return res.status(200).json({ message: 'Webhook recebido, porém sem e-mail do comprador para associação.' });
    }

    // 3. Localizar usuário no Supabase
    const { data: profile, error: profileErr } = await supabase
      .from('profiles')
      .select('id, email, role, status, credit_balance, current_plan_id')
      .eq('email', customerEmail)
      .maybeSingle();

    if (!profile) {
      console.warn(`[Cakto Webhook] Usuário com e-mail ${customerEmail} ainda não possui conta criada.`);
      // Atualiza evento como pendente de vínculo
      await supabase
        .from('payment_events')
        .update({ status: 'pending' })
        .eq('event_id', String(eventId));

      return res.status(200).json({ 
        message: 'Pagamento recebido. Conta ainda não cadastrada; será vinculada quando o cliente criar conta.',
        email: customerEmail 
      });
    }

    // 4. Identificar o plano comprado
    let plan = null;
    if (offerId) {
      const { data: foundPlan } = await supabase
        .from('plans')
        .select('*')
        .or(`cakto_offer_id.eq.${offerId},slug.eq.${offerId}`)
        .maybeSingle();
      plan = foundPlan;
    }

    // Se não identificou por offerId, busca pelo valor ou plano padrão Pro
    if (!plan) {
      const { data: defaultPlan } = await supabase
        .from('plans')
        .select('*')
        .eq('is_active', true)
        .order('display_order', { ascending: true })
        .limit(1)
        .maybeSingle();
      plan = defaultPlan;
    }

    // 5. Normalizar status de pagamento
    const isPaid = ['paid', 'approved', 'payment.approved', 'order.paid', 'subscription.renewed', 'completed'].includes(eventType.toLowerCase()) || payload.status === 'paid' || payload.status === 'approved';
    const isFailedOrCanceled = ['failed', 'canceled', 'refunded', 'chargeback', 'expired', 'subscription.canceled'].includes(eventType.toLowerCase()) || payload.status === 'canceled' || payload.status === 'refunded';

    if (isPaid) {
      const creditsToAdd = plan ? plan.credits_included : 200;

      // Chama a função atômica add_user_credits
      const { error: creditRpcErr } = await supabase.rpc('add_user_credits', {
        p_user_id: profile.id,
        p_amount: creditsToAdd,
        p_operation: 'subscription_credit',
        p_description: `Ativação de plano Cakto: ${plan ? plan.name : 'KS Leads'} (+${creditsToAdd} créditos)`,
        p_reference_id: String(orderId || eventId)
      });

      if (creditRpcErr) {
        console.error('[Cakto Webhook] Erro ao adicionar créditos via RPC:', creditRpcErr);
      }

      // Atualiza o perfil para ativo e plano atual
      const nextMonth = new Date();
      nextMonth.setMonth(nextMonth.getMonth() + 1);

      await supabase
        .from('profiles')
        .update({
          status: 'active',
          subscription_status: 'active',
          current_plan_id: plan ? plan.id : profile.current_plan_id,
          subscription_end_date: nextMonth.toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('id', profile.id);

      // Registra/atualiza registro em subscriptions
      if (plan) {
        await supabase
          .from('subscriptions')
          .insert({
            user_id: profile.id,
            plan_id: plan.id,
            status: 'active',
            cakto_order_id: String(orderId || ''),
            current_period_start: new Date().toISOString(),
            current_period_end: nextMonth.toISOString()
          });
      }

      // Marca payment_event como concluído
      await supabase
        .from('payment_events')
        .update({
          status: 'paid',
          user_id: profile.id
        })
        .eq('event_id', String(eventId));

      console.log(`[Cakto Webhook] Sucesso! Plano ${plan?.name} ativado para ${customerEmail}.`);
      return res.status(200).json({ success: true, message: 'Assinatura e créditos ativados com sucesso.' });
    }

    if (isFailedOrCanceled) {
      await supabase
        .from('profiles')
        .update({
          subscription_status: eventType.includes('refund') ? 'expired' : 'canceled',
          updated_at: new Date().toISOString()
        })
        .eq('id', profile.id);

      await supabase
        .from('payment_events')
        .update({
          status: eventType.includes('refund') ? 'refunded' : 'canceled',
          user_id: profile.id
        })
        .eq('event_id', String(eventId));

      console.log(`[Cakto Webhook] Assinatura cancelada/expirada para ${customerEmail}.`);
      return res.status(200).json({ success: true, message: 'Status de assinatura atualizado para inativo.' });
    }

    return res.status(200).json({ message: 'Evento recebido e registrado sem alteração de estado.' });
  } catch (err) {
    console.error('[Cakto Webhook] Exceção não tratada:', err);
    return res.status(500).json({ error: 'Erro interno ao processar webhook.' });
  }
}
