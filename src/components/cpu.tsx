export type CpuInfo = {
  name?: string;
  manufacturer?: string;
  model?: string;
  serial?: string;
  part_number?: string;
  architecture?: string;
  cores?: string | number;
  threads_per_core?: string | number;
  logical_processors?: string | number;
  speed?: string | number;
  current_speed?: string | number;
  minimum_speed?: string | number;
  maximum_speed?: string | number;
  identifier?: string;
  socket_count?: string | number;
  virtualization?: string;
  [key: string]: unknown;
};

function value(
  source: CpuInfo,
  keys: string[],
): string {
  for (const key of keys) {
    const item = source[key];

    if (
      item !== undefined &&
      item !== null &&
      item !== ''
    ) {
      return String(item).trim();
    }
  }

  return '';
}

export function getCpuInventoryRow(
  cpu: CpuInfo,
): unknown[] {
  const manufacturer = value(cpu, [
    'manufacturer',
    'vendor',
    'vendor_id',
  ]);

  const model = value(cpu, [
    'model',
    'name',
    'processor',
  ]);

  const serial = value(cpu, [
    'serial',
    'serial_number',
  ]);

  const architecture = value(cpu, [
    'architecture',
  ]);

  const cores = value(cpu, [
    'cores',
    'core_count',
    'physical_cores',
  ]);

  const logicalProcessors = value(cpu, [
    'logical_processors',
    'cpu_count',
    'logical_cpus',
  ]);

  const speed = value(cpu, [
    'maximum_speed',
    'speed',
    'current_speed',
  ]);

  return [
    'CPU',
    manufacturer,
    model,
    serial,
    architecture,
    speed,
    cores
      ? `${cores} physical cores${
          logicalProcessors
            ? ` / ${logicalProcessors} logical processors`
            : ''
        }`
      : logicalProcessors
        ? `${logicalProcessors} logical processors`
        : '',
  ];
}

export function getCpuInformationRows(
  cpu: CpuInfo,
): Array<[string, unknown]> {
  return [
    ['Processor Name', value(cpu, ['model', 'name'])],
    ['Manufacturer', value(cpu, ['manufacturer'])],
    ['Architecture', value(cpu, ['architecture'])],
    ['Physical Cores', value(cpu, ['cores'])],
    ['Threads Per Core', value(cpu, ['threads_per_core'])],
    ['Logical Processors', value(cpu, ['logical_processors'])],
    ['Current Speed', value(cpu, ['current_speed'])],
    ['Minimum Speed', value(cpu, ['minimum_speed'])],
    ['Maximum Speed', value(cpu, ['maximum_speed'])],
    ['Socket Count', value(cpu, ['socket_count'])],
    ['CPU Identifier', value(cpu, ['identifier'])],
    ['Virtualization', value(cpu, ['virtualization'])],
  ];
}
