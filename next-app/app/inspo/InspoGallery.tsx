"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { uploadInspoAction, deleteInspoAction } from "./actions";

type Image = {
  id: number;
  filename: string;
};

export default function InspoGallery({ images, baseUrl }: { images: Image[]; baseUrl: string }) {
  const [activeSrc, setActiveSrc] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [pendingUpload, startUpload] = useTransition();
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetch("/api/auth-status")
      .then((r) => r.json())
      .then((d) => setIsAdmin(Boolean(d.loggedIn)))
      .catch(() => setIsAdmin(false));
  }, []);

  useEffect(() => {
    if (activeSrc) document.body.classList.add("lightbox-open");
    else document.body.classList.remove("lightbox-open");
    return () => document.body.classList.remove("lightbox-open");
  }, [activeSrc]);

  useEffect(() => {
    if (!activeSrc) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setActiveSrc(null);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [activeSrc]);

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadError(null);
    const fd = new FormData();
    fd.set("image", file);
    startUpload(async () => {
      const result = await uploadInspoAction(fd);
      if (result?.error) setUploadError(result.error);
      else if (fileInputRef.current) fileInputRef.current.value = "";
    });
  };

  const onDelete = (id: number) => {
    if (!confirm("Ștergi imaginea?")) return;
    const fd = new FormData();
    fd.set("id", String(id));
    startUpload(() => deleteInspoAction(fd));
  };

  return (
    <>
      {isAdmin && (
        <div className="inspo-upload">
          <label className="inspo-upload-label">
            <span>{pendingUpload ? "se încarcă..." : "adaugă imagine"}</span>
            <input
              ref={fileInputRef}
              type="file"
              name="image"
              accept="image/*"
              onChange={onFileChange}
              disabled={pendingUpload}
            />
          </label>
          {uploadError && <span className="login-error">{uploadError}</span>}
        </div>
      )}
      <div className="inspo-grid">
        {images.map((img) => {
          const src = `${baseUrl}/inspo/${img.filename}`;
          return (
            <div key={img.id} className="inspo-card">
              <button className="inspo-card-open" type="button" onClick={() => setActiveSrc(src)}>
                <img src={src} alt="" loading="lazy" decoding="async" />
              </button>
              {isAdmin && (
                <div className="inspo-card-delete">
                  <button type="button" aria-label="șterge imaginea" onClick={() => onDelete(img.id)}>
                    ×
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>
      <div
        className="inspo-lightbox"
        hidden={!activeSrc}
        onClick={(e) => {
          if (e.target === e.currentTarget) setActiveSrc(null);
        }}
      >
        <button
          className="inspo-lightbox-close"
          type="button"
          aria-label="inchide"
          onClick={() => setActiveSrc(null)}
        >
          ×
        </button>
        {activeSrc && <img className="inspo-lightbox-image" src={activeSrc} alt="" />}
      </div>
    </>
  );
}
