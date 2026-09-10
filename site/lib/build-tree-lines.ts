import type { ArchiveEntry } from './types';

interface TreeNode {
  name: string;
  children: Map<string, TreeNode>;
  isFile: boolean;
}

function buildTree(entries: ArchiveEntry[]): TreeNode {
  const root: TreeNode = { name: '', children: new Map(), isFile: false };
  for (const entry of entries) {
    const parts = entry.path.split('/');
    let node = root;
    parts.forEach((part, i) => {
      const isFile = i === parts.length - 1;
      let child = node.children.get(part);
      if (!child) {
        child = { name: part, children: new Map(), isFile };
        node.children.set(part, child);
      }
      node = child;
    });
  }
  return root;
}

function renderNode(node: TreeNode, prefix: string, lines: string[]) {
  const children = Array.from(node.children.values());
  children.forEach((child, i) => {
    const isLast = i === children.length - 1;
    const connector = isLast ? '└── ' : '├── ';
    const label = child.isFile ? child.name : `${child.name}/`;
    lines.push(`${prefix}${connector}${label}`);
    if (!child.isFile) {
      renderNode(child, prefix + (isLast ? '    ' : '│   '), lines);
    }
  });
}

// Renders a flat archive file list (§5.1's archiveTree) as directory-tree
// text lines, matching the box-drawing style shown in the mockups.
export function buildTreeLines(entries: ArchiveEntry[]): string[] {
  const root = buildTree(entries);
  const lines: string[] = [];
  renderNode(root, '', lines);
  return lines;
}
