import { describe, it, expect } from 'vitest';
import { remark } from 'remark';
import remarkDirective from 'remark-directive';
import { remarkAdmonitions } from '../../../src/renderer/pages/Parameters/remarkAdmonitions';

describe('remarkAdmonitions', () => {
  it('converts GitHub NOTE admonition to containerDirective', () => {
    const tree = remark().parse('> [!NOTE]\n> This is a note.');
    const root = remark().use(remarkAdmonitions).runSync(tree);
    const child = (root as any).children[0];
    expect(child.type).toBe('containerDirective');
    expect(child.name).toBe('note');
  });

  it('converts GitHub WARNING admonition', () => {
    const tree = remark().parse('> [!WARNING]\n> Careful!');
    const root = remark().use(remarkAdmonitions).runSync(tree);
    expect((root as any).children[0].name).toBe('warning');
  });

  it('converts GitHub TIP admonition', () => {
    const tree = remark().parse('> [!TIP]\n> Try this.');
    const root = remark().use(remarkAdmonitions).runSync(tree);
    expect((root as any).children[0].name).toBe('tip');
  });

  it('converts GitHub IMPORTANT admonition', () => {
    const tree = remark().parse('> [!IMPORTANT]\n> Essential.');
    const root = remark().use(remarkAdmonitions).runSync(tree);
    expect((root as any).children[0].name).toBe('important');
  });

  it('converts GitHub INFO admonition', () => {
    const tree = remark().parse('> [!INFO]\n> FYI.');
    const root = remark().use(remarkAdmonitions).runSync(tree);
    expect((root as any).children[0].name).toBe('info');
  });

  it('converts Remark-style :::note admonition', () => {
    const md = ':::note\nHello\n:::';
    const tree = remark().use(remarkDirective).parse(md);
    const root = remark().use(remarkAdmonitions).runSync(tree);
    const child = (root as any).children[0];
    expect(child.data?.hProperties?.className).toContain('admonition-note');
  });

  it('does not convert plain blockquotes', () => {
    const tree = remark().parse('> Just a quote.');
    const root = remark().use(remarkAdmonitions).runSync(tree);
    expect((root as any).children[0].type).toBe('blockquote');
  });

  it('does not convert unknown admonition types', () => {
    const tree = remark().parse('> [!FOO]\n> Unknown');
    const root = remark().use(remarkAdmonitions).runSync(tree);
    expect((root as any).children[0].type).toBe('blockquote');
  });
});
