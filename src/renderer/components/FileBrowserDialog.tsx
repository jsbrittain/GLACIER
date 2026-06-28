import React, { useState, useEffect, useCallback } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  IconButton,
  Typography,
  Box,
  TextField,
  Checkbox,
  FormControlLabel,
  LinearProgress,
  Breadcrumbs,
  Link,
  Chip
} from '@mui/material';
import FolderIcon from '@mui/icons-material/Folder';
import InsertDriveFileIcon from '@mui/icons-material/InsertDriveFile';
import ArrowUpwardIcon from '@mui/icons-material/ArrowUpward';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import CreateNewFolderIcon from '@mui/icons-material/CreateNewFolder';

interface FileEntry {
  name: string;
  path: string;
  isDirectory: boolean;
  size: number;
  modifiedAt: string;
}

interface ListResponse {
  ok: boolean;
  data?: {
    current: string;
    parent: string | null;
    entries: FileEntry[];
    total: number;
    offset: number;
    limit: number;
  };
  error?: { message: string };
}

interface FileBrowserDialogProps {
  open: boolean;
  mode: 'file' | 'directory' | 'both' | 'save';
  filters?: { name: string; extensions: string[] }[];
  defaultPath?: string;
  onClose: (path: string | null) => void;
}

const PAGE_SIZE = 100;

function formatSize(bytes: number): string {
  if (bytes === 0) return '-';
  const units = ['B', 'KB', 'MB', 'GB'];
  let i = 0;
  let size = bytes;
  while (size >= 1024 && i < units.length - 1) {
    size /= 1024;
    i++;
  }
  return `${size.toFixed(1)} ${units[i]}`;
}

function formatDate(iso: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export default function FileBrowserDialog({ open, mode, filters, defaultPath, onClose }: FileBrowserDialogProps) {
  const [currentPath, setCurrentPath] = useState('');
  const [parentPath, setParentPath] = useState<string | null>(null);
  const [entries, setEntries] = useState<FileEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedPath, setSelectedPath] = useState<string | null>(null);
  const [showHidden, setShowHidden] = useState(false);
  const [filename, setFilename] = useState(
    defaultPath && isSaveMode ? defaultPath.split('/').pop() ?? '' : ''
  );
  const [history, setHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');

  const isSaveMode = mode === 'save';

  const matchesFilter = useCallback((entry: FileEntry): boolean => {
    if (entry.isDirectory) return true;
    if (!filters || filters.length === 0) return true;
    return filters.some((f) =>
      f.extensions.some((ext) => {
        if (ext === '*') return true;
        return entry.name.toLowerCase().endsWith('.' + ext.toLowerCase());
      })
    );
  }, [filters]);

  const canSelect = useCallback((entry: FileEntry): boolean => {
    if (mode === 'directory') return entry.isDirectory;
    if (mode === 'file') return !entry.isDirectory && matchesFilter(entry);
    if (mode === 'both') return matchesFilter(entry);
    if (mode === 'save') return entry.isDirectory;
    return false;
  }, [mode, matchesFilter]);

  const getDialogTitle = (): string => {
    switch (mode) {
      case 'file': return 'Select File';
      case 'directory': return 'Select Directory';
      case 'both': return 'Select File or Directory';
      case 'save': return 'Save As';
    }
  };

  const loadDir = useCallback(async (dirPath: string, reset = true) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/fs-list', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: dirPath, offset: 0, limit: PAGE_SIZE, showHidden })
      });
      const result: ListResponse = await res.json();
      if (!result.ok) {
        setError(result.error?.message ?? 'Failed to list directory');
        return;
      }
      setCurrentPath(result.data!.current);
      setParentPath(result.data!.parent);
      setEntries(result.data!.entries);
      setTotal(result.data!.total);
      setOffset(result.data!.offset + result.data!.limit);
      if (reset) setSelectedPath(null);
    } catch (err: any) {
      setError(err.message ?? 'Network error');
    } finally {
      setLoading(false);
    }
  }, [showHidden]);

  const navigateTo = useCallback((dirPath: string) => {
    setHistory(prev => [...prev.slice(0, historyIndex + 1), dirPath]);
    setHistoryIndex(prev => prev + 1);
    loadDir(dirPath);
  }, [historyIndex, loadDir]);

  const goUp = useCallback(() => {
    if (parentPath) navigateTo(parentPath);
  }, [parentPath, navigateTo]);

  const goBack = useCallback(() => {
    if (historyIndex > 0) {
      const idx = historyIndex - 1;
      setHistoryIndex(idx);
      loadDir(history[idx], false);
    }
  }, [historyIndex, history, loadDir]);

  const goForward = useCallback(() => {
    if (historyIndex < history.length - 1) {
      const idx = historyIndex + 1;
      setHistoryIndex(idx);
      loadDir(history[idx], false);
    }
  }, [historyIndex, history, loadDir]);

  const loadMore = useCallback(async () => {
    if (offset >= total || loading) return;
    setLoading(true);
    try {
      const res = await fetch('/api/fs-list', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: currentPath, offset, limit: PAGE_SIZE, showHidden })
      });
      const result: ListResponse = await res.json();
      if (!result.ok) {
        setError(result.error?.message ?? 'Failed to load more');
        return;
      }
      setEntries(prev => [...prev, ...result.data!.entries]);
      setOffset(result.data!.offset + result.data!.limit);
    } catch (err: any) {
      setError(err.message ?? 'Network error');
    } finally {
      setLoading(false);
    }
  }, [offset, total, loading, currentPath, showHidden]);

  const handleCreateFolder = useCallback(async () => {
    setNewFolderName('');
    setShowCreateDialog(true);
  }, []);

  const handleCreateFolderConfirm = useCallback(async () => {
    if (!newFolderName.trim()) return;
    setShowCreateDialog(false);
    try {
      const res = await fetch('/api/fs-mkdir', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: currentPath + '/' + newFolderName.trim() })
      });
      const result = await res.json();
      if (!result.ok) {
        setError(
          'Failed to create folder: ' + (result.error?.message ?? 'Unknown error')
        );
      } else {
        loadDir(currentPath, true);
      }
    } catch (err: any) {
      setError('Failed to create folder: ' + (err.message ?? 'Unknown error'));
    }
  }, [newFolderName, currentPath, loadDir]);

  useEffect(() => {
    if (!open) return;
    (async () => {
      try {
        const homeRes = await fetch('/api/fs-home', { method: 'POST' });
        const homeResult = await homeRes.json();
        const startPath = homeResult.ok ? homeResult.data : '/';
        setHistory([startPath]);
        setHistoryIndex(0);
        await loadDir(startPath);
      } catch (err: any) {
        setError(err.message ?? 'Failed to get home directory');
      }
    })();
  }, [open, loadDir]);

  useEffect(() => {
    if (showHidden && currentPath) {
      loadDir(currentPath, true);
    } else if (!showHidden && currentPath) {
      loadDir(currentPath, true);
    }
  }, [showHidden]);

  const handleEntryClick = (entry: FileEntry) => {
    if (entry.isDirectory) {
      navigateTo(entry.path);
    } else if (canSelect(entry)) {
      setSelectedPath(selectedPath === entry.path ? null : entry.path);
    }
  };

  const handleEntryDoubleClick = (entry: FileEntry) => {
    if (entry.isDirectory) {
      navigateTo(entry.path);
    }
  };

  const handleConfirm = () => {
    if (isSaveMode) {
      const fullPath = currentPath + (currentPath.endsWith('/') ? '' : '/') + filename;
      if (!filename.trim()) return;
      onClose(fullPath);
    } else if (selectedPath) {
      onClose(selectedPath);
    }
  };

  const pathSegments = currentPath.split('/').filter(Boolean);
  const breadcrumbPaths = pathSegments.reduce<string[]>((acc, seg) => {
    const prev = acc.length > 0 ? acc[acc.length - 1] : '';
    acc.push(prev + '/' + seg);
    return acc;
  }, []);

  const displayedEntries = isSaveMode
    ? entries.filter(e => e.isDirectory)
    : mode === 'directory'
      ? entries.filter(e => e.isDirectory)
      : mode === 'file'
        ? entries.filter(e => !e.isDirectory && matchesFilter(e))
        : entries.filter(e => matchesFilter(e));

  const confirmDisabled = isSaveMode ? !filename.trim() : !selectedPath;

  return (
    <><Dialog open={open} onClose={() => onClose(null)} maxWidth="md" fullWidth>
      <DialogTitle>{getDialogTitle()}</DialogTitle>
      <DialogContent dividers sx={{ display: 'flex', flexDirection: 'column', minHeight: 400 }}>
        {error && (
          <Typography color="error" sx={{ mb: 1 }}>
            {error}
          </Typography>
        )}

        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 1 }}>
          <IconButton size="small" onClick={goBack} disabled={historyIndex <= 0}>
            <ArrowBackIcon fontSize="small" />
          </IconButton>
          <IconButton size="small" onClick={goForward} disabled={historyIndex >= history.length - 1}>
            <ArrowForwardIcon fontSize="small" />
          </IconButton>
          <IconButton size="small" onClick={goUp} disabled={!parentPath}>
            <ArrowUpwardIcon fontSize="small" />
          </IconButton>
          <IconButton size="small" onClick={handleCreateFolder} title="New Folder">
            <CreateNewFolderIcon fontSize="small" />
          </IconButton>
          <Breadcrumbs sx={{ flexGrow: 1, ml: 1 }} maxItems={4}>
            <Link
              component="button"
              underline="hover"
              color="text.primary"
              onClick={() => navigateTo(currentPath.startsWith('/') ? '/' : breadcrumbPaths[0]?.split('/')[0] ?? '/')}
              sx={{ fontSize: '0.875rem' }}
            >
              /
            </Link>
            {breadcrumbPaths.map((p, i) => (
              <Link
                key={p}
                component="button"
                underline="hover"
                color={i === breadcrumbPaths.length - 1 ? 'text.primary' : 'text.secondary'}
                onClick={() => navigateTo(p)}
                sx={{ fontSize: '0.875rem' }}
              >
                {pathSegments[i]}
              </Link>
            ))}
          </Breadcrumbs>
        </Box>

        <FormControlLabel
          control={
            <Checkbox
              size="small"
              checked={showHidden}
              onChange={(e) => setShowHidden(e.target.checked)}
            />
          }
          label={<Typography variant="caption">Show hidden files</Typography>}
          sx={{ mb: 0.5 }}
        />

        {loading && <LinearProgress sx={{ mb: 0.5 }} />}

        <Box sx={{ flexGrow: 1, overflow: 'auto', border: 1, borderColor: 'divider', borderRadius: 1 }}>
          <List dense disablePadding>
            {parentPath && (
              <ListItem
                component="div"
                onClick={goUp}
                sx={{ cursor: 'pointer', '&:hover': { bgcolor: 'action.hover' } }}
              >
                <ListItemIcon sx={{ minWidth: 36 }}>
                  <ArrowUpwardIcon fontSize="small" />
                </ListItemIcon>
                <ListItemText primary=".." />
              </ListItem>
            )}
            {displayedEntries.length === 0 && !loading && (
              <ListItem>
                <ListItemText
                  primary={<Typography color="text.secondary" variant="body2">(empty)</Typography>}
                />
              </ListItem>
            )}
            {displayedEntries.map((entry) => {
              const sel = selectedPath === entry.path;
              const canSel = canSelect(entry);
              return (
                <ListItem
                  key={entry.path}
                  component="div"
                  selected={sel}
                  onClick={() => handleEntryClick(entry)}
                  onDoubleClick={() => handleEntryDoubleClick(entry)}
                  sx={{
                    cursor: canSel || entry.isDirectory ? 'pointer' : 'default',
                    opacity: canSel || entry.isDirectory ? 1 : 0.5,
                    '&:hover': { bgcolor: 'action.hover' },
                    '&.Mui-selected': { bgcolor: 'action.selected' }
                  }}
                >
                  <ListItemIcon sx={{ minWidth: 36 }}>
                    {entry.isDirectory ? <FolderIcon fontSize="small" color="primary" /> : <InsertDriveFileIcon fontSize="small" />}
                  </ListItemIcon>
                  <ListItemText
                    primary={entry.name}
                    secondary={!entry.isDirectory ? `${formatSize(entry.size)}  ${formatDate(entry.modifiedAt)}` : ''}
                    primaryTypographyProps={{ variant: 'body2', noWrap: true }}
                    secondaryTypographyProps={{ variant: 'caption' }}
                  />
                  {!entry.isDirectory && (
                    <Chip
                      label={formatSize(entry.size)}
                      size="small"
                      variant="outlined"
                      sx={{ ml: 1, fontSize: '0.7rem' }}
                    />
                  )}
                </ListItem>
              );
            })}
          </List>
        </Box>

        {offset < total && (
          <Box sx={{ textAlign: 'center', mt: 1 }}>
            <Button size="small" onClick={loadMore} disabled={loading} variant="outlined">
              Load more ({total - offset} remaining)
            </Button>
          </Box>
        )}

        {isSaveMode && (
          <Box sx={{ mt: 2 }}>
            <TextField
              fullWidth
              size="small"
              label="Filename"
              placeholder="Enter filename"
              value={filename}
              onChange={(e) => setFilename(e.target.value)}
              autoFocus
            />
          </Box>
        )}

        {selectedPath && !isSaveMode && (
          <Typography variant="caption" color="text.secondary" sx={{ mt: 1 }}>
            Selected: {selectedPath}
          </Typography>
        )}

        {isSaveMode && filename.trim() && (
          <Typography variant="caption" color="text.secondary" sx={{ mt: 1 }}>
            Save as: {currentPath}{currentPath.endsWith('/') ? '' : '/'}{filename}
          </Typography>
        )}
      </DialogContent>

      <DialogActions>
        <Button onClick={() => onClose(null)}>Cancel</Button>
        <Button onClick={handleConfirm} variant="contained" disabled={confirmDisabled}>
          {isSaveMode ? 'Save' : 'Select'}
        </Button>
      </DialogActions>
    </Dialog>
    <Dialog open={showCreateDialog} onClose={() => setShowCreateDialog(false)} maxWidth="xs" fullWidth>
      <DialogTitle>New Folder</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            fullWidth
            size="small"
            label="Folder name"
            sx={{ mt: 1 }}
          value={newFolderName}
          onChange={(e) => setNewFolderName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') handleCreateFolderConfirm();
          }}
        />
      </DialogContent>
      <DialogActions>
        <Button onClick={() => setShowCreateDialog(false)}>Cancel</Button>
        <Button onClick={handleCreateFolderConfirm} variant="contained" disabled={!newFolderName.trim()}>
          Create
        </Button>
      </DialogActions>
    </Dialog>
    </>
  );
}
