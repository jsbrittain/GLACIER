// FilePathControl.tsx
import React, { useCallback, useState } from 'react';
import { withJsonFormsControlProps } from '@jsonforms/react';
import { ControlProps, isDescriptionHidden } from '@jsonforms/core';
import {
  FormControl,
  InputLabel,
  OutlinedInput,
  IconButton,
  Stack,
  FormHelperText
} from '@mui/material';
import { Box } from '@mui/system';
import FileOpenIcon from '@mui/icons-material/FileOpen';
import FolderOpenIcon from '@mui/icons-material/FolderOpen';
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
  const firstFormHelperText = showDescription
    ? description
    : !isValid
    ? errors
    : null;
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

  const pick = async () => {
    const accept = (uischema as any)?.options?.accept as string | undefined;
    const filters = picker === 'directory' ? undefined : toFilters(accept);

    let result;

    switch (picker) {
      case 'directory':
        result = await API.pickDirectory();
        break;

      case 'file':
        result = await API.pickFile(filters);
        break;

      case 'both':
        result = await API.pickFileOrDirectory({ filters });
        break;
    }

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
          <IconButton onClick={pick} disabled={!enabled}>
            {picker === 'directory' ? <FolderOpenIcon /> : <FileOpenIcon />}
          </IconButton>
        </Box>
      </Stack>
      <FormHelperText error={!isValid && !showDescription}>
        {firstFormHelperText}
      </FormHelperText>
      {secondFormHelperText && (
        <FormHelperText error>{secondFormHelperText}</FormHelperText>
      )}
    </FormControl>
  );
}

export const FilePathControl = withJsonFormsControlProps(InnerFilePathControl);
