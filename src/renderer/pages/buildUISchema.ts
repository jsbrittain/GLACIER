import type { UISchemaElement } from '@jsonforms/core';

type JSONSchema = any;

// Build a JSON Forms UI schema with Categories from `definitions`/`allOf`
export function buildUISchema(
  schema: JSONSchema,
  opts?: {
    showHidden?: boolean;
  }
): UISchemaElement {
  const showHidden = !!opts?.showHidden;

  const categories = (schema.allOf ?? [])
    .map((entry: any) => {
      const ref: string | undefined = entry?.$ref;
      if (!ref || !ref.startsWith('#/definitions/')) return null;

      const defKey = ref.replace('#/definitions/', '');
      const def = schema.definitions?.[defKey];
      if (!def || def.type !== 'object') return null;

      const props = def.properties ?? {};
      const propKeys = Object.keys(props).filter((k) => {
        const hiddenVal = props[k]?.hidden;
        const isHidden = hiddenVal === true || hiddenVal === 'true' || hiddenVal === 'True';
        return showHidden || !isHidden;
      });

      if (propKeys.length === 0) return null;

      return {
        type: 'Category',
        label: def.title ?? defKey,
        elements: [
          {
            type: 'Group',
            label: def.description ?? def.title ?? defKey,
            elements: propKeys.map((k) => ({
              type: 'Control',
              // Because definitions are merged via allOf, the effective location
              // of each field is at the root: #/properties/<propName>
              scope: `#/properties/${k}`,
              // Optional: pass descriptions/help_text via options to surface as tooltips
              options: {
                description: props[k]?.description ?? props[k]?.help_text
                // Carry through any enums/format etc. (JSON Forms reads those from the schema)
              }
            }))
          }
        ]
      };
    })
    .filter(Boolean);

  // Also pick up any *root-level* properties not covered in allOf
  const allDefPropNames = new Set(
    (schema.allOf ?? [])
      .map((e: any) => e?.$ref?.replace('#/definitions/', ''))
      .filter(Boolean)
      .flatMap((key: string) => Object.keys(schema.definitions?.[key]?.properties ?? {}))
  );

  const rootProps = Object.keys(schema.properties ?? {}).filter((k) => {
    if (allDefPropNames.has(k)) return false;
    const hiddenVal = schema.properties?.[k]?.hidden;
    const isHidden = hiddenVal === true || hiddenVal === 'true' || hiddenVal === 'True';
    return showHidden || !isHidden;
  });

  if (rootProps.length > 0) {
    categories.push({
      type: 'Category',
      label: schema.title ?? 'General',
      elements: [
        {
          type: 'Group',
          label: 'General',
          elements: rootProps.map((k) => ({
            type: 'Control',
            scope: `#/properties/${k}`,
            options: {
              description: schema.properties?.[k]?.description ?? schema.properties?.[k]?.help_text
            }
          }))
        }
      ]
    });
  }

  // Fall back to Vertical if nothing was built
  if (categories.length === 0) {
    return {
      type: 'Vertical',
      elements: Object.keys(schema.properties ?? {}).map((k) => ({
        type: 'Control',
        scope: `#/properties/${k}`
      }))
    };
  }

  return {
    type: 'Categorization',
    elements: categories as any
  };
}
