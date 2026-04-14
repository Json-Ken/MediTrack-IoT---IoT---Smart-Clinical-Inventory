
-- Allow users to insert their own role (fallback for client-side insert)
CREATE POLICY "Users can insert their own role"
ON public.user_roles
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

-- Create trigger to auto-assign role on signup from user metadata
CREATE OR REPLACE FUNCTION public.handle_new_user_role()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.user_roles (user_id, role)
  VALUES (
    NEW.id,
    COALESCE(
      (NEW.raw_user_meta_data->>'role')::app_role,
      'pharmacist'::app_role
    )
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created_role
AFTER INSERT ON auth.users
FOR EACH ROW
EXECUTE FUNCTION public.handle_new_user_role();
