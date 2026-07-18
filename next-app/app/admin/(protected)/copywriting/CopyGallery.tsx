"use client";

import Image from "next/image";
import { useEffect, useRef, useState, useTransition } from "react";
import { uploadCopyAction, deleteCopyAction } from "./actions";

type ImageItem = {
  id: number;
  src: string;
};

export default function CopyGallery({ images }: { images: ImageItem[] }) {
  const [activeSrc, setActiveSrc] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [pendingUpload, startUpload] = useTransition();
  const fileInputRef = useRef<HTMLInputElement>(null);

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
      const result = await uploadCopyAction(fd);
      if (result?.error) setUploadError(result.error);
      else if (fileInputRef.current) fileInputRef.current.value = "";
    });
  };

  const onDelete = (id: number) => {
    if (!confirm("Ștergi imaginea?")) return;
    const fd = new FormData();
    fd.set("id", String(id));
    startUpload(() => deleteCopyAction(fd));
  };

  return (
    <>
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
      <div className="inspo-grid">
        {images.map((img) => (
          <div key={img.id} className="inspo-card">
            <button className="inspo-card-open" type="button" onClick={() => setActiveSrc(img.src)}>
              <Image
                src={img.src}
                alt=""
                width={480}
                height={640}
                sizes="(max-width: 768px) 100vw, 33vw"
                style={{ width: "100%", height: "auto" }}
              />
            </button>
            <div className="inspo-card-delete">
              <button type="button" aria-label="șterge imaginea" onClick={() => onDelete(img.id)}>
                ×
              </button>
            </div>
          </div>
        ))}
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
        {activeSrc && (
          <Image
            className="inspo-lightbox-image"
            src={activeSrc}
            alt=""
            width={1100}
            height={1100}
            sizes="100vw"
            priority
            style={{ width: "auto", height: "auto", maxWidth: "min(1100px, calc(100vw - 56px))", maxHeight: "calc(100vh - 56px)" }}
          />
        )}
      </div>
    </>
  );
}
