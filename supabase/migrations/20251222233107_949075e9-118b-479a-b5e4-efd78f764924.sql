-- Add validation to handle_new_user function to prevent potential security issues
-- SECURITY: This function uses SECURITY DEFINER (required for triggers) but now includes validation
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  -- SECURITY VALIDATION: Verify we have valid user data from auth trigger
  -- This prevents potential exploitation if function is modified in future
  IF NEW.id IS NULL THEN
    RAISE EXCEPTION 'Invalid user data: missing user ID';
  END IF;
  
  IF NEW.email IS NULL THEN
    RAISE EXCEPTION 'Invalid user data: missing email';
  END IF;

  INSERT INTO public.profiles (user_id, email, full_name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data ->> 'full_name', NEW.raw_user_meta_data ->> 'name', '')
  );
  RETURN NEW;
END;
$$;

-- Add comment documenting security implications
COMMENT ON FUNCTION public.handle_new_user() IS 
'SECURITY NOTE: This function uses SECURITY DEFINER to bypass RLS (required for auth triggers). 
Any modifications to this function must be carefully audited as it executes with elevated privileges.
Validation checks are in place to ensure only valid auth.users data is processed.';