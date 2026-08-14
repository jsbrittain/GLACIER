import React from 'react';
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import AnsiLog from '../../../src/renderer/pages/Monitor/AnsiLog';

describe('AnsiLog', () => {
  it('renders plain text', () => {
    const { container } = render(<AnsiLog text="hello world" />);
    expect(container.textContent).toBe('hello world');
  });

  it('converts ANSI escape sequences to styled HTML', () => {
    const { container } = render(<AnsiLog text="\x1b[31mred\x1b[0m" />);
    expect(container.innerHTML).toContain('red');
    expect(container.innerHTML).toContain('color:');
  });

  it('strips OSC 8 hyperlink sequences', () => {
    const { container } = render(
      <AnsiLog text={'\x1b]8;;file:///tmp/work\x1b\\[a8/dbcf3f] foo\x1b]8;;\x1b\\'} />
    );
    expect(container.textContent).toBe('[a8/dbcf3f] foo');
    expect(container.textContent).not.toContain(']8;;');
  });

  it('strips OSC sequences terminated by BEL', () => {
    const { container } = render(<AnsiLog text={'\x1b]0;title\x07hello'} />);
    expect(container.textContent).toBe('hello');
  });

  it('strips cursor-visibility codes', () => {
    const { container } = render(<AnsiLog text={'\x1b[?25lfoo\x1b[?25h'} />);
    expect(container.textContent).toBe('foo');
  });

  it('preserves colour codes alongside stripped OSC sequences', () => {
    const { container } = render(
      <AnsiLog text={'\x1b]8;;file:///tmp/work\x1b\\\x1b[1;34m[a8/dbcf3f]\x1b[0m\x1b]8;;\x1b\\'} />
    );
    expect(container.textContent).toBe('[a8/dbcf3f]');
    expect(container.innerHTML).toContain('color:');
  });

  it('escapes dangerous HTML (XSS)', () => {
    const { container } = render(<AnsiLog text='<img src=x onerror="alert(1)">' />);
    // ansi-to-html escapes HTML entities, so the tag is rendered as text
    expect(container.innerHTML).toContain('&lt;img');
  });

  it('renders empty string gracefully', () => {
    const { container } = render(<AnsiLog text="" />);
    expect(container.textContent).toBe('');
  });
});
