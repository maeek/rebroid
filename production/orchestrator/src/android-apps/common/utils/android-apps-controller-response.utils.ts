import { AndroidApplication } from '../../android-application.entity';
import { AndroidApplicationResponseDto } from '../dto/android-application-response.dto';

export const toAndroidApplicationResponse = async (
  application: Promise<AndroidApplication>,
) => AndroidApplicationResponseDto.fromEntity(await application);

export const toAndroidApplicationResponseList = async (
  applications: Promise<AndroidApplication[]>,
) =>
  (await applications).map((app) =>
    AndroidApplicationResponseDto.fromEntity(app),
  );
