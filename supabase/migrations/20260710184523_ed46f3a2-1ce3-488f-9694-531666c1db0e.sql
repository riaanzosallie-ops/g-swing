-- Restrict the private gi-assets bucket to admins only via storage.objects RLS.
-- The golfintel-proxy edge function uses service_role and bypasses RLS, so
-- normal app flows (signed URLs) are unaffected.

DROP POLICY IF EXISTS "gi-assets admin read" ON storage.objects;
DROP POLICY IF EXISTS "gi-assets admin insert" ON storage.objects;
DROP POLICY IF EXISTS "gi-assets admin update" ON storage.objects;
DROP POLICY IF EXISTS "gi-assets admin delete" ON storage.objects;

CREATE POLICY "gi-assets admin read"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'gi-assets'
  AND public.has_role(auth.uid(), 'admin'::public.app_role)
);

CREATE POLICY "gi-assets admin insert"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'gi-assets'
  AND public.has_role(auth.uid(), 'admin'::public.app_role)
);

CREATE POLICY "gi-assets admin update"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'gi-assets'
  AND public.has_role(auth.uid(), 'admin'::public.app_role)
)
WITH CHECK (
  bucket_id = 'gi-assets'
  AND public.has_role(auth.uid(), 'admin'::public.app_role)
);

CREATE POLICY "gi-assets admin delete"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'gi-assets'
  AND public.has_role(auth.uid(), 'admin'::public.app_role)
);