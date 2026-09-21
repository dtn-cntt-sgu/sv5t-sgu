"use client";

import { useEffect, useRef, useState } from "react";
import type { PDFDocumentLoadingTask, RenderTask } from "pdfjs-dist";

export function PdfPreview({ source }: { source: string }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const preview = container;
    let cancelled = false;
    let loadingTask: PDFDocumentLoadingTask | undefined;
    let renderTask: RenderTask | undefined;
    let observer: IntersectionObserver | undefined;
    const fail = () => {
      if (cancelled) return;
      setState("error");
      cancelled = true;
      observer?.disconnect();
      renderTask?.cancel();
      void loadingTask?.destroy();
    };
    const timeout = setTimeout(fail, 30000);
    preview.replaceChildren();
    setState("loading");
    async function renderPdf() {
      try {
        const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
        if (cancelled) return;
        pdfjs.GlobalWorkerOptions.workerSrc = new URL(
          "pdfjs-dist/legacy/build/pdf.worker.mjs",
          import.meta.url,
        ).toString();
        loadingTask = pdfjs.getDocument({ url: source });
        const pdf = await loadingTask.promise;
        if (cancelled) return;
        const firstPage = await pdf.getPage(1);
        const base = firstPage.getViewport({ scale: 1 });
        const width = Math.max(1, preview.clientWidth - 32);
        const scale = Math.min(width / base.width, 1.6);
        const viewport = firstPage.getViewport({ scale });
        let queue = Promise.resolve();
        const render = async (slot: HTMLElement, number: number) => {
          if (cancelled) return;
          const page = number === 1 ? firstPage : await pdf.getPage(number);
          if (cancelled) return;
          const view = page.getViewport({ scale });
          const canvas = document.createElement("canvas");
          const context = canvas.getContext("2d");
          if (!context) throw new Error("Canvas unavailable");
          canvas.width = Math.ceil(view.width);
          canvas.height = Math.ceil(view.height);
          canvas.className = "pdf-page";
          canvas.setAttribute("aria-label", `Trang ${number}`);
          slot.replaceChildren(canvas);
          renderTask = page.render({
            canvas,
            canvasContext: context,
            viewport: view,
          });
          await renderTask.promise;
          page.cleanup();
        };
        observer = new IntersectionObserver(
          (entries) => {
            for (const entry of entries) {
              if (!entry.isIntersecting) continue;
              observer?.unobserve(entry.target);
              queue = queue
                .then(() =>
                  render(
                    entry.target as HTMLElement,
                    Number((entry.target as HTMLElement).dataset.page),
                  ),
                )
                .catch(fail);
            }
          },
          { root: preview.parentElement, rootMargin: "300px" },
        );
        // Show the first page immediately; render later pages only near the viewport.
        for (let number = 1; number <= pdf.numPages; number++) {
          if (cancelled) return;
          const slot = document.createElement("div");
          slot.style.width = "100%";
          slot.style.minHeight = `${viewport.height}px`;
          slot.dataset.page = String(number);
          preview.appendChild(slot);
          if (number === 1) {
            await render(slot, number);
            if (cancelled) return;
            clearTimeout(timeout);
            setState("ready");
          } else observer.observe(slot);
        }
      } catch {
        clearTimeout(timeout);
        fail();
      }
    }
    void renderPdf();
    return () => {
      cancelled = true;
      clearTimeout(timeout);
      observer?.disconnect();
      renderTask?.cancel();
      void loadingTask?.destroy();
      preview.replaceChildren();
    };
  }, [source, attempt]);

  return (
    <div className="pdf-preview" aria-label="Nội dung tài liệu PDF">
      {state === "loading" && (
        <p className="pdf-status" role="status">
          Đang tải tài liệu…
        </p>
      )}
      {state === "error" && (
        <div className="pdf-status" role="alert">
          <p>Không thể hiển thị tài liệu trên trình duyệt này.</p>
          <button
            type="button"
            onClick={() => setAttempt((value) => value + 1)}
          >
            Thử lại
          </button>
          {" · "}
          <a href={source} target="_blank" rel="noreferrer">
            Mở hoặc tải PDF
          </a>
        </div>
      )}
      <div ref={containerRef} className="pdf-pages" />
    </div>
  );
}
