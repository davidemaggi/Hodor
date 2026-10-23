import { describe, it, expect } from 'vitest';
import { CommandGenerator } from '../../src/utils/command-generator';
import type { PortForwardConfig } from '../../src/types';

const api: PortForwardConfig = {
  name: 'api',
  namespace: 'shop',
  resourceType: 'service',
  resourceName: 'api',
  localPort: 18080,
  remotePort: 80,
};

describe('CommandGenerator', () => {
  const gen = new CommandGenerator();

  it('generates a kubectl port-forward command', () => {
    expect(gen.generatePortForwardCommand(api)).toBe(
      'kubectl port-forward -n shop service/api 18080:80'
    );
    expect(gen.generatePortForwardCommand({ ...api, localPort: 80 })).toBe(
      'kubectl port-forward -n shop service/api 80'
    );
  });

  it('targets a context when given, quoting per platform', () => {
    expect(gen.generatePortForwardCommand(api, 'linux', { context: "it's prod" })).toBe(
      "kubectl port-forward --context 'it'\\''s prod' -n shop service/api 18080:80"
    );
    expect(gen.generatePortForwardCommand(api, 'windows', { context: "it's prod" })).toBe(
      "kubectl port-forward --context 'it''s prod' -n shop service/api 18080:80"
    );
    expect(
      gen.generatePortForwardCommand(api, 'macos', { context: 'arn:aws:eks:eu-west-1:1:cluster/x' })
    ).toContain('--context arn:aws:eks:eu-west-1:1:cluster/x ');
  });

  it('generates a bash script that cleans up on exit', () => {
    const script = gen.generateShellScript([api], 'macos');
    expect(script.startsWith('#!/bin/bash')).toBe(true);
    expect(script).toContain('trap cleanup SIGINT SIGTERM');
    expect(script).toContain('kubectl port-forward -n shop service/api 18080:80 &');
  });

  it('generates a PowerShell script with CRLF line endings', () => {
    const script = gen.generateShellScript([api], 'windows');
    expect(script).toContain(
      'Start-Job -ScriptBlock { kubectl port-forward -n shop service/api 18080:80 }'
    );
    expect(script).toContain('\r\n');
  });
});
