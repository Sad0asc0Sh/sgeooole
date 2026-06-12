/**
 * Renders a simple markdown-like syntax into scoped HTML.
 * Used to prevent administrative HTML input from breaking page layouts.
 */
export function renderContent(text: string): string {
    if (!text) return '<div class="cms-content"></div>';

    // 1. Inline patterns
    let html = text
        // Bold: **text** -> <strong>text</strong>
        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
        // Italic: *text* -> <em>text</em>
        .replace(/\*(.*?)\*/g, '<em>$1</em>')
        // Links: [text](url) -> <a href="url">text</a>
        .replace(/\[(.*?)\]\((.*?)\)/g, '<a href="$2">$1</a>');

    // 2. Block patterns
    // Split by double newlines into blocks
    const blocks = html.split(/\n\n+/);

    const renderedBlocks = blocks.map(block => {
        const trimmedBlock = block.trim();

        // H3: ### text -> <h3 class="cms-h3">text</h3>
        if (trimmedBlock.startsWith('### ')) {
            return `<h3 class="cms-h3">${trimmedBlock.substring(4)}</h3>`;
        }

        // H2: ## text -> <h2 class="cms-h2">text</h2>
        if (trimmedBlock.startsWith('## ')) {
            return `<h2 class="cms-h2">${trimmedBlock.substring(3)}</h2>`;
        }

        // List: ^- item -> <li class="cms-li">item</li>, wrap in <ul class="cms-ul">
        if (trimmedBlock.startsWith('^- ')) {
            const items = trimmedBlock.split('\n')
                .filter(line => line.trim().startsWith('^- '))
                .map(line => `<li class="cms-li">${line.trim().substring(3)}</li>`)
                .join('');
            return `<ul class="cms-ul">${items}</ul>`;
        }

        // Paragraph: Default text -> <p class="cms-p">text</p>
        // Handle single newlines as breaks within paragraph
        const pContent = trimmedBlock.replace(/\n/g, '<br />');
        return `<p class="cms-p">${pContent}</p>`;
    });

    return `<div class="cms-content">${renderedBlocks.join('')}</div>`;
}
