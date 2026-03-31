import { GlobalWorkerOptions, getDocument } from "pdfjs-dist";
import pdfWorkerSrc from "pdfjs-dist/build/pdf.worker.min.mjs?url";

GlobalWorkerOptions.workerSrc = pdfWorkerSrc;

export async function extractPdfText(file, { maxPages = 25 } = {}) {
  if (!file) return { text: "", pagesParsed: 0, totalPages: 0, truncated: false };

  const arrayBuffer = await file.arrayBuffer();
  const pdf = await getDocument({ data: arrayBuffer }).promise;

  const totalPages = pdf.numPages || 0;
  const pagesParsed = Math.min(totalPages, Math.max(1, maxPages | 0));

  const parts = [];
  for (let p = 1; p <= pagesParsed; p++) {
    const page = await pdf.getPage(p);
    const content = await page.getTextContent();
    const line = (content.items || [])
      .map((it) => (typeof it?.str === "string" ? it.str : ""))
      .filter(Boolean)
      .join(" ")
      .replace(/\s+/g, " ")
      .trim();
    if (line) parts.push(line);
  }

  const truncated = totalPages > pagesParsed;
  const text = parts.join("\n\n").trim();

  return { text, pagesParsed, totalPages, truncated };
}

function pickFirstMatch(text, patterns) {
  for (const re of patterns) {
    const m = re.exec(text);
    if (m?.[1]) {
      const v = String(m[1]).trim();
      if (v) return v;
    }
  }
  return "";
}

export function inferCaseTitleAndDetailsFromText(text) {
  const clean = String(text || "").replace(/\u0000/g, "").trim();
  if (!clean) return { title: "", details: "" };

  const title = pickFirstMatch(clean, [
    /(?:^|\n)\s*case\s*title\s*[:\-]\s*(.+)\s*$/im,
    /(?:^|\n)\s*title\s*[:\-]\s*(.+)\s*$/im,
    /(?:^|\n)\s*subject\s*[:\-]\s*(.+)\s*$/im,
    /(?:^|\n)\s*re\s*[:\-]\s*(.+)\s*$/im,
  ]);

  const details = pickFirstMatch(clean, [
    /(?:^|\n)\s*case\s*details\s*[:\-]\s*([\s\S]+?)\n\s*\n/im,
    /(?:^|\n)\s*details\s*[:\-]\s*([\s\S]+?)\n\s*\n/im,
    /(?:^|\n)\s*brief\s*history\s*[:\-]\s*([\s\S]+?)\n\s*\n/im,
  ]);

  if (title || details) return { title, details };

  const lines = clean
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  const fallbackTitle = (lines[0] || "").slice(0, 140);
  const fallbackDetails = lines.slice(1, 10).join("\n").slice(0, 1200);

  return { title: fallbackTitle, details: fallbackDetails };
}

