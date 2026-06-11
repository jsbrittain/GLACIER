import React, { useEffect } from 'react';
import { Box } from '@mui/material';
import List from '@mui/material/List';
import ListItemText from '@mui/material/ListItemText';
import ListItemButton from '@mui/material/ListItemButton';
import CircularProgress from '@mui/material/CircularProgress';
import Tooltip from '@mui/material/Tooltip';
import { Panel, PanelGroup, PanelResizeHandle } from 'react-resizable-panels';
import { API } from '../../services/api.js';

export default function HtmlReports({ instance }) {
  const [loading, setLoading] = React.useState(false);
  const [selected, setSelected] = React.useState(null);
  const [reportsList, setReportsList] = React.useState<Record<string, string>[]>([]);

  useEffect(() => {
    API.getInstanceReportsList(instance).then((reports) => {
      setReportsList(reports || []);
    });
  }, [instance]);

  useEffect(() => {
    if (selected?.path) setLoading(true);
  }, [selected]);

  return (
    <Box sx={{ display: 'flex', flex: 1, minHeight: 0, height: '100%' }}>
      {/* Report select (left side) */}
      <PanelGroup direction="horizontal" style={{ height: '100%', width: '100%' }}>
        <Panel
          style={{
            borderRight: '1px solid',
            display: 'flex',
            flexDirection: 'column',
            minHeight: 0
          }}
          defaultSize={25}
          minSize={8}
          collapsible
        >
          <Box
            sx={{
              display: 'flex',
              flexDirection: 'column',
              flex: 1,
              minHeight: 0,
              overflow: 'hidden'
            }}
          >
            <List dense disablePadding sx={{ flex: 1, minHeight: 0, overflow: 'auto' }}>
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
                      primaryTypographyProps={{
                        noWrap: true
                      }}
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
        </Panel>

        <PanelResizeHandle />

        {/* Render HTML report (right side) */}
        <Panel defaultSize={75} style={{ display: 'flex', flex: 1, flexDirection: 'column', minHeight: 0 }}>
          {/* Loading spinner overlay */}
          {loading && (
            <Box
              sx={{
                flex: 1,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              <CircularProgress />
            </Box>
          )}

          {/* Iframe to display the selected report */}
          <iframe
            title="preview"
            src={selected?.path || null}
            onLoad={() => setLoading(false)}
            style={{ width: '100%', height: '100%', border: 'none' }}
            hidden={!selected?.path || loading}
          />
        </Panel>
      </PanelGroup>
    </Box>
  );
}
