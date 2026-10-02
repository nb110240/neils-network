import type { MetadataRoute } from "next"

// Replaces the old hand-maintained public/sitemap.xml. Runs at build time, so
// lastModified reflects the deploy date. /login is deliberately excluded.
export default function sitemap(): MetadataRoute.Sitemap {
  const base = "https://savvo.app"
  const lastModified = new Date()

  return [
    { url: `${base}/`, lastModified, changeFrequency: "weekly", priority: 1 },
    { url: `${base}/pricing`, lastModified, changeFrequency: "monthly", priority: 0.8 },
    { url: `${base}/from-spreadsheet`, lastModified, changeFrequency: "monthly", priority: 0.8 },
    { url: `${base}/templates/investor-tracker`, lastModified, changeFrequency: "monthly", priority: 0.8 },
    { url: `${base}/vs/airtable`, lastModified, changeFrequency: "monthly", priority: 0.7 },
    { url: `${base}/vs/streak`, lastModified, changeFrequency: "monthly", priority: 0.7 },
    { url: `${base}/vs/attio`, lastModified, changeFrequency: "monthly", priority: 0.7 },
    { url: `${base}/vs/notion`, lastModified, changeFrequency: "monthly", priority: 0.7 },
    { url: `${base}/blog`, lastModified, changeFrequency: "weekly", priority: 0.7 },
    { url: `${base}/blog/how-to-track-investor-outreach-seed-round`, lastModified, changeFrequency: "monthly", priority: 0.6 },
    { url: `${base}/blog/how-many-investors-to-pitch-seed-round`, lastModified, changeFrequency: "monthly", priority: 0.6 },
    { url: `${base}/blog/fundraising-crm-comparison`, lastModified, changeFrequency: "monthly", priority: 0.6 },
    { url: `${base}/changelog`, lastModified, changeFrequency: "weekly", priority: 0.6 },
    { url: `${base}/install`, lastModified, changeFrequency: "monthly", priority: 0.4 },
    { url: `${base}/help`, lastModified, changeFrequency: "monthly", priority: 0.4 },
    { url: `${base}/privacy`, lastModified, changeFrequency: "monthly", priority: 0.3 },
    { url: `${base}/terms`, lastModified, changeFrequency: "monthly", priority: 0.3 },
  ]
}
