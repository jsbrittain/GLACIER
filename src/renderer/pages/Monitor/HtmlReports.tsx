import React from 'react';
import { Box, Typography } from '@mui/material';
import MenuItem from '@mui/material/MenuItem';
import Select from '@mui/material/Select';
import FormControl from '@mui/material/FormControl';
import { API } from '../../services/api.js';
import { useTranslation } from 'react-i18next';

export default function HtmlReports({ instance }) {
  const { t } = useTranslation();

  const [reportsList, setReportsList] = React.useState<Record<string, string>[]>([]);
  const [selectedReport, setSelectedReport] = React.useState<Record<string, string>>({});

  API.getInstanceReportsList(instance).then((reports) => {
    setReportsList(reports || []);
  });

  const handleReportChange = (event: React.ChangeEvent<{ value: unknown }>) => {
    const report = reportsList.find((r) => r.id === event.target.value);
    setSelectedReport(report || {});
  };

  return (
    <Box sx={{ width: '100%' }}>
      <Box sx={{ mb: 2 }}>
        <FormControl fullWidth size="small">
          <Select
            value={selectedReport.name}
            onChange={handleReportChange}
            displayEmpty
            inputProps={{ 'aria-label': t('monitor.select-report') }}
            size={'small'}
          >
            {reportsList.map((report) => (
              <MenuItem key={report.id} value={report.id}>
                {report.name}{' '}
                <Typography variant="caption" sx={{ ml: 1, color: 'gray' }}>
                  (
                  {
                    // remove filename from shortPath
                    report.shortPath ? report.shortPath.split('/').slice(0, -1).join('/') : ''
                  }
                  )
                </Typography>
              </MenuItem>
            ))}
          </Select>
        </FormControl>
      </Box>

      <iframe
        src={selectedReport.path || ''}
        id="frame"
        width="100%"
        height="600"
        sandbox="allow-scripts allow-forms"
      ></iframe>
    </Box>
  );
}
