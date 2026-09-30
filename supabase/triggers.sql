-- ==============================================================================
-- KS LEADS — TRIGGERS E FUNÇÕES AUXILIARES DE CRÉDITO E PERFIL
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. TRIGGER PARA CRIAÇÃO AUTOMÁTICA DE PERFIL AO REGISTRAR NO AUTH.USERS
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_admin_email TEXT := 'peter@ksleads.com.br'; -- Ou configurável
    v_is_admin BOOLEAN;
    v_starter_credits INTEGER := 10;
BEGIN
    v_is_admin := (NEW.email = v_admin_email OR NEW.raw_user_meta_data->>'role' = 'admin');

    INSERT INTO public.profiles (
        id,
        email,
        full_name,
        role,
        status,
        credit_balance,
        subscription_status
    ) VALUES (
        NEW.id,
        NEW.email,
        COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
        CASE WHEN v_is_admin THEN 'admin'::user_role ELSE 'customer'::user_role END,
        'active'::account_status,
        CASE WHEN v_is_admin THEN 999999 ELSE v_starter_credits END,
        CASE WHEN v_is_admin THEN 'active'::subscription_status ELSE 'trial'::subscription_status END
    );

    -- Registra transação de créditos de boas-vindas
    IF NOT v_is_admin THEN
        INSERT INTO public.credit_transactions (
            user_id,
            amount,
            balance_after,
            operation_type,
            description
        ) VALUES (
            NEW.id,
            v_starter_credits,
            v_starter_credits,
            'subscription_credit',
            'Créditos cortesia de boas-vindas (Período de Testes)'
        );
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ------------------------------------------------------------------------------
-- 2. FUNÇÃO ATÔMICA: DEDUZIR CRÉDITOS
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.deduct_user_credits(
    p_user_id UUID,
    p_amount INTEGER,
    p_operation credit_operation,
    p_description TEXT,
    p_reference_id TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_profile RECORD;
    v_new_balance INTEGER;
BEGIN
    -- Busca perfil com lock para evitar race condition
    SELECT id, role, credit_balance, status INTO v_profile
    FROM public.profiles
    WHERE id = p_user_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Perfil de usuário não encontrado.');
    END IF;

    IF v_profile.status = 'suspended' OR v_profile.status = 'blocked' THEN
        RETURN jsonb_build_object('success', false, 'error', 'Conta suspensa ou com pendências.');
    END IF;

    -- Se for admin, uso é ilimitado
    IF v_profile.role = 'admin' THEN
        RETURN jsonb_build_object('success', true, 'balance', v_profile.credit_balance, 'is_admin', true);
    END IF;

    -- Checa saldo
    IF v_profile.credit_balance < p_amount THEN
        RETURN jsonb_build_object('success', false, 'error', 'Saldo de créditos insuficiente. Faça recarga ou upgrade de plano.');
    END IF;

    v_new_balance := v_profile.credit_balance - p_amount;

    -- Atualiza saldo
    UPDATE public.profiles
    SET credit_balance = v_new_balance,
        updated_at = NOW()
    WHERE id = p_user_id;

    -- Grava extrato no ledger
    INSERT INTO public.credit_transactions (
        user_id,
        amount,
        balance_after,
        operation_type,
        description,
        reference_id
    ) VALUES (
        p_user_id,
        -p_amount,
        v_new_balance,
        p_operation,
        p_description,
        p_reference_id
    );

    RETURN jsonb_build_object('success', true, 'balance', v_new_balance, 'deducted', p_amount);
END;
$$;

-- ------------------------------------------------------------------------------
-- 3. FUNÇÃO ATÔMICA: ADICIONAR CRÉDITOS
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.add_user_credits(
    p_user_id UUID,
    p_amount INTEGER,
    p_operation credit_operation,
    p_description TEXT,
    p_reference_id TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_profile RECORD;
    v_new_balance INTEGER;
BEGIN
    SELECT id, credit_balance INTO v_profile
    FROM public.profiles
    WHERE id = p_user_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Perfil de usuário não encontrado.');
    END IF;

    v_new_balance := v_profile.credit_balance + p_amount;

    UPDATE public.profiles
    SET credit_balance = v_new_balance,
        updated_at = NOW()
    WHERE id = p_user_id;

    INSERT INTO public.credit_transactions (
        user_id,
        amount,
        balance_after,
        operation_type,
        description,
        reference_id
    ) VALUES (
        p_user_id,
        p_amount,
        v_new_balance,
        p_operation,
        p_description,
        p_reference_id
    );

    RETURN jsonb_build_object('success', true, 'balance', v_new_balance, 'added', p_amount);
END;
$$;
