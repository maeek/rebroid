import { Injectable } from '@nestjs/common';

interface GitLabBranchResponse {
  commit?: { id?: unknown };
}

@Injectable()
export class ContainerImageGappsSourceService {
  async resolveRevision(branch: string) {
    const response = await fetch(
      `https://gitlab.com/api/v4/projects/MindTheGapps%2Fvendor_gapps/repository/branches/${encodeURIComponent(branch)}`,
      {
        headers: { Accept: 'application/json' },
        signal: AbortSignal.timeout(30_000),
      },
    );
    if (!response.ok) {
      throw new Error(
        `Could not resolve MindTheGapps ${branch}: HTTP ${response.status}.`,
      );
    }
    const payload = (await response.json()) as GitLabBranchResponse;
    const revision = payload.commit?.id;
    if (typeof revision !== 'string' || !/^[a-f0-9]{40}$/i.test(revision)) {
      throw new Error('MindTheGapps returned an invalid source revision.');
    }
    return revision.toLowerCase();
  }
}
