import { BookOpen, FileText, Info } from "lucide-react";
import { Buddy } from "../../app/Buddy";
import { appCommit, appVersion } from "../../app/version";
import { CHANGELOG } from "../../content/changelog";

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
        <Buddy size={56} />
        <div>
          <p className="about-name">Inspection Companion</p>
          <p className="muted">
            Version {appVersion} ({appCommit})
          </p>
          <p className="muted">Built by David Samson</p>
        </div>
      </div>
      <ul className="about-docs">
        {DOCS.map(({ href, label, note, Icon }) => (
          <li key={href}>
            {/* A plain link: iPadOS opens it straight from the tap, and the
                app's offline cache serves it. */}
            <a
              className="list-row"
              href={`${import.meta.env.BASE_URL}${href}`}
              target="_blank"
              rel="noopener"
            >
              <Icon aria-hidden="true" />
              <span className="list-row-main">
                <span>{label}</span>
                <span className="list-row-meta">{note} · PDF</span>
              </span>
            </a>
          </li>
        ))}
      </ul>
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
