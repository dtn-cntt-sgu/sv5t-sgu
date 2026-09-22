import preview from "./criteria-preview.json";

// Rendered on the server: works on mobile even before hydration or with JS disabled.
export function PdfPreview({ source }: { source: string }) {
  return (
    <div
      className="pdf-preview"
      aria-label="Nội dung tài liệu PDF"
      tabIndex={0}
    >
      <p className="pdf-status">
        {preview.pages.length} trang ·{" "}
        <a href={source} target="_blank" rel="noreferrer">
          Mở hoặc tải bản PDF gốc
        </a>
      </p>
      <div className="pdf-pages">
        {preview.pages.map((url, index) => (
          // Native images deliberately avoid a browser PDF engine and Next image-optimizer requests.
          // eslint-disable-next-line @next/next/no-img-element
          <img
            key={url}
            src={url}
            alt={`Bộ tiêu chuẩn và hướng dẫn SV5T — trang ${index + 1}`}
            width={preview.width}
            height={preview.height}
            className="pdf-page"
            loading={index === 0 ? "eager" : "lazy"}
            decoding="async"
          />
        ))}
      </div>
    </div>
  );
}
