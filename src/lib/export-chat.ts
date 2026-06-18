import { jsPDF } from "jspdf";

interface ExportMessage {
  role: string;
  content: string;
  citations?: any[];
  createdAt?: string;
}

export function exportAsMarkdown(messages: ExportMessage[], title: string) {
  const now = new Date().toLocaleString();
  let md = `# ${title || "IntelliDoc Chat"}\n\n`;
  md += `> Exported on ${now}\n\n---\n\n`;

  for (const msg of messages) {
    const label = msg.role === "user" ? "**You**" : "**IntelliDoc AI**";
    md += `### ${label}\n\n`;
    md += `${msg.content}\n\n`;

    if (msg.citations && msg.citations.length > 0) {
      md += `<details>\n<summary>📎 Sources (${msg.citations.length})</summary>\n\n`;
      for (const cit of msg.citations) {
        const score = cit.score ? `${(cit.score * 100).toFixed(1)}%` : "N/A";
        md += `- **${score} match**: ${cit.text_snippet || ""}\n`;
      }
      md += `\n</details>\n\n`;
    }

    md += `---\n\n`;
  }

  const blob = new Blob([md], { type: "text/markdown" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${(title || "chat").replace(/[^a-zA-Z0-9]/g, "_")}.md`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function exportAsPdf(messages: ExportMessage[], title: string) {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 15;
  const maxWidth = pageWidth - margin * 2;
  let y = 20;

  const addPageIfNeeded = (requiredHeight: number) => {
    if (y + requiredHeight > doc.internal.pageSize.getHeight() - 20) {
      doc.addPage();
      y = 20;
    }
  };

  // Title
  doc.setFontSize(18);
  doc.setFont("helvetica", "bold");
  doc.text(title || "IntelliDoc Chat", margin, y);
  y += 8;

  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(120, 120, 120);
  doc.text(`Exported on ${new Date().toLocaleString()}`, margin, y);
  y += 10;
  doc.setTextColor(0, 0, 0);

  // Separator
  doc.setDrawColor(200, 200, 200);
  doc.line(margin, y, pageWidth - margin, y);
  y += 8;

  for (const msg of messages) {
    const label = msg.role === "user" ? "You" : "IntelliDoc AI";

    addPageIfNeeded(20);

    // Role label
    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(msg.role === "user" ? 30 : 80, msg.role === "user" ? 30 : 60, msg.role === "user" ? 30 : 150);
    doc.text(label, margin, y);
    y += 6;

    // Content
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(40, 40, 40);

    const lines = doc.splitTextToSize(msg.content, maxWidth);
    for (const line of lines) {
      addPageIfNeeded(6);
      doc.text(line, margin, y);
      y += 5;
    }
    y += 4;

    // Separator
    addPageIfNeeded(6);
    doc.setDrawColor(230, 230, 230);
    doc.line(margin, y, pageWidth - margin, y);
    y += 8;
  }

  doc.save(`${(title || "chat").replace(/[^a-zA-Z0-9]/g, "_")}.pdf`);
}
