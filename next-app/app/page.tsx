import Link from "next/link";
import Image from "next/image";
import { getProjectsForHome, getLatestImages } from "@/lib/db/queries";
import { blobUrl } from "@/lib/blob";

export const revalidate = 3600;

export default async function Home() {
  const [projects, latestImages] = await Promise.all([
    getProjectsForHome(),
    getLatestImages(8),
  ]);

  return (
    <main className="page">
      <header className="hero">
        <div className="hero-avatar">
          <Image src="/assets/avatar.jpeg" alt="Eric Cosulea" width={100} height={100} priority />
        </div>
        <div className="hero-text">
          <div className="hero-title">
            <h1>eric coșulea</h1>
            <nav className="hero-social" aria-label="social">
              <a href="https://www.linkedin.com/in/eric-cosulea/" target="_blank" rel="noopener noreferrer" aria-label="LinkedIn" title="LinkedIn">
                <img src="/assets/linkedin.svg" alt="" />
              </a>
              <a href="https://www.instagram.com/ericcosulea" target="_blank" rel="noopener noreferrer" aria-label="Instagram" title="Instagram">
                <img src="/assets/instagram.svg" alt="" />
              </a>
              <a href="https://www.facebook.com/eric.cosulea/" target="_blank" rel="noopener noreferrer" aria-label="Facebook" title="Facebook">
                <img src="/assets/facebook.svg" alt="" />
              </a>
            </nav>
          </div>
          <p className="hero-sub">speedrunning failures.</p>
        </div>
      </header>

      <section className="section">
        <h2>proiectele mele</h2>
        <div className="projects">
          {projects.map((proj) => (
            <a key={proj.id} className="project" href={proj.url} target="_blank" rel="noopener noreferrer">
              <img className="project-icon-img" src={proj.logo} alt="" />
              <span className="project-text">
                <span className="project-name">{proj.name}</span>
                {proj.description && <span className="project-meta">({proj.description})</span>}
              </span>
            </a>
          ))}
        </div>
      </section>

      <section className="section">
        <h2>interesante</h2>
        <div className="topic-list">
          <Link className="topic-item" href="/tools">
            <img className="project-icon-img" src="/assets/tools.webp" alt="" />
            <div className="topic-text">
              <span className="topic-title">tools</span>
              <span className="topic-sub">(colecție de aplicații pe care le folosesc în proiecte)</span>
            </div>
          </Link>
          <Link className="topic-item" href="/blog">
            <img className="project-icon-img" src="/assets/paper.png" alt="" />
            <div className="topic-text">
              <span className="topic-title">blog</span>
              <span className="topic-sub">(mozaic de gânduri pentru Eric din viitor)</span>
            </div>
          </Link>
        </div>
      </section>

      <section className="section">
        <h2>inspo</h2>
        <p className="page-lead">imagini salvate pentru zilele alea naspa</p>
        <div className="inspo-strip">
          {latestImages.map((img) => (
            <Link key={img.id} className="inspo-thumb" href="/inspo">
              <Image
                src={blobUrl(`inspo/${img.filename}`)}
                alt=""
                fill
                sizes="(max-width: 768px) 33vw, 120px"
              />
            </Link>
          ))}
        </div>
        <Link className="inspo-link" href="/inspo">
          vezi toate imaginile →
        </Link>
      </section>
    </main>
  );
}
