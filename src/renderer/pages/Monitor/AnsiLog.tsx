import { useMemo, useRef, useEffect } from 'react';
import { Box } from '@mui/material';
import AnsiToHtml from 'ansi-to-html';
import DOMPurify from 'dompurify';

const converter = new AnsiToHtml({
  fg: '#ccc',
  bg: '#000',
  newline: true,
  escapeXML: true,
  stream: false
});

// Strip terminal control sequences that ansi-to-html does not render:
// OSC (Operating System Command) sequences (e.g. OSC 8 hyperlinks) and
// cursor-visibility codes (e.g. \x1b[?25l). SGR colour codes are kept.
const stripUnsupportedCodes = (text: string) =>
  text.replace(/\x1b\][^\x07\x1b]*(?:\x07|\x1b\\)/g, '').replace(/\x1b\[\?[0-9]*[hl]/g, '');

export default function AnsiLog({ text }) {
  const html = useMemo(() => {
    const raw = converter.toHtml(stripUnsupportedCodes(text || ''));
    return DOMPurify.sanitize(raw);
  }, [text]);

  const ref = useRef(null);
  useEffect(() => {
    // auto-scroll to bottom when new text arrives
    if (ref.current) ref.current.scrollTop = ref.current.scrollHeight;
  }, [html]);

  return (
    <Box
      ref={ref}
      style={{
        background: '#333333',
        color: '#cccccc',
        fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
        whiteSpace: 'pre-wrap',
        wordBreak: 'break-word',
        overflow: 'auto',
        maxWidth: '100%',
        padding: '12px',
        borderRadius: 8,
        height: '400px'
      }}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
