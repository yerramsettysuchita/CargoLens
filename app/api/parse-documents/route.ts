// ─── PDF Text Extraction Route ────────────────────────────────────────────────
// Accepts multipart/form-data with one or more files (PDF or TXT).
// Extracts readable text using Node.js built-in zlib for FlateDecode streams.
// No external PDF library required.
//
// Confidence levels:
//   high   — >200 chars extracted (digital PDF, text readable)
//   low    — 50–200 chars extracted (partial text layer or sparse doc)
//   failed — <50 chars (likely scanned PDF — OCR not available in this stack)

import { NextRequest, NextResponse } from "next/server";
import zlib from "zlib";
import { promisify } from "util";

export const runtime = "nodejs";

const inflateAsync    = promisify(zlib.inflate);
const inflateRawAsync = promisify(zlib.inflateRaw);
const gunzipAsync     = promisify(zlib.gunzip);

const MAX_FILES      = 6;
const MAX_FILE_BYTES = 15 * 1024 * 1024; // 15 MB

// ─── Core PDF extractor ───────────────────────────────────────────────────────

async function decompressStream(raw: Buffer): Promise<string> {
  // Zlib FlateDecode: starts with 0x78
  if (raw.length > 2 && raw[0] === 0x78) {
    try {
      const d = await inflateAsync(raw);
      return d.toString("latin1");
    } catch {
      try {
        const d = await inflateRawAsync(raw);
        return d.toString("latin1");
      } catch { /* fall through */ }
    }
  }
  // Gzip: starts with 0x1F 0x8B
  if (raw.length > 2 && raw[0] === 0x1f && raw[1] === 0x8b) {
    try {
      const d = await gunzipAsync(raw);
      return d.toString("latin1");
    } catch { /* fall through */ }
  }
  // Uncompressed: return as-is
  return raw.toString("latin1");
}

function extractTextFromContentStream(content: string): string[] {
  const texts: string[] = [];

  const btEtRegex = /BT([\s\S]*?)ET/g;
  let blockMatch: RegExpExecArray | null;

  while ((blockMatch = btEtRegex.exec(content)) !== null) {
    const block = blockMatch[1];

    // (string) Tj  or  (string) '  or  (string) "
    const tjRegex = /\(([^)\\]*(?:\\.[^)\\]*)*)\)\s*(?:Tj|'|")/g;
    let m: RegExpExecArray | null;
    while ((m = tjRegex.exec(block)) !== null) {
      const t = unescapePdfString(m[1]);
      if (t.trim().length > 0) texts.push(t);
    }

    // [(str1) n (str2)] TJ
    const tjArrRegex = /\[([^\]]*)\]\s*TJ/g;
    while ((m = tjArrRegex.exec(block)) !== null) {
      const inner   = m[1];
      const parts   = inner.match(/\(([^)\\]*(?:\\.[^)\\]*)*)\)/g) ?? [];
      const joined  = parts.map((p) => unescapePdfString(p.slice(1, -1))).join("");
      if (joined.trim().length > 0) texts.push(joined);
    }
  }

  return texts;
}

function unescapePdfString(s: string): string {
  return s
    .replace(/\\n/g,  " ")
    .replace(/\\r/g,  "")
    .replace(/\\t/g,  " ")
    .replace(/\\\(/g, "(")
    .replace(/\\\)/g, ")")
    .replace(/\\\\/g, "\\")
    .replace(/\\(\d{3})/g, (_, oct) => {
      const code = parseInt(oct, 8);
      return code >= 32 && code < 127 ? String.fromCharCode(code) : " ";
    });
}

async function extractPdfText(
  buffer: Buffer,
): Promise<{ text: string; confidence: "high" | "low" | "failed" }> {
  try {
    // Plain text file
    const header = buffer.slice(0, 4).toString("ascii");
    if (header !== "%PDF") {
      const t = buffer.toString("utf-8").slice(0, 60_000).trim();
      return { text: t, confidence: t.length > 100 ? "high" : "low" };
    }

    const latin1   = buffer.toString("latin1");
    const allTexts: string[] = [];

    // Find all stream...endstream objects
    const streamRegex = /stream\r?\n([\s\S]*?)\r?\nendstream/g;
    let sm: RegExpExecArray | null;

    while ((sm = streamRegex.exec(latin1)) !== null) {
      const raw        = Buffer.from(sm[1], "latin1");
      const streamText = await decompressStream(raw);
      const extracted  = extractTextFromContentStream(streamText);
      allTexts.push(...extracted);
    }

    const text = allTexts.join(" ").replace(/\s+/g, " ").trim();

    if (text.length > 200) return { text: text.slice(0, 40_000), confidence: "high" };
    if (text.length > 50)  return { text, confidence: "low" };

    // Fallback: scan raw Latin-1 bytes for ASCII word sequences
    const readable = latin1
      .replace(/[^\x20-\x7E\n\r\t]/g, " ")
      .replace(/\s+/g, " ")
      .trim();

    const chunks = (readable.match(/[A-Za-z][A-Za-z0-9 .,\-:/$()\n]{12,}/g) ?? []).join(" ").trim();
    if (chunks.length > 60) return { text: chunks.slice(0, 40_000), confidence: "low" };

    return { text: "", confidence: "failed" };
  } catch (err) {
    console.error("[parse-documents] extraction error:", err);
    return { text: "", confidence: "failed" };
  }
}

// ─── Route handler ────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return NextResponse.json({ error: "Expected multipart/form-data" }, { status: 400 });
  }

  const files = formData.getAll("files") as File[];

  if (files.length === 0) {
    return NextResponse.json({ error: "No files provided" }, { status: 400 });
  }
  if (files.length > MAX_FILES) {
    return NextResponse.json({ error: `Maximum ${MAX_FILES} files allowed` }, { status: 400 });
  }

  const results = await Promise.all(
    files.map(async (file) => {
      if (file.size > MAX_FILE_BYTES) {
        return {
          name:       file.name,
          size:       file.size,
          text:       "",
          confidence: "failed" as const,
          error:      `File too large (max ${MAX_FILE_BYTES / 1024 / 1024} MB)`,
        };
      }

      const buffer = Buffer.from(await file.arrayBuffer());
      const { text, confidence } = await extractPdfText(buffer);

      return {
        name:       file.name,
        size:       file.size,
        text,
        confidence,
        error:      confidence === "failed"
          ? "Text extraction failed — this may be a scanned PDF. OCR is not available in this stack. Consider uploading a digital (text-based) PDF."
          : undefined,
      };
    }),
  );

  return NextResponse.json({ files: results });
}
