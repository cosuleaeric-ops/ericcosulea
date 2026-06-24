-- Supabase / Postgres schema for the cesaicumpar.ro migration.
-- Taxonomies are stored as text[] (simple + queryable with && / @>); switch to
-- junction tables later only if you need per-term pages with their own metadata.

-- ============ ARTICOLE (blog posts) ============
create table if not exists articole (
  id             bigint primary key,        -- original WordPress post id
  slug           text unique not null,
  title          text not null,
  date           timestamptz,
  modified       timestamptz,
  status         text,
  link           text,                      -- original permalink
  categories     text[] default '{}',
  tags           text[] default '{}',
  featured_image text,
  excerpt_html   text,
  content_html   text,                      -- full rendered HTML
  content_text   text                       -- plain-text version (search / previews)
);

create index if not exists articole_categories_idx on articole using gin (categories);
create index if not exists articole_tags_idx       on articole using gin (tags);

-- ============ CADOURI (gift ideas / affiliate links) ============
create table if not exists cadouri (
  id             bigint primary key,        -- original WordPress post id
  slug           text unique not null,
  title          text not null,
  affiliate_link text not null,             -- 2Performant / Profitshare URL
  featured_image text,
  ocazie         text[] default '{}',       -- 1 martie, Craciun, Majorat, ...
  pentru_cine    text[] default '{}',       -- Mama, Tata, Iubita, Bunic, ...
  pret           text[] default '{}',       -- Ieftin, ...
  tip            text[] default '{}',       -- Jucarie, Carte, Gaming, Beauty, ...
  date           timestamptz,
  modified       timestamptz,
  status         text
);

create index if not exists cadouri_pentru_cine_idx on cadouri using gin (pentru_cine);
create index if not exists cadouri_tip_idx         on cadouri using gin (tip);
create index if not exists cadouri_ocazie_idx      on cadouri using gin (ocazie);

-- ============ PRODUSE DIN ARTICOLE (affiliate links inside post bodies) ============
-- Produsele linkate în corpul articolelor (blocuri media-text sau linkuri inline).
-- Distinct de tabelul `cadouri` (care e CPT separat). Sursa: articole_produse.json.
create table if not exists articol_produse (
  id             bigserial primary key,
  article_id     bigint not null references articole(id) on delete cascade,
  name           text,                      -- nume produs (best-effort la linkuri inline)
  affiliate_link text not null,             -- Profitshare / 2Performant
  network        text,                      -- 'profitshare' | '2performant'
  merchant       text,                      -- magazin final (doar pt 2Performant)
  image          text,
  unique (article_id, affiliate_link)
);

create index if not exists articol_produse_article_idx on articol_produse (article_id);
