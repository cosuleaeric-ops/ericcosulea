export const BLOB_BASE_URL = "https://4v3qkr3mrjun3eft.public.blob.vercel-storage.com";

export function blobUrl(path: string): string {
  const clean = path.replace(/^\/+/, "").replace(/^uploads\//, "");
  return `${BLOB_BASE_URL}/${clean}`;
}

export function rewriteUploadUrls(html: string): string {
  return html.replace(/\/uploads\/([^"'\s)]+)/g, `${BLOB_BASE_URL}/$1`);
}
