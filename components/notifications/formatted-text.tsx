import { Fragment, type ReactNode } from "react";
import styles from "./notifications.module.css";

// A deliberately small text format: never interpret HTML, URLs, images or embeds.
function inline(text: string): ReactNode[] {
  return text.split(/(\*\*[^*\n]+\*\*|\*[^*\n]+\*)/g).map((part, index) => {
    if (part.startsWith("**") && part.endsWith("**") && part.length > 4)
      return <strong key={index}>{part.slice(2, -2)}</strong>;
    if (part.startsWith("*") && part.endsWith("*") && part.length > 2)
      return <em key={index}>{part.slice(1, -1)}</em>;
    return <Fragment key={index}>{part}</Fragment>;
  });
}
export function FormattedText({ text }: { text: string }) {
  const lines = text.replace(/\r\n?/g, "\n").split("\n");
  const blocks: ReactNode[] = [];
  for (let index = 0; index < lines.length; index++) {
    const line = lines[index];
    if (!line.trim()) {
      blocks.push(<div className={styles.spacer} key={index} />);
      continue;
    }
    const heading = line.match(/^#{1,3}\s+(.+)$/);
    if (heading) {
      blocks.push(<h3 key={index}>{inline(heading[1])}</h3>);
      continue;
    }
    const list = line.match(/^(- |\d+\. )/);
    if (list) {
      const start = index;
      const ordered = list[1] !== "- ";
      const pattern = ordered ? /^\d+\. / : /^- /;
      const items: ReactNode[] = [];
      while (index < lines.length && pattern.test(lines[index])) {
        items.push(
          <li key={index}>{inline(lines[index].replace(pattern, ""))}</li>,
        );
        index++;
      }
      index--;
      blocks.push(
        ordered ? <ol key={start}>{items}</ol> : <ul key={start}>{items}</ul>,
      );
      continue;
    }
    blocks.push(<p key={index}>{inline(line)}</p>);
  }
  return <div className={styles.formatted}>{blocks}</div>;
}
