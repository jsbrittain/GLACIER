import { useMemo, useRef, useEffect } from 'react';
import { Box } from '@mui/material';
import AnsiToHtml from 'ansi-to-html';
import DOMPurify from 'dompurify';

const converter = new AnsiToHtml({ fg: '#ccc', bg: '#000', newline: true, escapeXML: true, stream: true });

export default function AnsiLog({ text }) {
  const html = useMemo(() => {
    const raw = converter.toHtml(text || '');
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
        overflow: 'auto',
        padding: '12px',
        borderRadius: 8,
        height: '400px',
      }}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
