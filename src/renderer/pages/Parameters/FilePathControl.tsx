// FilePathControl.tsx
import React, { useCallback, useRef, useState } from 'react';
import { withJsonFormsControlProps } from '@jsonforms/react';
import { ControlProps, isDescriptionHidden } from '@jsonforms/core';
import {
  FormControl,
  InputLabel,
  OutlinedInput,
  IconButton,
  Stack,
  FormHelperText,
  Typography
} from '@mui/material';
import { Box } from '@mui/system';
import FileOpenIcon from '@mui/icons-material/FileOpen';
import FolderOpenIcon from '@mui/icons-material/FolderOpen';
import CloudUploadOutlined from '@mui/icons-material/CloudUploadOutlined';
import { API } from '../../services/api.js';

function useFocus(): [boolean, () => void, () => void] {
  const [focused, setFocused] = useState(false);
  const onFocus = useCallback(() => setFocused(true), []);
  const onBlur = useCallback(() => setFocused(false), []);
  return [focused, onFocus, onBlur];
}

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
    description,
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

  const [focused, onFocus, onBlur] = useFocus();
  const isValid = errors.length === 0;
  const appliedUiSchemaOptions = { ...(config as any), ...(uischema as any)?.options };
  const showUnfocusedDescription = appliedUiSchemaOptions.showUnfocusedDescription;
  const hideRequiredAsterisk = appliedUiSchemaOptions.hideRequiredAsterisk;
  const showDescription = !isDescriptionHidden(
    visible,
    description,
    focused,
    showUnfocusedDescription
  );
  const firstFormHelperText = showDescription ? description : !isValid ? errors : null;
  const secondFormHelperText = showDescription && !isValid ? errors : null;

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

  const [isDragOver, setIsDragOver] = useState(false);
  const dragCounter = useRef(0);

  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current++;
    if (e.dataTransfer.items?.length > 0) {
      setIsDragOver(true);
    }
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current--;
    if (dragCounter.current === 0) {
      setIsDragOver(false);
    }
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragOver(false);
      dragCounter.current = 0;

      if (!enabled) return;

      const files = e.dataTransfer.files;
      if (!files?.length) return;

      const droppedPath = (files[0] as any).path ?? files[0].name;
      if (droppedPath) {
        handleChange(path, droppedPath);
      }
    },
    [enabled, handleChange, path]
  );

  const pickFile = async () => {
    const accept = (uischema as any)?.options?.accept as string | undefined;
    const filters = toFilters(accept);
    const result = await API.pickFile(filters);

    if (result?.ok && result.data) {
      handleChange(path, result.data);
    }
  };

  const pickFolder = async () => {
    const result = await API.pickDirectory();

    if (result?.ok && result.data) {
      handleChange(path, result.data);
    }
  };

  return (
    <FormControl
      size="small"
      error={!isValid}
      disabled={!enabled}
      required={required}
      onFocus={onFocus}
      onBlur={onBlur}
      id={id}
      fullWidth
    >
      <InputLabel
        htmlFor={`${id}-input`}
        error={!isValid}
        required={required && !hideRequiredAsterisk}
      >
        {label}
      </InputLabel>
      <Box
        onDragEnter={handleDragEnter}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        sx={{
          position: 'relative',
          borderRadius: '4px',
          border: isDragOver ? '2px dashed' : '2px solid transparent',
          borderColor: isDragOver ? 'primary.main' : 'transparent',
          bgcolor: isDragOver ? 'action.hover' : 'transparent',
          transition: 'border-color 0.15s, background-color 0.15s'
        }}
      >
        <Stack
          direction="row"
          spacing={1}
          sx={{ opacity: enabled ? 1 : 0.6 }}
          alignItems="flex-start"
        >
          <Box sx={{ flexGrow: 1 }}>
            <OutlinedInput
              id={`${id}-input`}
              value={data ?? ''}
              readOnly
              label={label}
              size="small"
              fullWidth
            />
          </Box>
          <Box sx={{ display: 'flex', alignItems: 'flex-start' }}>
            {picker === 'both' ? (
              <>
                <IconButton onClick={pickFile} disabled={!enabled} title="Select file">
                  <FileOpenIcon />
                </IconButton>
                <IconButton onClick={pickFolder} disabled={!enabled} title="Select folder">
                  <FolderOpenIcon />
                </IconButton>
              </>
            ) : (
              <IconButton
                onClick={picker === 'directory' ? pickFolder : pickFile}
                disabled={!enabled}
                title={picker === 'directory' ? 'Select folder' : 'Select file'}
              >
                {picker === 'directory' ? <FolderOpenIcon /> : <FileOpenIcon />}
              </IconButton>
            )}
          </Box>
        </Stack>
        {isDragOver && (
          <Box
            sx={{
              position: 'absolute',
              inset: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 0.5,
              pointerEvents: 'none',
              zIndex: 1
            }}
          >
            <CloudUploadOutlined color="primary" fontSize="small" />
            <Typography variant="body2" color="primary">
              {picker === 'file'
                ? 'Drop file'
                : picker === 'directory'
                  ? 'Drop folder'
                  : 'Drop file or folder'}
            </Typography>
          </Box>
        )}
      </Box>
      <FormHelperText error={!isValid && !showDescription}>{firstFormHelperText}</FormHelperText>
      {secondFormHelperText && <FormHelperText error>{secondFormHelperText}</FormHelperText>}
    </FormControl>
  );
}

export const FilePathControl = withJsonFormsControlProps(InnerFilePathControl);
