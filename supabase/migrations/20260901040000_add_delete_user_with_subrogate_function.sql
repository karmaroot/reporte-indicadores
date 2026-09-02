-- Stored procedure to safely reassign all user duties to a subrogate and delete the user
CREATE OR REPLACE FUNCTION public.delete_user_with_subrogate(
  p_target_user_id UUID,
  p_subrogate_user_id UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
BEGIN
  IF p_target_user_id IS NULL OR p_subrogate_user_id IS NULL THEN
    RAISE EXCEPTION 'Ambos IDs de usuario (objetivo y subrogante) son requeridos.';
  END IF;

  IF p_target_user_id = p_subrogate_user_id THEN
    RAISE EXCEPTION 'El usuario subrogante no puede ser el mismo usuario a eliminar.';
  END IF;

  -- 1. Transfer instrument indicator assignments (informant & reviewer)
  UPDATE public.instrument_indicators 
  SET informant_id = p_subrogate_user_id 
  WHERE informant_id = p_target_user_id;

  UPDATE public.instrument_indicators 
  SET reviewer_id = p_subrogate_user_id 
  WHERE reviewer_id = p_target_user_id;

  -- 2. Transfer direct indicator assignments
  UPDATE public.indicators 
  SET informant_id = p_subrogate_user_id 
  WHERE informant_id = p_target_user_id;

  UPDATE public.indicators 
  SET reviewer_id = p_subrogate_user_id 
  WHERE reviewer_id = p_target_user_id;

  -- 3. Transfer created indicator reports
  UPDATE public.indicator_reports 
  SET created_by = p_subrogate_user_id 
  WHERE created_by = p_target_user_id;

  -- 4. Transfer observations created by reviewer
  UPDATE public.observations 
  SET reviewer_id = p_subrogate_user_id 
  WHERE reviewer_id = p_target_user_id;

  -- 5. Transfer observation responses
  UPDATE public.observation_responses 
  SET user_id = p_subrogate_user_id 
  WHERE user_id = p_target_user_id;

  -- 6. Remove user institution links
  DELETE FROM public.user_institutions 
  WHERE user_id = p_target_user_id;

  -- 7. Remove user role entries
  DELETE FROM public.user_roles 
  WHERE user_id = p_target_user_id;

  -- 8. Delete user profile
  DELETE FROM public.profiles 
  WHERE id = p_target_user_id;

  RETURN TRUE;
END;
$function$;
