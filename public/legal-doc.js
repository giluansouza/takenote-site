document.addEventListener("DOMContentLoaded", async () => {
    const lang = window.takeNoteSite?.getLanguage ? window.takeNoteSite.getLanguage() : "pt";
    const translations = window.takeNoteSite?.getTranslations ? window.takeNoteSite.getTranslations() : null;
    const legalDoc = lang === "en" ? document.body.dataset.legalDocEn : document.body.dataset.legalDocPt;
    const legalLabel = document.getElementById("legal-label");
    const legalContent = document.getElementById("legal-content");
    const legalToc = document.getElementById("legal-toc");
    const legalSourceLink = document.getElementById("legal-source-link");
    const legalFooterLink = document.getElementById("legal-footer-link");

    if (!legalDoc || !legalContent || !legalToc) {
        return;
    }

    if (legalLabel && translations) {
        legalLabel.textContent = translations.legal_doc_label;
    }

    if (legalSourceLink) {
        legalSourceLink.setAttribute("href", legalDoc);
    }

    if (legalFooterLink) {
        legalFooterLink.setAttribute("href", legalDoc);
    }

    try {
        const response = await fetch(legalDoc, { cache: "no-store" });

        if (!response.ok) {
            throw new Error(`Falha ao carregar ${legalDoc}`);
        }

        const markdown = await response.text();
        const { html, headings } = renderMarkdown(markdown);

        legalContent.innerHTML = html;
        legalToc.innerHTML = headings.length
            ? headings.map((heading) => `<li><a href="#${heading.id}">${escapeHtml(heading.text)}</a></li>`).join("")
            : `<li><a href="${legalDoc}">${escapeHtml(translations?.legal_open_md || "Open official Markdown")}</a></li>`;
    } catch (error) {
        legalContent.innerHTML = `
            <h2>${escapeHtml(translations?.legal_error_title || "Error loading document")}</h2>
            <p>${escapeHtml(translations?.legal_error_text || "The official Markdown could not be rendered right now.")}</p>
            <p><a href="${legalDoc}">${escapeHtml(translations?.legal_error_link || "Open official Markdown file")}</a></p>
        `;
        legalToc.innerHTML = `<li><a href="${legalDoc}">${escapeHtml(translations?.legal_open_md || "Open official Markdown")}</a></li>`;
    }
});

function renderMarkdown(markdown) {
    const lines = markdown.replace(/\r\n/g, "\n").split("\n");
    const headings = [];
    const html = [];
    let paragraph = [];
    let listItems = [];

    const flushParagraph = () => {
        if (!paragraph.length) {
            return;
        }

        html.push(`<p>${renderInline(paragraph.join(" "))}</p>`);
        paragraph = [];
    };

    const flushList = () => {
        if (!listItems.length) {
            return;
        }

        html.push(`<ul>${listItems.map((item) => `<li>${renderInline(item)}</li>`).join("")}</ul>`);
        listItems = [];
    };

    for (const rawLine of lines) {
        const line = rawLine.trim();

        if (!line) {
            flushParagraph();
            flushList();
            continue;
        }

        const headingMatch = line.match(/^(#{1,6})\s+(.*)$/);
        if (headingMatch) {
            flushParagraph();
            flushList();
            const level = Math.min(headingMatch[1].length, 6);
            const text = headingMatch[2].trim();
            const id = slugify(text);
            headings.push({ id, text });
            html.push(`<h${level} id="${id}">${renderInline(text)}</h${level}>`);
            continue;
        }

        const boldHeadingMatch = line.match(/^\*\*(.+?)\*\*$/);
        if (boldHeadingMatch) {
            flushParagraph();
            flushList();
            const text = boldHeadingMatch[1].trim();
            const isFirstHeading = headings.length === 0;
            const level = isFirstHeading ? 1 : 2;
            const id = slugify(text);
            headings.push({ id, text });
            html.push(`<h${level} id="${id}">${renderInline(text)}</h${level}>`);
            continue;
        }

        const listMatch = line.match(/^-\s+(.*)$/);
        if (listMatch) {
            flushParagraph();
            listItems.push(listMatch[1].trim());
            continue;
        }

        if (line === "---") {
            flushParagraph();
            flushList();
            html.push("<hr>");
            continue;
        }

        paragraph.push(line);
    }

    flushParagraph();
    flushList();

    return { html: html.join(""), headings };
}

function renderInline(text) {
    let output = escapeHtml(text);

    output = output.replace(/\\([\\`*_{}\[\]()#+\-.!])/g, "$1");
    output = output.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
    output = output.replace(/\*(.+?)\*/g, "<em>$1</em>");
    output = output.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>');

    return output;
}

function slugify(text) {
    return text
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "");
}

function escapeHtml(text) {
    return text
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
}
