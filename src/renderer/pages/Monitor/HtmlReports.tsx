import React, { useEffect } from 'react';
import { Box, CircularProgress } from '@mui/material';
import List from '@mui/material/List';
import ListItemText from '@mui/material/ListItemText';
import ListItemButton from '@mui/material/ListItemButton';
import Tooltip from '@mui/material/Tooltip';
import { API } from '../../services/api.js';

export default function HtmlReports({ instance }) {
  const [loading, setLoading] = React.useState(false);
  const [selected, setSelected] = React.useState(null);
  const [reportsList, setReportsList] = React.useState<Record<string, string>[]>([]);

  useEffect(() => {
    API.getInstanceReportsList(instance).then((result) => {
      if (result.ok) {
        const list = result.data || [];
        setReportsList(list);
        if (list.length > 0) setSelected(list[0]);
      }
    });
  }, [instance]);

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
