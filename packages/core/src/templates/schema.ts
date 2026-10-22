import { z } from 'zod';
import type { PortForwardConfig, Template } from '../types';

const dnsLabel = z
  .string()
  .regex(/^[a-z0-9]([-a-z0-9]*[a-z0-9])?$/, 'must be a lowercase DNS label')
  .max(63);
const resourceName = z
  .string()
  .regex(/^[a-z0-9]([-.a-z0-9]*[a-z0-9])?$/, 'not a valid resource name')
  .max(253);
const port = z.number().int().min(1).max(65535);

/** A forward as it may appear in a template file. Unknown keys are dropped. */
export const forwardSchema = z
  .object({
    name: z.string().trim().min(1).max(63),
    namespace: dnsLabel,
    resourceType: z.enum(['pod', 'service', 'deployment']),
    resourceName,
    localPort: port,
    remotePort: port,
    secrets: z.array(resourceName).max(20).optional(),
    configMaps: z.array(resourceName).max(20).optional(),
  })
  .strip();

/** The portable part of a template: what gets exported and imported. No ids, no cluster details. */
export const portableTemplateSchema = z
  .object({
    name: z.string().trim().min(1).max(100),
    description: z.string().max(500).optional(),
    tags: z.array(z.string().trim().min(1).max(50)).max(20).default([]),
    forwards: z.array(forwardSchema).min(1).max(50),
  })
  .strip();

export type PortableTemplate = z.infer<typeof portableTemplateSchema>;

export const TEMPLATE_FILE_KIND = 'hodor-templates';

/** Accepts the current bundle, the 0.x `{ templates: [...] }` export, or a single template object */
const fileSchema = z.union([
  z.object({
    kind: z.literal(TEMPLATE_FILE_KIND),
    version: z.literal(1),
    templates: z.array(z.unknown()),
  }),
  z.object({ templates: z.array(z.unknown()) }),
  z.object({ name: z.string(), forwards: z.array(z.unknown()) }).passthrough(),
]);

export function toPortable(template: Template): PortableTemplate {
  const forwards = template.forwards.map((f: PortForwardConfig) => {
    const out: PortForwardConfig = {
      name: f.name,
      namespace: f.namespace,
      resourceType: f.resourceType,
      resourceName: f.resourceName,
      localPort: f.localPort,
      remotePort: f.remotePort,
    };
    if (f.secrets?.length) out.secrets = f.secrets;
    if (f.configMaps?.length) out.configMaps = f.configMaps;
    return out;
  });
  return {
    name: template.name,
    ...(template.description ? { description: template.description } : {}),
    tags: template.tags,
    forwards,
  };
}

export function serializeTemplates(templates: Template[]): string {
  return JSON.stringify(
    { kind: TEMPLATE_FILE_KIND, version: 1, templates: templates.map(toPortable) },
    null,
    2
  );
}

/**
 * Parse a template file. Throws with a readable message naming the template and field at fault.
 */
export function parseTemplateFile(json: string): PortableTemplate[] {
  let data: unknown;
  try {
    data = JSON.parse(json);
  } catch {
    throw new Error('Not a JSON file');
  }

  const file = fileSchema.safeParse(data);
  if (!file.success) throw new Error('Not a Hodor template file');

  const raw: unknown[] =
    'templates' in file.data && Array.isArray(file.data.templates)
      ? file.data.templates
      : [file.data];
  return raw.map((entry, index) => {
    const parsed = portableTemplateSchema.safeParse(entry);
    if (!parsed.success) {
      const issue = parsed.error.issues[0];
      const label = (entry as { name?: unknown })?.name;
      throw new Error(
        `Template ${typeof label === 'string' ? `'${label}'` : `#${index + 1}`}: ${issue.path.join('.') || 'value'} ${issue.message}`
      );
    }
    return parsed.data;
  });
}

/**
 * A local port for a remote one: ports under 1024 need root, so 80 becomes 18080 and 5432 becomes 15432.
 * Skips ports already taken.
 */
export function suggestLocalPort(remotePort: number, taken: Iterable<number> = []): number {
  const used = new Set(taken);
  let candidate = remotePort + 10000 <= 65535 ? remotePort + 10000 : remotePort;
  if (candidate < 1024) candidate += 10000;
  while (used.has(candidate) && candidate < 65535) candidate++;
  return candidate;
}

export interface PortConflict {
  port: number;
  /** Other template using the same local port */
  template: string;
  forward: string;
}

/** Local ports this template shares with other templates: they can't run at the same time */
export function findPortConflicts(
  forwards: Pick<PortForwardConfig, 'localPort'>[],
  others: Template[]
): PortConflict[] {
  const mine = new Set(forwards.map((f) => f.localPort));
  return others.flatMap((t) =>
    t.forwards
      .filter((f) => mine.has(f.localPort))
      .map((f) => ({ port: f.localPort, template: t.name, forward: f.name }))
  );
}
