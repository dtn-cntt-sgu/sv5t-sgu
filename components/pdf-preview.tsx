"use client";

import { useEffect, useRef, useState } from "react";

export function PdfPreview({ source }: { source: string }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");

  useEffect(() => {
    let cancelled = false;
    const container = containerRef.current;
    if (!container) return;
    const preview = container;

    preview.replaceChildren();
    setState("loading");

    async function renderPdf() {
      try {
        const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
        pdfjs.GlobalWorkerOptions.workerSrc = new URL(
          "pdfjs-dist/legacy/build/pdf.worker.mjs",
          import.meta.url,
        ).toString();
        const loadingTask = pdfjs.getDocument({ url: source });
        const pdf = await loadingTask.promise;

        for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
          if (cancelled) return;
          const page = await pdf.getPage(pageNumber);
          const baseViewport = page.getViewport({ scale: 1 });
          const scale = Math.min(
            (preview.clientWidth - 32) / baseViewport.width,
            1.6,
          );
          const viewport = page.getViewport({ scale: Math.max(scale, 0.5) });
          const canvas = document.createElement("canvas");
          const context = canvas.getContext("2d");
          if (!context) throw new Error("Canvas is not supported");

          canvas.width = Math.ceil(viewport.width);
          canvas.height = Math.ceil(viewport.height);
          canvas.className = "pdf-page";
          preview.appendChild(canvas);
          await page.render({
            canvas,
            canvasContext: context,
            viewport,
          }).promise;
        }

        if (!cancelled) setState("ready");
      } catch {
        if (!cancelled) setState("error");
      }
    }

    void renderPdf();
    return () => {
      cancelled = true;
      preview.replaceChildren();
    };
  }, [source]);

  return (
    <div className="pdf-preview" aria-label="Nội dung tài liệu PDF">
      <div ref={containerRef} className="pdf-pages" />
      {state === "loading" && <p className="pdf-status">Đang tải tài liệu…</p>}
      {state === "error" && (
        <p className="pdf-status">
          Không thể hiển thị tài liệu. Vui lòng mở hoặc tải file PDF.
        </p>
      )}
    </div>
  );
}
