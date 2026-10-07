import { BookOpen, FileText, Info } from "lucide-react";
import { useState } from "react";
import { Buddy } from "../../app/Buddy";
import { PdfViewer } from "../../app/PdfViewer";
import { appCommit, appVersion } from "../../app/version";
import { CHANGELOG } from "../../content/changelog";
import { saveFiles } from "../photos/savePhotos";

/** The documents bundled with the app (npm run docs:build), so they open offline. */
const DOCS = [
  {
    href: "docs/user-guide.pdf",
    label: "User guide",
    note: "How to run an inspection, step by step",
    Icon: BookOpen,
  },
  {
    href: "docs/features-and-limitations.pdf",
    label: "Features and limitations",
    note: "What the app does and doesn't do",
    Icon: FileText,
  },
];

/**
 * Settings, About (engineer, 2026-10-07): the app, its version and who
 * built it, the bundled documents, and what's new by milestone.
 */
export function AboutCard() {
  // The document open in the app's PDF viewer (it has a Back button).
  const [open, setOpen] = useState<(typeof DOCS)[number] | null>(null);
  return (
    <section
      id="about"
      className="settings-card about-card"
      aria-labelledby="about-heading"
    >
      <h2 id="about-heading" className="card-title">
        <span className="card-icon">
          <Info aria-hidden="true" />
        </span>
        About
      </h2>
      <div className="about-app">
        <img
          className="about-icon"
          src={`${import.meta.env.BASE_URL}pwa-192x192.png`}
          alt=""
          width={56}
          height={56}
        />
        <div>
          <p className="about-name">Northrop Hardhat</p>
          <p className="muted">
            Version {appVersion} ({appCommit})
          </p>
          <p className="muted">Built by David Samson</p>
        </div>
        <Buddy size={56} />
      </div>
      <ul className="about-docs">
        {DOCS.map((doc) => (
          <li key={doc.href}>
            {/* Opened in the app (the offline cache serves the file). */}
            <button
              type="button"
              className="list-row"
              data-href={`${import.meta.env.BASE_URL}${doc.href}`}
              onClick={() => setOpen(doc)}
            >
              <doc.Icon aria-hidden="true" />
              <span className="list-row-main">
                <span>{doc.label}</span>
                <span className="list-row-meta">{doc.note} · PDF</span>
              </span>
            </button>
          </li>
        ))}
      </ul>
      {open && (
        <PdfViewer
          title={open.label}
          load={() =>
            fetch(`${import.meta.env.BASE_URL}${open.href}`).then((r) => {
              if (!r.ok) throw new Error(`HTTP ${r.status}`);
              return r.arrayBuffer();
            })
          }
          onClose={() => setOpen(null)}
          onShare={(bytes) =>
            void saveFiles([
              new File([bytes], open.href.split("/").pop()!, {
                type: "application/pdf",
              }),
            ])
          }
        />
      )}
      <h3 className="about-heading">What's new</h3>
      {CHANGELOG.map((release) => (
        <div key={release.version} className="about-release">
          <p className="about-release-title">
            Version {release.version}
            <span className="muted"> · {release.date}</span>
          </p>
          <ul>
            {release.items.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>
      ))}
    </section>
  );
}
