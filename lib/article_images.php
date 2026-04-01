<?php
declare(strict_types=1);

function ensure_article_image_table(SQLite3 $db): void {
    $db->exec('CREATE TABLE IF NOT EXISTS article_image_replacements (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        original_url TEXT UNIQUE NOT NULL,
        replacement_url TEXT NOT NULL,
        uploaded_at TEXT NOT NULL
    );');
}

function extract_article_image_urls(string $html): array {
    preg_match_all('~https?://[^"\'\s>]+~', $html, $matches);
    $urls = [];
    foreach ($matches[0] as $url) {
        if (strpos($url, '/wp-content/uploads/') === false) {
            continue;
        }
        if (!in_array($url, $urls, true)) {
            $urls[] = $url;
        }
    }
    return $urls;
}

function article_image_replacement_map(SQLite3 $db): array {
    ensure_article_image_table($db);
    $result = $db->query('SELECT original_url, replacement_url FROM article_image_replacements');
    $map = [];
    while ($row = $result->fetchArray(SQLITE3_ASSOC)) {
        $map[$row['original_url']] = $row['replacement_url'];
    }
    return $map;
}

function replace_article_image_urls(string $html, array $map): string {
    if ($map === []) {
        return $html;
    }
    return strtr($html, $map);
}

function collect_article_image_rows(SQLite3 $db): array {
    ensure_article_image_table($db);
    $replacementMap = article_image_replacement_map($db);
    $result = $db->query('SELECT id, slug, title, content_html FROM posts ORDER BY published_at DESC');
    $rows = [];

    while ($post = $result->fetchArray(SQLITE3_ASSOC)) {
        foreach (extract_article_image_urls($post['content_html']) as $url) {
            $rows[] = [
                'post_id' => (int)$post['id'],
                'slug' => $post['slug'],
                'title' => $post['title'],
                'original_url' => $url,
                'replacement_url' => $replacementMap[$url] ?? null,
                'basename' => basename(parse_url($url, PHP_URL_PATH) ?? $url),
            ];
        }
    }

    return $rows;
}
