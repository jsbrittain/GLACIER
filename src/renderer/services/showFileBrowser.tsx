import { createRoot } from 'react-dom/client';
import { createTheme, ThemeProvider } from '@mui/material/styles';
import { CssBaseline } from '@mui/material';
import FileBrowserDialog from '../components/FileBrowserDialog';

export interface FileBrowserOptions {
  mode: 'file' | 'directory' | 'both' | 'save';
  filters?: { name: string; extensions: string[] }[];
  defaultFilename?: string;
}

interface FileBrowserResult {
  ok: boolean;
  data?: string;
  error?: { message: string };
}

const theme = createTheme();

export function showFileBrowser(options: FileBrowserOptions): Promise<FileBrowserResult> {
  return new Promise((resolve) => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);

    const handleClose = (path: string | null) => {
      root.unmount();
      document.body.removeChild(container);
      if (path) {
        resolve({ ok: true, data: path });
      } else {
        resolve({ ok: false, error: { message: 'User cancelled' } });
      }
    };

    root.render(
      <ThemeProvider theme={theme}>
        <CssBaseline />
        <FileBrowserDialog
          open={true}
          mode={options.mode}
          filters={options.filters}
          defaultPath={options.defaultFilename}
          onClose={handleClose}
        />
      </ThemeProvider>
    );
  });
}
