// Mapping of common icons to SVG paths
const ICON_PATHS: Record<string, string> = {
    'shopping-cart': '<path d="M2.25 3h1.386c.51 0 .955.343 1.087.835l.383 1.437M7.5 14.25a3 3 0 0 0-3 3h15.75m-12.75-3h11.218c1.121-2.3 2.1-4.684 2.924-7.138a60.114 60.114 0 0 0-16.536-1.84M7.5 14.25L5.106 5.272M6 20.25a.75.75 0 1 1-1.5 0 .75.75 0 0 1 1.5 0Zm12.75 0a.75.75 0 1 1-1.5 0 .75.75 0 0 1 1.5 0Z" />',
    'file-text': '<path d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5a1.125 1.125 0 0 1-1.125-1.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" />',
    'shield': '<path d="M9 12.75 11.25 15 15 9.75m-3-7.036A11.959 11.959 0 0 1 3.598 6 11.99 11.99 0 0 0 3 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751A11.956 11.956 0 0 1 12 2.714Z" />',
    'truck': '<path d="M8.25 18.75a1.5 1.5 0 0 1-3 0m3 0a1.5 1.5 0 0 0-3 0m3 0h6m-9 0H3.375a1.125 1.125 0 0 1-1.125-1.125V14.25m17.25 4.5a1.5 1.5 0 0 1-3 0m3 0a1.5 1.5 0 0 0-3 0m3 0h1.125c.621 0 1.129-.504 1.09-1.124a17.902 17.902 0 0 0-3.213-9.193 2.056 2.056 0 0 0-1.58-.806H14.25M16.5 18.75h-2.25m0-11.25v11.25m-9-11.25h9.75c.621 0 1.125.504 1.125 1.125V11.25a9 9 0 0 0-9 9M3.75 20.25h16.5" />'
};

export function renderContent(text: string): string {
    if (!text) return '<div class="cms-content"></div>';

    // 0. PRE-PROCESS: Strip HTML boilerplates if pasted
    let cleaned = text
        .replace(/<!DOCTYPE.*?>/gi, '')
        .replace(/<html.*?>/gi, '')
        .replace(/<\/html>/gi, '')
        .replace(/<head>[\s\S]*?<\/head>/gi, '')
        .replace(/<body.*?>/gi, '')
        .replace(/<\/body>/gi, '')
        .replace(/<style>[\s\S]*?<\/style>/gi, '')
        .trim();

    // 1. Inline patterns (Markdown)
    let html = cleaned
        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
        .replace(/\*(.*?)\*/g, '<em>$1</em>')
        .replace(/\[(.*?)\]\((.*?)\)/g, '<a href="$2">$1</a>');

    // 2. Block detection
    // If it looks like HTML (contains multiple tags), treat it as a single block
    if (html.includes('<div') || html.includes('<h1') || html.includes('<p ')) {
        return `<div class="cms-content">${html}</div>`;
    }

    const blocks = html.split(/\n\n+/);

    const renderedBlocks = blocks.map(block => {
        const trimmedBlock = block.trim();
        if (!trimmedBlock) return '';

        // 2a. CATEGORY HEADING
        if (trimmedBlock.startsWith('## ')) {
            let content = trimmedBlock.substring(3);
            let iconHtml = '';

            const iconMatch = content.match(/^\[(.*?)\]\s*(.*)/);
            if (iconMatch) {
                const iconName = iconMatch[1].toLowerCase();
                const titleText = iconMatch[2];
                const path = ICON_PATHS[iconName] || ICON_PATHS['file-text'];
                iconHtml = `<div class="cms-h2-icon"><svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor">${path}</svg></div>`;
                content = titleText;
            }

            return `<h2 class="cms-h2">${iconHtml}<span>${content}</span></h2>`;
        }

        // 2b. ACCORDION
        if (trimmedBlock.startsWith('> ')) {
            const lines = trimmedBlock.split('\n');
            const question = lines[0].substring(2).trim();
            const answer = lines.slice(1).join('\n').trim();

            return `
                <details class="cms-accordion">
                    <summary class="cms-summary"><span>${question}</span></summary>
                    <div class="cms-acc-content">${answer.replace(/\n/g, '<br />')}</div>
                </details>
            `;
        }

        // H3
        if (trimmedBlock.startsWith('### ')) {
            return `<h3 class="cms-h3">${trimmedBlock.substring(4)}</h3>`;
        }

        // List
        if (trimmedBlock.startsWith('^- ')) {
            const items = trimmedBlock.split('\n')
                .filter(line => line.trim().startsWith('^- '))
                .map(line => `<li class="cms-li">${line.trim().substring(3)}</li>`)
                .join('');
            return `<ul class="cms-ul">${items}</ul>`;
        }

        // Paragraph
        const pContent = trimmedBlock.replace(/\n/g, '<br />');
        return `<p class="cms-p">${pContent}</p>`;
    });

    return `<div class="cms-content">${renderedBlocks.join('')}</div>`;
}
