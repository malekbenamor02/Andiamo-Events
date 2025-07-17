-- Create contact_messages table
CREATE TABLE public.contact_messages (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT NOT NULL,
    email TEXT NOT NULL,
    subject TEXT NOT NULL,
    message TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    status TEXT DEFAULT 'unread' CHECK (status IN ('unread', 'read', 'responded'))
);

-- Create admin_users table
CREATE TABLE public.admin_users (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    email TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    role TEXT DEFAULT 'admin' CHECK (role IN ('admin', 'super_admin')),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.contact_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_users ENABLE ROW LEVEL SECURITY;

-- Contact messages policies
CREATE POLICY "Anyone can submit contact messages" 
ON public.contact_messages 
FOR INSERT 
WITH CHECK (true);

CREATE POLICY "Admins can view contact messages" 
ON public.contact_messages 
FOR SELECT 
USING (EXISTS (SELECT 1 FROM public.admin_users WHERE email = auth.jwt() ->> 'email'));

CREATE POLICY "Admins can update contact messages" 
ON public.contact_messages 
FOR UPDATE 
USING (EXISTS (SELECT 1 FROM public.admin_users WHERE email = auth.jwt() ->> 'email'));

-- Admin users policies
CREATE POLICY "Admins can view admin users" 
ON public.admin_users 
FOR SELECT 
USING (EXISTS (SELECT 1 FROM public.admin_users WHERE email = auth.jwt() ->> 'email'));

-- Insert sample gallery items with proper event photos
INSERT INTO public.gallery (title, image_url, video_url, city, type) VALUES
('Beach Night Event - Monastir', 'https://images.unsplash.com/photo-1566737236500-c8ac43014a8e?w=800', NULL, 'Monastir', 'photo'),
('Tunis Club Night', 'https://images.unsplash.com/photo-1571266028243-d220c9a3b2d4?w=800', NULL, 'Tunis', 'photo'),
('Sousse Club Night', 'https://images.unsplash.com/photo-1571677208817-bd95d31b45c1?w=800', NULL, 'Sousse', 'photo'),
('Beach Party Highlights', 'https://images.unsplash.com/photo-1566737236500-c8ac43014a8e?w=400', 'https://sample-videos.com/zip/10/mp4/SampleVideo_1280x720_1mb.mp4', 'Monastir', 'video'),
('Club Energy Tunis', 'https://images.unsplash.com/photo-1571266028243-d220c9a3b2d4?w=400', 'https://sample-videos.com/zip/10/mp4/SampleVideo_1280x720_1mb.mp4', 'Tunis', 'video'),
('Sousse Night Fever', 'https://images.unsplash.com/photo-1571677208817-bd95d31b45c1?w=400', 'https://sample-videos.com/zip/10/mp4/SampleVideo_1280x720_1mb.mp4', 'Sousse', 'video');

-- Insert default admin user
INSERT INTO public.admin_users (email, name, role) VALUES ('admin@andiamo.tn', 'Admin User', 'super_admin');