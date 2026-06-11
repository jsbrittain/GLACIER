import { describe, it, expect } from 'vitest';
import { buildUISchema } from '../../../src/renderer/pages/Parameters/buildUISchema';

describe('buildUISchema', () => {
  it('builds categories from $defs, excluding hidden properties', () => {
    const schema = {
      $defs: {
        Input: {
          type: 'object',
          title: 'Input Files',
          properties: {
            fasta: { type: 'string', description: 'FASTA file' },
            gff: { type: 'string', hidden: true }
          }
        }
      },
      properties: {}
    };
    const ui = buildUISchema(schema);
    expect(ui.type).toBe('Categorization');
    const catElements = (ui as any).elements?.[0]?.elements?.[0]?.elements;
    expect(catElements).toHaveLength(1);
    expect(catElements[0].scope).toBe('#/properties/fasta');
  });

  it('builds categories from legacy definitions key', () => {
    const schema = {
      definitions: {
        Params: {
          type: 'object',
          title: 'Parameters',
          properties: { threads: { type: 'integer' } }
        }
      },
      properties: {}
    };
    const ui = buildUISchema(schema);
    expect(ui.type).toBe('Categorization');
    expect((ui as any).elements[0].label).toBe('Parameters');
  });

  it('falls back to Vertical when no properties, definitions, or categories found', () => {
    const schema = {};
    const ui = buildUISchema(schema);
    expect(ui.type).toBe('Vertical');
  });

  it('shows hidden properties when showHidden option is true', () => {
    const schema = {
      $defs: {
        Input: {
          type: 'object',
          properties: {
            visible: { type: 'string' },
            secret: { type: 'string', hidden: true }
          }
        }
      },
      properties: {}
    };
    const ui = buildUISchema(schema, { showHidden: true });
    const scopes = (ui as any).elements[0].elements[0].elements.map((e: any) => e.scope);
    expect(scopes).toContain('#/properties/secret');
  });
});
