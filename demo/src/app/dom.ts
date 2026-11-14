/** Small DOM helpers: typed element creation without a framework. */

export type Child = Node | string | number | null | undefined | false;
export type Attrs = Readonly<Record<string, string | number | boolean | undefined>>;

/**
 * Creates an element. `class` sets the class name, a `true` attribute is set
 * empty, and `false`/`undefined` attributes are left off.
 */
export function h<K extends keyof HTMLElementTagNameMap>(tag: K, attrs?: Attrs | null, ...children: Child[]): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (attrs) {
    for (const [name, value] of Object.entries(attrs)) {
      if (value === undefined || value === false) continue;
      if (name === 'class') node.className = String(value);
      else node.setAttribute(name, value === true ? '' : String(value));
    }
  }
  append(node, children);
  return node;
}

export function append(parent: Node, children: readonly Child[]): void {
  for (const child of children) {
    if (child === null || child === undefined || child === false) continue;
    parent.appendChild(typeof child === 'object' ? child : document.createTextNode(String(child)));
  }
}

export function clear(node: Node): void {
  while (node.firstChild) node.removeChild(node.firstChild);
}

/** A `<button type="button">` with a click handler. */
export function button(label: Child, onClick: () => void, attrs?: Attrs): HTMLButtonElement {
  const node = h('button', { type: 'button', ...attrs }, label);
  node.addEventListener('click', onClick);
  return node;
}
