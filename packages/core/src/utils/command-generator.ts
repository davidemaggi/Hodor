import { PortForwardConfig } from '../types';

export type Platform = 'linux' | 'macos' | 'windows';

export interface KubectlCommand {
  platform: Platform;
  command: string;
}

export interface CommandOptions {
  /** kubectl context to target. Omit to use kubectl's current context. */
  context?: string;
}

/**
 * Quote a value only when needed: single quotes work in both bash and PowerShell,
 * they just escape embedded quotes differently.
 */
function quote(value: string, platform: Platform): string {
  if (/^[A-Za-z0-9_./:@-]+$/.test(value)) return value;
  return platform === 'windows'
    ? `'${value.replace(/'/g, "''")}'`
    : `'${value.replace(/'/g, `'\\''`)}'`;
}

/**
 * Generates kubectl commands from port-forward configurations
 */
export class CommandGenerator {
  /**
   * Generate kubectl command for a single port-forward.
   * Templates carry no cluster details, so the target context is optional and supplied by the caller.
   */
  generatePortForwardCommand(
    config: PortForwardConfig,
    platform: Platform = 'linux',
    options: CommandOptions = {}
  ): string {
    const { namespace, resourceType, resourceName, localPort, remotePort } = config;

    const resource = `${resourceType}/${resourceName}`;
    const portMapping = localPort === remotePort ? `${localPort}` : `${localPort}:${remotePort}`;

    const parts = ['kubectl', 'port-forward'];
    if (options.context) {
      parts.push('--context', quote(options.context, platform));
    }
    parts.push('-n', quote(namespace, platform), quote(resource, platform), portMapping);

    return parts.join(' ');
  }

  /**
   * Generate kubectl commands for all forwards in a template
   */
  generateTemplateCommands(
    forwards: PortForwardConfig[],
    platform: Platform = 'linux',
    options: CommandOptions = {}
  ): KubectlCommand[] {
    return forwards.map((forward) => ({
      platform,
      command: this.generatePortForwardCommand(forward, platform, options),
    }));
  }

  /**
   * Generate a shell script to run all forwards
   */
  generateShellScript(
    forwards: PortForwardConfig[],
    platform: Platform = 'linux',
    options: CommandOptions = {}
  ): string {
    const commands = this.generateTemplateCommands(forwards, platform, options);

    if (platform === 'windows') {
      // PowerShell script
      const lines = [
        '# Hodor Port-Forward Script (PowerShell)',
        '# Generated automatically - DO NOT EDIT',
        '',
        '$jobs = @()',
        '',
      ];

      commands.forEach((cmd, index) => {
        lines.push(`# Forward ${index + 1}: ${forwards[index].name}`);
        lines.push(`$jobs += Start-Job -ScriptBlock { ${cmd.command} }`);
        lines.push('');
      });

      lines.push('Write-Host "All port-forwards started. Press Ctrl+C to stop all."');
      lines.push('');
      lines.push('try {');
      lines.push('    $jobs | Wait-Job');
      lines.push('} finally {');
      lines.push('    Write-Host "Stopping all port-forwards..."');
      lines.push('    $jobs | Stop-Job');
      lines.push('    $jobs | Remove-Job');
      lines.push('}');

      return lines.join('\r\n');
    } else {
      // Bash script (Linux/macOS)
      const lines = [
        '#!/bin/bash',
        '# Hodor Port-Forward Script',
        '# Generated automatically - DO NOT EDIT',
        '',
        'set -e',
        '',
        'PIDS=()',
        '',
        '# Cleanup function',
        'cleanup() {',
        '    echo "Stopping all port-forwards..."',
        '    for pid in "${PIDS[@]}"; do',
        '        kill "$pid" 2>/dev/null || true',
        '    done',
        '    exit 0',
        '}',
        '',
        'trap cleanup SIGINT SIGTERM',
        '',
      ];

      commands.forEach((cmd, index) => {
        lines.push(`# Forward ${index + 1}: ${forwards[index].name}`);
        lines.push(`${cmd.command} &`);
        lines.push('PIDS+=($!)');
        lines.push('');
      });

      lines.push('echo "All port-forwards started. Press Ctrl+C to stop all."');
      lines.push('');
      lines.push('# Wait for all background processes');
      lines.push('wait');

      return lines.join('\n');
    }
  }

  /**
   * Generate a makefile target for the forwards
   */
  generateMakefile(forwards: PortForwardConfig[]): string {
    const lines = [
      '# Hodor Port-Forward Makefile',
      '# Generated automatically - DO NOT EDIT',
      '',
      '.PHONY: all clean',
      '',
      'all:',
    ];

    forwards.forEach((forward) => {
      lines.push(`\t@echo "Starting port-forward: ${forward.name}"`);
      lines.push(`\t@${this.generatePortForwardCommand(forward, 'linux')} &`);
    });

    lines.push('');
    lines.push('\t@echo "All port-forwards started. Press Ctrl+C to stop."');
    lines.push('\t@wait');
    lines.push('');
    lines.push('clean:');
    lines.push('\t@echo "Stopping all port-forwards..."');
    lines.push('\t@pkill -f "kubectl port-forward" || true');

    return lines.join('\n');
  }

  /**
   * Generate a docker-compose.yml equivalent (using kubectl as command)
   */
  generateDockerCompose(forwards: PortForwardConfig[]): string {
    const services: Record<string, any> = {};

    forwards.forEach((forward) => {
      const serviceName = forward.name.toLowerCase().replace(/[^a-z0-9]/g, '-');
      services[serviceName] = {
        image: 'bitnami/kubectl:latest',
        command: this.generatePortForwardCommand(forward, 'linux').split(' ').slice(1),
        network_mode: 'host',
        restart: 'unless-stopped',
      };
    });

    const compose = {
      version: '3.8',
      services,
    };

    return `# Hodor Port-Forward Docker Compose
# Generated automatically - DO NOT EDIT

${JSON.stringify(compose, null, 2)}`;
  }
}
