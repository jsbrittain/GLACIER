// Markdown rendering
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkDirective from 'remark-directive';
import rehypeRaw from 'rehype-raw';
import rehypeSanitize from 'rehype-sanitize';
import { defaultSchema } from 'hast-util-sanitize';
import { remarkAdmonitions } from './remarkAdmonitions';
import './markdown.css';
import { API } from '../../services/api.js';

const sanitizeSchema = {
  ...defaultSchema,
  tagNames: [...(defaultSchema.tagNames || []), 'div', 'img'],
  attributes: {
    ...defaultSchema.attributes,
    div: ['className', 'align'],
    img: ['src', 'alt', 'width', 'height']
  }
};

function isWebPageLink(href) {
  if (!href) return false;
  return /^https?:\/\//i.test(href) || /\.(html?|xhtml)$/i.test(href);
}

export default function MarkdownRenderer({ content, basePath }) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm, remarkDirective, remarkAdmonitions]}
      rehypePlugins={[rehypeRaw, [rehypeSanitize, sanitizeSchema]]}
      components={{

        // Image
        img({ src = '', alt, ...props }) {
          const isExternal =
            src.startsWith('http://') || src.startsWith('https://') || src.startsWith('data:');

          const resolvedSrc = isExternal
            ? src
            : src.startsWith('/')
              ? `${basePath}${src}`
              : `${basePath}/${src}`;

          return <img {...props} src={resolvedSrc} alt={alt ?? ''} style={{ maxWidth: '100%' }} />;
        },

        // Link
        a({ href = '', children, ...props }) {
          const handleClick = (e) => {
            if (href.startsWith('#')) return;

            e.preventDefault();

            if (isWebPageLink(href)) {
              const url = href.startsWith('http')
                ? href
                : href.startsWith('/')
                  ? `${basePath}/${href}`
                  : `${basePath}/${href}`;

              API.openWebPage(url);
            }
          };

          return (
            <a {...props} href={href} onClick={handleClick} style={{ cursor: 'pointer' }}>
              {children}
            </a>
          );

        }
      }}
    >
      {content}
    </ReactMarkdown>
  );
}
