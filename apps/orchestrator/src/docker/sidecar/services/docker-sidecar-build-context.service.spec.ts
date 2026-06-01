import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import extract from 'tar-stream';
import { DockerSidecarBuildContextService } from './docker-sidecar-build-context.service';

describe('DockerSidecarBuildContextService', () => {
  let directory: string;

  beforeEach(async () => {
    directory = await mkdtemp(join(tmpdir(), 'rebroid-sidecar-context-'));
  });

  afterEach(async () => {
    await rm(directory, { recursive: true, force: true });
  });

  it('packs source files while excluding ignored build artifacts', async () => {
    await mkdir(join(directory, 'src'), { recursive: true });
    await mkdir(join(directory, 'node_modules'), { recursive: true });
    await writeFile(join(directory, 'Dockerfile'), 'FROM scratch\n');
    await writeFile(join(directory, 'src', 'main.ts'), 'export {}\n');
    await writeFile(join(directory, 'node_modules', 'ignored.js'), '');

    const archive = await new DockerSidecarBuildContextService().createTar(
      directory,
    );
    const files: string[] = [];
    const parser = extract.extract();
    parser.on('entry', (header, stream, next) => {
      files.push(header.name);
      stream.resume();
      stream.on('end', next);
    });

    await new Promise<void>((resolve, reject) => {
      parser.on('finish', resolve);
      parser.on('error', reject);
      archive.pipe(parser);
    });

    expect(files.sort()).toEqual(['Dockerfile', 'src/main.ts']);
  });
});
