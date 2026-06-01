import React, { useEffect, useRef, useState } from 'react';
import { rankWith, uiTypeIs } from '@jsonforms/core';
import { JsonFormsDispatch, withJsonFormsLayoutProps, useJsonForms } from '@jsonforms/react';
import { Tabs, Tab, Box } from '@mui/material';

export const verticalCategorizationTester = rankWith(10, uiTypeIs('Categorization'));

const VerticalCategorization = ({ uischema, schema, path, visible }) => {
  const categories = (uischema && uischema.elements) || [];
  const [value, setValue] = useState(0);
  const [tabHasError, setTabHasError] = useState([]);
  const panelRefs = useRef([]);
  const jsonforms = useJsonForms();

  if (!visible) return null;

  useEffect(() => {
    const next = categories.map((_, i) => {
      const panel = panelRefs.current[i];
      if (!panel) return false;

      return Boolean(
        panel.querySelector('.Mui-error, [aria-invalid="true"], .MuiFormHelperText-root.Mui-error')
      );
    });

    setTabHasError(next);
  }, [categories, jsonforms?.core?.errors, jsonforms?.core?.data, path]);

  const getLabel = (cat, fallbackIndex) => {
    if (!cat) return `Tab ${fallbackIndex + 1}`;
    if (typeof cat.label === 'string') return cat.label;
    if (cat.label && typeof cat.label.text === 'string') return cat.label.text;
    if (cat?.title) return cat.title;
    return `Tab ${fallbackIndex + 1}`;
  };

  return (
    <Box sx={{ display: 'flex', width: '100%', alignItems: 'stretch' }}>
      <Tabs
        orientation="vertical"
        variant="scrollable"
        value={value}
        onChange={(_, newVal) => setValue(newVal)}
        sx={{ borderRight: 1, borderColor: 'divider', minWidth: 160, flexShrink: 0 }}
      >
        {categories.map((cat, i) => {
          const hasError = !!tabHasError[i];

          return (
            <Tab
              key={i}
              label={
                <Box
                  component="span"
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 1,
                    color: hasError ? 'error.main' : 'inherit',
                    fontWeight: hasError ? 700 : 400
                  }}
                >
                  <span>{getLabel(cat, i)}</span>
                  {hasError && (
                    <Box
                      component="span"
                      sx={{
                        width: 8,
                        height: 8,
                        borderRadius: '50%',
                        bgcolor: 'error.main',
                        flexShrink: 0
                      }}
                    />
                  )}
                </Box>
              }
              id={`vert-tab-${i}`}
              aria-controls={`vert-tabpanel-${i}`}
              sx={{
                textTransform: 'none',
                alignItems: 'flex-start',
                opacity: 1
              }}
            />
          );
        })}
      </Tabs>

      <Box sx={{ flex: 1, p: 2, minWidth: 0 }}>
        {categories.map((cat, i) => (
          <Box
            role="tabpanel"
            hidden={value !== i}
            id={`vert-tabpanel-${i}`}
            aria-labelledby={`vert-tab-${i}`}
            key={i}
            ref={(el) => {
              panelRefs.current[i] = el;
            }}
            style={{ width: '100%' }}
          >
            {value === i && (
              <>
                {Array.isArray(cat.elements) && cat.elements.length > 0 ? (
                  cat.elements.map((child, idx) => (
                    <JsonFormsDispatch key={idx} uischema={child} schema={schema} path={path} />
                  ))
                ) : (
                  <JsonFormsDispatch uischema={cat} schema={schema} path={path} />
                )}
              </>
            )}
          </Box>
        ))}
      </Box>
    </Box>
  );
};

export default withJsonFormsLayoutProps(VerticalCategorization);
