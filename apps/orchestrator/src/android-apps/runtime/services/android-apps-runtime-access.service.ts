import { Injectable } from '@nestjs/common';
import {
  type BufferedUploadFile,
  type MultipartUploadRequest,
} from '../../../common/http-upload';
import { AndroidApplication } from '../../android-application.entity';
import { ApplicationRuntimeFilesQueryDto } from '../dto/application-runtime-files-query.dto';
import { AndroidAppsRuntimeDeviceService } from './android-apps-runtime-device.service';
import { AndroidAppsRuntimeDiagnosticsService } from './android-apps-runtime-diagnostics.service';
import { RuntimeDataFilesService } from './runtime-data-files.service';
import { RuntimeDownloadFilesService } from './runtime-download-files.service';

@Injectable()
export class AndroidAppsRuntimeAccessService {
  constructor(
    private readonly dataFiles: RuntimeDataFilesService,
    private readonly downloadFiles: RuntimeDownloadFilesService,
    private readonly device: AndroidAppsRuntimeDeviceService,
    private readonly diagnostics: AndroidAppsRuntimeDiagnosticsService,
  ) {}

  notifications(id: string) {
    return this.diagnostics.notifications(id);
  }

  containerLogs(id: string, tail = 300) {
    return this.diagnostics.containerLogs(id, tail);
  }

  eventLogs(id: string, tail = 300) {
    return this.diagnostics.eventLogs(id, tail);
  }

  adbLogs(id: string, tail = 300) {
    return this.diagnostics.adbLogs(id, tail);
  }

  listFiles(id: string, requestedPath?: string) {
    return this.dataFiles.listFiles(id, requestedPath);
  }

  uploadFile(
    id: string,
    request: MultipartUploadRequest,
    requestedPath?: string,
    overwrite = false,
  ) {
    return this.dataFiles.uploadFile(id, request, requestedPath, overwrite);
  }

  createDirectory(id: string, parentPath: string, name: string) {
    return this.dataFiles.createDirectory(id, parentPath, name);
  }

  renameFile(id: string, path: string, name: string) {
    return this.dataFiles.renameFile(id, path, name);
  }

  deleteFile(id: string, path: string) {
    return this.dataFiles.deleteFile(id, path);
  }

  previewFile(id: string, path?: string) {
    return this.dataFiles.previewFile(id, path);
  }

  downloadRuntimeFile(id: string, requestedPath?: string) {
    return this.dataFiles.downloadRuntimeFile(id, requestedPath);
  }

  listDownloadFiles(id: string, query: ApplicationRuntimeFilesQueryDto = {}) {
    return this.downloadFiles.listDownloadFiles(id, query);
  }

  uploadDownloadFile(
    id: string,
    request: MultipartUploadRequest,
    query: ApplicationRuntimeFilesQueryDto = {},
  ) {
    return this.downloadFiles.uploadDownloadFile(id, request, query);
  }

  uploadDownloadFileBuffer(
    app: AndroidApplication,
    file?: BufferedUploadFile,
    query: ApplicationRuntimeFilesQueryDto = {},
  ) {
    return this.downloadFiles.uploadDownloadFileBuffer(app, file, query);
  }

  downloadFile(
    id: string,
    fileName: string,
    query: ApplicationRuntimeFilesQueryDto = {},
  ) {
    return this.downloadFiles.downloadFile(id, fileName, query);
  }

  getClipboard(id: string) {
    return this.device.getClipboard(id);
  }

  setClipboard(id: string, text: string) {
    return this.device.setClipboard(id, text);
  }

  screenshot(id: string) {
    return this.device.screenshot(id);
  }
}
