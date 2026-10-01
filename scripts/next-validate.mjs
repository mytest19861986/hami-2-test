import { rmSync } from 'node:fs';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';

rmSync(join(process.cwd(), '.next'), { recursive: true, force: true });
const command = join(process.cwd(), '..', '..', 'node_modules', '.bin', 'next');
const result = spawnSync(command, ['build'], { stdio: 'inherit', shell: true });
process.exit(result.status ?? 1);
