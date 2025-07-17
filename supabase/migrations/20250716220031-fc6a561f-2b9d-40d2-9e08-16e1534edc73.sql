-- Add navigation menu and not found page content to site_content
INSERT INTO site_content (key, content) VALUES 
('navigation', '{
  "en": [
    {"name": "Home", "href": "/"},
    {"name": "Events", "href": "/events"},
    {"name": "Gallery", "href": "/gallery"},
    {"name": "About", "href": "/about"},
    {"name": "Ambassador", "href": "/ambassador"},
    {"name": "Partners", "href": "/partners"},
    {"name": "Contact", "href": "/contact"}
  ],
  "fr": [
    {"name": "Accueil", "href": "/"},
    {"name": "Événements", "href": "/events"},
    {"name": "Galerie", "href": "/gallery"},
    {"name": "À Propos", "href": "/about"},
    {"name": "Ambassadeur", "href": "/ambassador"},
    {"name": "Partenaires", "href": "/partners"},
    {"name": "Contact", "href": "/contact"}
  ]
}'),
('not_found', '{
  "title": "404",
  "subtitle": "Oops! Page not found",
  "linkText": "Return to Home"
}')
ON CONFLICT (key) DO UPDATE SET 
content = EXCLUDED.content,
updated_at = now();