# Runtime File Explorer

The application viewer's **Files** tool is a path-scoped workspace for the active container's `/data` volume. It intentionally provides a list workspace rather than a tile or gallery mode. The application must be running, and every browser request is authenticated and checked against the application's owner before the orchestrator is called.

## Responsive workspace

- At 1024 px and wider, the workspace has a 220 px Locations and lazy folder-tree rail, a flexible file table, and a 320 px inspector when a file is selected.
- From 640 through 1023 px, the file table remains visible while Locations and Details open as focus-trapped sheets.
- Below 640 px, entries use stacked, 44 px-minimum touch rows. Secondary operations live in each row's overflow menu, Details is a bottom sheet, and the upload queue includes the device safe-area inset.
- A folder opens with one activation. A file selects and opens Details. Arrow Up/Down and Home/End move between visible entries; normal Tab order reaches the toolbar, rows, and actions.
- Tile view is not supported. Moving entries between folders, bulk mutations, recursive search, and non-image previews are also outside this workspace.

## Navigation, loading, and caching

The breadcrumb and active folder change immediately when navigation begins. Search is cleared on navigation and only filters the currently loaded folder, case-insensitively. Directories always sort before files; the default order is name ascending.

Folder queries use the application ID and exact absolute path as their React Query key. Cached folders render immediately and remain cached for five minutes. An uncached path renders table-shaped or stacked-row skeletons owned by the file-list component. Refresh retains current entries while the request runs.

Requests carry an abort signal, so a folder that is no longer observed cannot replace the active folder after rapid navigation. Locations and tree entries prefetch after 150 ms of hover or keyboard-focus intent. Folder-tree children are requested only when their branch is expanded.

Loading, empty, no-result, unavailable, and error presentations use shared state surfaces. Path and entry-count changes are announced through a polite live region. Sheets and dialogs restore focus through the shared focus-managed primitives, and progress animation honors reduced-motion preferences.

## Uploads and conflicts

Upload is a primary toolbar action and accepts multiple files. Dragging files over the workspace temporarily replaces its content with a destination-aware drop overlay. The destination path is captured when files are added; navigating afterward does not redirect an existing queue item.

At most two files upload concurrently. Desktop shows a collapsible tray, while mobile uses the same queue with safe-area padding. Each entry reports progress and supports cancel. Failed entries support Retry. A destination conflict is never overwritten automatically: the queue offers **Replace** (an explicit overwrite retry) or **Skip**.

Uploads use the authenticated runtime-files BFF endpoint. The XHR progress helper accepts an abort signal and preserves stable operation error messages, including HTTP 409 conflicts. Successful uploads update the exact destination cache immediately.

## Mutations

Create Folder and Rename share one validated name dialog. Names are trimmed and must be 1–255 characters; `.`, `..`, path separators, NULs, and control characters are rejected. Rename only changes the final path component and cannot move an entry to another folder.

Delete uses `ConfirmMutationDialog`. Deleting a directory recursively and permanently removes everything below it; the confirmation states this explicitly. `/data` itself cannot be renamed or deleted. Successful create, rename, delete, and upload operations update the active cache and invalidate affected folder-tree queries.

## Permissions and audit records

- `applications:transfer-files` gates folder listing, previews, upload, and download.
- `applications:manage-files` gates create-directory, rename, and delete. It is not part of default user permissions and must be explicitly granted to a non-admin user.
- Administrators bypass the individual file permission checks, but the runtime operation remains authenticated and ownership checked.

Upload, download, create-directory, rename, and delete produce application audit events. Audit details contain paths, names, entry types, and whether an upload was an explicit replacement; file contents are never recorded.

## Orchestrator path and preview rules

All runtime paths are normalized and must resolve within `/data`. Entry names cannot contain separators. Existing paths and parent directories are resolved inside the container before use; symbolic links, traversal, NULs, root mutation, missing parents, invalid entry types, and destination conflicts are rejected. Shell commands use individually quoted, validated paths and no path globs.

`GET /apps/{id}/runtime/data-files` performs one depth-bounded metadata scan. It does not recursively count directory children, so directory `itemCount` is `null` and the UI displays **Folder**.

The preview endpoint accepts JPEG, PNG, WebP, and the first GIF frame. SVG and non-images are rejected. Source archive reads stop at 25 MiB, Sharp limits decoded pixels, orientation is applied, and output is a WebP no larger than 1280×960 without enlargement. The orchestrator keeps a bounded 64-entry preview cache keyed by container, canonical path, and modification timestamp; the BFF also returns a private five-minute cache policy.

## Runtime API surface

| Operation     | Endpoint                                                | Purpose                                     |
| ------------- | ------------------------------------------------------- | ------------------------------------------- |
| List          | `GET /apps/{id}/runtime/data-files?path=…`              | One folder's metadata                       |
| Upload        | `POST /apps/{id}/runtime/data-files?path=…&overwrite=…` | Stream one file; overwrite must be explicit |
| Create folder | `POST /apps/{id}/runtime/data-directories`              | Create one child under `parentPath`         |
| Rename        | `PATCH /apps/{id}/runtime/data-files`                   | Rename within the same parent               |
| Delete        | `DELETE /apps/{id}/runtime/data-files?path=…`           | Permanently remove a file or directory tree |
| Preview       | `GET /apps/{id}/runtime/data-files/preview?path=…`      | Return a bounded WebP                       |
| Download      | `GET /apps/{id}/runtime/data-files/download?path=…`     | Return file data for download               |

The browser consumes list, preview, and upload through `/api/bff/applications/{id}/runtime/files/*`. Mutations and download use safe Server Actions that return the shared operation result with a request ID and stable error code.
