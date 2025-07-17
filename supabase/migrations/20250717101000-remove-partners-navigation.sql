-- Remove Partners link from navigation content
UPDATE site_content 
SET content = jsonb_set(
  content,
{en},
 [    {"name:Home",href": /},  {"name:Events", "href:/events},[object Object]name": Gallery",href": "/gallery},  [object Object]name": "About, href":/about},
    {"name: Ambassador", "href": "/ambassador},[object Object]name": Contact",href: /contact"}
  ]'::jsonb
)
WHERE key = 'navigation';

UPDATE site_content 
SET content = jsonb_set(
  content,
{fr},
 [
   [object Object]name": Accueil",href": /},
    {"name: Événements", "href:/events},
   [object Object]name": Galerie",href": "/gallery},
    {"name":À Propos, href":/about},
  [object Object]name": "Ambassadeur", "href": "/ambassador},[object Object]name": Contact",href: /contact"}
  ]'::jsonb
)
WHERE key = 'navigation'; 