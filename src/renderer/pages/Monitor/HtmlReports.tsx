import React, { useEffect } from 'react';
import { Box, CircularProgress, Select, MenuItem, Typography } from '@mui/material';
import List from '@mui/material/List';
import ListItemText from '@mui/material/ListItemText';
import ListItemButton from '@mui/material/ListItemButton';
import Tooltip from '@mui/material/Tooltip';
import { API } from '../../services/api.js';
import { useTranslation } from 'react-i18next';

export default function HtmlReports({ instance }) {
  const { t } = useTranslation();
  const [loading, setLoading] = React.useState(false);
  const [selected, setSelected] = React.useState(null);
  const [reportsList, setReportsList] = React.useState<Record<string, string>[]>([]);
  const [source, setSource] = React.useState<'instance' | 'output'>('instance');
  const [outputPathAvailable, setOutputPathAvailable] = React.useState(false);

  // Auto-select best source when instance changes: output has priority, fall back to instance.
  // Does NOT load reports — that is handled by the second effect below.
  useEffect(() => {
    let cancelled = false;

    API.getOutputPathForInstance(instance).then((pathResult) => {
      if (cancelled) return;
      const available = pathResult.ok && !!pathResult.data;
      setOutputPathAvailable(available);

      if (!available) {
        setSource('instance');
        return;
      }

      API.getPathReportsList(pathResult.data).then((result) => {
        if (cancelled) return;
        setSource(result.ok && (result.data || []).length > 0 ? 'output' : 'instance');
      });
    });

    return () => {
      cancelled = true;
    };
  }, [instance]);

  // Load reports for the current source (triggered by instance or manual tab switch).
  // If no reports exist for the selected source, show the empty state.
  useEffect(() => {
    setSelected(null);
    setReportsList([]);
    let cancelled = false;

    if (source === 'instance') {
      API.getInstanceReportsList(instance).then((result) => {
        if (cancelled) return;
        if (result.ok) {
          const list = result.data || [];
          setReportsList(list);
          if (list.length > 0) setSelected(list[0]);
        }
      });
    } else {
      API.getOutputPathForInstance(instance).then((pathResult) => {
        if (cancelled) return;
        if (pathResult.ok && pathResult.data) {
          API.getPathReportsList(pathResult.data).then((result) => {
            if (cancelled) return;
            if (result.ok) {
              const list = result.data || [];
              setReportsList(list);
              if (list.length > 0) setSelected(list[0]);
            }
          });
        }
      });
    }

    return () => {
      cancelled = true;
    };
  }, [instance, source]);

  useEffect(() => {
    if (selected?.path) setLoading(true);
  }, [selected]);

  return (
    <Box
      sx={{
        display: 'grid',
        gridTemplateColumns: selected ? '1fr 3fr' : '1fr',
        flex: 1,
        minHeight: 0,
        height: '100%'
      }}
    >
      {/* Report list */}
      <Box sx={{ overflow: 'auto', borderRight: selected ? '1px solid' : 'none' }}>
        {outputPathAvailable && (
          <Box sx={{ p: 1 }}>
            <Select
              size="small"
              value={source}
              onChange={(e) => setSource(e.target.value as 'instance' | 'output')}
              sx={{ width: '100%' }}
            >
              <MenuItem value="instance">{t('monitor.reports.instance')}</MenuItem>
              <MenuItem value="output">{t('monitor.reports.output')}</MenuItem>
            </Select>
          </Box>
        )}
        {reportsList.length > 0 ? (
          <List dense disablePadding>
            {reportsList.map((report) => (
              <ListItemButton
                key={report.id}
                selected={selected?.id === report.id}
                onClick={() => setSelected(report)}
                sx={{ py: 0.5, minWidth: 0 }}
              >
                <Tooltip title={report.name} placement="right">
                  <ListItemText
                    primary={report.name}
                    secondary={
                      report.shortPath ? report.shortPath.split('/').slice(0, -1).join('/') : ''
                    }
                    primaryTypographyProps={{ noWrap: true }}
                    secondaryTypographyProps={{
                      variant: 'caption',
                      color: 'text.secondary',
                      noWrap: true
                    }}
                  />
                </Tooltip>
              </ListItemButton>
            ))}
          </List>
        ) : (
          <Typography variant="body2" sx={{ p: 2, color: 'text.secondary' }}>
            {t('monitor.reports.no-reports')}
          </Typography>
        )}
      </Box>

      {/* Report viewer */}
      {selected && (
        <Box sx={{ position: 'relative', overflow: 'hidden' }}>
          {loading && (
            <Box
              sx={{
                position: 'absolute',
                inset: 0,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              <CircularProgress />
            </Box>
          )}
          <iframe
            title="preview"
            src={selected.path}
            onLoad={() => setLoading(false)}
            style={{ width: '100%', height: '100%', border: 'none' }}
            hidden={loading}
          />
        </Box>
      )}
    </Box>
  );
}
