// A small text formatter: paragraph, list and emphasis only. Never parse HTML.
export function renderReadable(document, target, value) {
  target.replaceChildren();
  const inline = (parent, text) => {
    for (const part of text.split(/(\*\*[^*\n]+\*\*)/g)) {
      if (part.startsWith('**') && part.endsWith('**') && part.length > 4) {
        const strong = document.createElement('strong'); strong.textContent = part.slice(2, -2); parent.append(strong);
      } else parent.append(document.createTextNode(part));
    }
  };
  for (const paragraph of value.split(/\n\s*\n/)) {
    const lines = paragraph.trim().split('\n');
    if (!paragraph.trim()) continue;
    if (lines.every(line => /^\s*[-*]\s+/.test(line))) {
      const list = document.createElement('ul');
      for (const line of lines) { const item = document.createElement('li'); inline(item, line.replace(/^\s*[-*]\s+/, '')); list.append(item); }
      target.append(list);
    } else {
      const node = document.createElement('p');
      lines.forEach((line, index) => { if (index) node.append(document.createElement('br')); inline(node, line); });
      target.append(node);
    }
  }
}
