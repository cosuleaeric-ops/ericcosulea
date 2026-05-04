"use client";

import { useEffect, useState } from "react";

type Image = {
  id: number;
  filename: string;
};

export default function InspoGallery({ images, baseUrl }: { images: Image[]; baseUrl: string }) {
  const [activeSrc, setActiveSrc] = useState<string | null>(null);

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

  return (
    <>
      <div className="inspo-grid">
        {images.map((img) => {
          const src = `${baseUrl}/inspo/${img.filename}`;
          return (
            <div key={img.id} className="inspo-card">
              <button className="inspo-card-open" type="button" onClick={() => setActiveSrc(src)}>
                <img src={src} alt="" />
              </button>
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
