// FilePathControl.tsx
import React from 'react';
import { withJsonFormsControlProps } from '@jsonforms/react';
import { ControlProps, isDescriptionHidden } from '@jsonforms/core';
import { TextField, IconButton, Stack } from '@mui/material';
import { Box } from '@mui/system';
import FileOpenIcon from '@mui/icons-material/FileOpen';
import FolderOpenIcon from '@mui/icons-material/FolderOpen';

const toFilters = (accept?: string): Electron.FileFilter[] | undefined => {
  // accept like ".csv,.fastq,.fastq.gz,application/json"
  if (!accept) return undefined;
  const exts = accept
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  if (!exts.length) return undefined;
  return [
    {
      name: 'Accepted',
      extensions: exts
        .map((e) => (e.startsWith('.') ? e.slice(1) : e)) // ".csv" -> "csv"
        .filter((e) => !e.includes('/')) // drop MIME types
    }
  ];
};

function InnerFilePathControl(props: ControlProps) {
  const {
    data,
    handleChange,
    path,
    label,
    required,
    visible = true,
    enabled = true,
    id,
    config,
    uischema,
    schema,
    errors
  } = props;

  if (!visible) return null;

  const description =
    (uischema as any)?.options?.description ?? schema?.description ?? (schema as any)?.help_text;

  const showDesc = !isDescriptionHidden(visible, description, config);

  type PickerMode = 'file' | 'directory' | 'both';

  const picker: PickerMode = (() => {
    switch (schema?.format) {
      case 'directory-path':
        return 'directory';
      case 'file-path':
        return 'file';
      case 'path':
        return 'both';
      default:
        return 'both';
    }
  })();

  const pick = async () => {
    const accept = (uischema as any)?.options?.accept as string | undefined;
    const filters = picker === 'directory' ? undefined : toFilters(accept);

    let picked: string | undefined;

    switch (picker) {
      case 'directory':
        picked = await window.electronAPI.pickDirectory();
        break;

      case 'file':
        picked = await window.electronAPI.pickFile(filters);
        break;

      case 'both':
        picked = await window.electronAPI.pickFileOrDirectory({ filters });
        break;
    }

    if (picked) {
      handleChange(path, picked);
    }
  };

  return (
    <Stack
      direction="row"
      spacing={1}
      sx={{ opacity: enabled ? 1 : 0.6 }}
      alignItems="flex-start" // top-align the children
    >
      {/* Left: field + helper text */}
      <Box sx={{ flexGrow: 1 }}>
        <TextField
          id={id}
          label={label}
          value={data ?? ''}
          required={required}
          InputProps={{ readOnly: true }}
          disabled={!enabled}
          error={Boolean(errors)}
          helperText={errors || (showDesc ? description : undefined)}
          size="small"
          fullWidth
        />
      </Box>

      {/* Right: icon, top-aligned with the field */}
      <Box sx={{ display: 'flex', alignItems: 'flex-start' }}>
        <IconButton onClick={pick} disabled={!enabled}>
          {picker === 'directory' ? <FolderOpenIcon /> : <FileOpenIcon />}
        </IconButton>
      </Box>
    </Stack>
  );
}

export const FilePathControl = withJsonFormsControlProps(InnerFilePathControl);
