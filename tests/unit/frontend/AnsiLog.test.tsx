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
