# AMD hardware acceleration in Rebroid

Research date: **2026-11-11**. Scope: source and documentation review only; no Docker, Android, ADB, GPU, or performance experiments were run. User-provided environment: Linux/x64 Docker host, **Ryzen 7 4800U with Radeon Graphics**, working Jellyfin VA-API, and working Android 16 in Rebroid. “Reported” below means upstream authors' results, not independent verification. Recommendations are proposed future work.

## Recommendation

**Pursue host rendering first, then an opt-in H.264 encoding experiment. Keep the working Android 16 configuration as the baseline.** Forge supplies a credible implementation to study, but its `hwenc` compatibility manifest admits **Android 11 and 15 only**. The published artifacts likewise target those versions. Treat Android 16 as a port/qualification task, not a supported configuration unlocked by an environment variable. [Forge manifest][manifest] [Release v0.2.0][release]

The 4800U belongs to AMD's Ryzen 4000 mobile family; Jellyfin documents Renoir/VCN2 and Linux RadeonSI VA-API support. That makes this a reasonable H.264 candidate. It does **not** establish that Forge's buffer import, Android component, and driver combination works on this exact machine. Upstream inconsistently calls its Ryzen 5700G test machine “Renoir” in some passages and “Cezanne-family” elsewhere; those reports must not be relabeled as a 4800U test. [AMD announcement][amd] [Jellyfin AMD guide][jellyfin] [Upstream compatibility][hwreadme] [Backend report][tier5]

## Four different acceleration paths

| Work | Relevant mechanism | Meaning for Rebroid |
| --- | --- | --- |
| Android UI/game rendering | Redroid `androidboot.redroid_gpu_mode=host` | GPU rendering replaces guest software rendering; upstream documents this independently of codecs. [Redroid configuration][redroid] |
| Android screen encoding | Android MediaCodec → custom Codec2 encoder → host VA-API daemon | This is Forge `hwenc`, supplying `c2.hardware.encoder.h264`; passing a GPU alone does not install it. [Integration][integrate] [Component][component] |
| Video playback inside Android apps | Separate Codec2 hardware decoders and daemon decode service | Forge exposes `hwdec` separately, currently Android-15-only; it is unnecessary for encoding the Android screen. [Decode manifest][decode-manifest] |
| Viewer decoding/transport | Browser WebRTC, WebCodecs, or MediaSource | Rebroid already forwards encoded video without transcoding; its Go bridge is not a missing host encoder. Host VA-API does not accelerate a remote viewer's browser GPU. [Rebroid streaming design][streaming] |

Working Jellyfin is useful evidence for that application's driver/device access. Jellyfin packages its own Mesa userspace driver, whereas Forge installs its own runtime dependencies. Therefore it is not proof that another daemon has identical drivers or permissions. H.264 is the practical initial target; neither the Android component nor its registration provides an HEVC encoder despite broader wording in the research repository's introduction. [Jellyfin AMD guide][jellyfin] [Forge build][dockerfile] [Component][component] [Codec registration][codec-service]

These mechanisms address rendering and screen compression. Expecting them to remove general application CPU work, ARM translation, OCR, or audio costs would be an unsupported inference. No speedup, CPU reduction, latency, or instance-count estimate for this host follows from the sources reviewed.

## What Forge actually integrates

The authoritative implementation is the module manifest and code, not every README paragraph. `hwenc/integrate.js` installs the shared service and registers **only the encoder**; `hwdec` controls decoder registration. The older module README still describes both together. [Integration][integrate] [Module README][module-readme]

Forge's hooks perform four distinct jobs:

1. **Before container creation:** bind the host socket directory into Android at `/dev/vaapi-helper`.
2. **Before first boot:** copy the Codec2 service, init file, seccomp policy, VINTF declaration, and shared-library closure into `/vendor`; patch `media_codecs.xml`; install an early-init `AMD_DEBUG=nodcc` setting for the reported AMD DCC import restriction.
3. **Before starting:** ensure the daemon exists and is running.
4. **After boot:** select the relevant Codec2 HAL and restart `mediaserver`. Android 15 uses `media.c2.hal.selection=aidl`; Android 11 additionally waits for boot completion, patches `libion` copies, and selects `debug.stagefright.ccodec=4`. These are invasive integration steps, not scrcpy switches. [Shared integration code][codec-service] [DCC init file][nodcc]

The daemon is outside the **Android** container. Contrary to the manifest's blanket “outside any container” wording, Forge's shipped Compose runs its backend in a privileged container with host PID/network access; `hwAccel.js` spawns the daemon as that backend's child. The backend image builds the daemon with VA-API/Mesa dependencies. Rebroid need not copy this deployment architecture. [Compose][compose] [Daemon supervision][hwaccel] [Build][dockerfile]

Android passes a dma-buf file descriptor and frame metadata over a Unix socket using `SCM_RIGHTS`. The daemon imports the frame, performs RGBA→NV12 conversion where needed, encodes H.264, and returns compressed bytes. The FFmpeg backend currently adds a GPU→RAM→GPU transfer rather than sharing the original VA display/surface directly. This is not an end-to-end zero-copy claim. [Protocol][protocol] [Backend design][tier5]

## Artifacts, Android 16, and source drift

Published binaries **do exist**: v0.1.0 appeared November 7, and v0.2.0 November 9, 2026. The latter provides `redroid-hwenc-vaapi-artifacts-v0.2.0.tar.gz`, containing Android 15 AIDL artifacts plus `android11-hidl/`. The release explicitly says its AIDL payload is unchanged from v0.1.0. GitHub reports SHA-256 `8263a2e50084b39648150c202e4633d4aeec21d6f6dd2eada392ec6c2742b9a6`; this research did not download or verify the archive. Forge's comments claiming that no release exists are stale. Its integration still expects an explicitly configured local `REDROID_HWENC_ARTIFACTS_DIR`. [Release metadata][release-api] [Release instructions][release] [Artifact loader][codec-service]

The bundled catalog snapshot contains an Android 15 amd64 base, not an Android 16 qualification record. `variantFor()` routes versions ≥14 to the AIDL path, but a routing branch is not evidence of binary compatibility. Android 16 requires checking the exact base image, vendor library dependencies, HAL registration, and buffer layout. The component reads dimensions/stride from empirical native-handle offsets `ints[2]`, `ints[3]`, and `ints[6]`; this is a concrete reason not to copy Android 15 libraries blindly. [Catalog snapshot][snapshot] [Artifact loader][codec-service] [Buffer extraction][component-layout]

There is source drift: Forge's component forwards a bitrate field, while the examined `redroid-hwenc` component does not; Forge's protocol accepts the older shorter request as an unspecified bitrate. Release text alone does not establish which source revision produced every binary. Pin and verify the **image + Android component + daemon/protocol** combination together. [Forge component][component] [Research component][research-component] [Protocol][protocol]

## AMD evidence and limits

Upstream reports successful real scrcpy encoding on AMD APUs and RX 480 using the legacy backend. It reports successful FFmpeg encoding on the Ryzen 5700G and Intel Iris Xe, but GPU hangs/reset incidents with FFmpeg on Polaris/RX 400–500; it separately reports hangs combining encode and decode on Polaris. The 4800U is not Polaris, so this is not evidence that it will hang; equally, it does not prove its safety. Start with **encode only, legacy backend**, then compare alternatives on this actual host. [Hardware reports][hwreadme] [Backend reports][tier5] [Module restrictions][manifest]

Legacy defaults to all-intra output. Optional P-frames improve compression in upstream's reported scrolling-screen tests, but its shared encoder retains one stream's reference state: interleaved instances force IDRs. The FFmpeg path has an extra transfer, and upstream's quality/bitrate examples are not a controlled Rebroid CPU or latency benchmark. No reviewed result measures this 4800U, Android 16, multiple Rebroid viewers, or simultaneous Jellyfin load. [GOP and backend report][tier5]

**RBD1 qualification blocker:** both inspected Android component sources attach `C2Config::SYNC_FRAME` unconditionally to each output buffer, while the daemon supports optional P-frames. This is a static compatibility concern, not a reproduced Rebroid failure. Rebroid recovery requires correct configuration/keyframe flags and an actual IDR after a dropped GOP. Before enabling P-frames, compare emitted NAL types with MediaCodec/scrcpy/RBD1 flags and correct the producer if they disagree. All-intra is a conservative experiment baseline, not a guarantee of acceptable bandwidth or recovery. [Forge output flag][component-sync] [Research output flag][research-sync] [P-frame behavior][tier5] [RBD1 invariants][streaming]

Also validate complete scrcpy reset-video recovery, configuration emission, timestamp continuity, rotation/resizing, and codec-generation transitions. Rebroid sends reset-video over the existing control socket; this is distinct from assuming that a MediaCodec request-sync-frame parameter works. Preserve the current awaited ADB commands, listener/socket-read order, process launch, and cleanup. [Rebroid recovery contract][streaming] [Repository instructions][agents]

## Rebroid integration seams

Current defaults explicitly choose `guest`. The orchestrator reads `REDROID_DEVICES` and optional devices, but its standard Compose does not forward those variables. Provisioning currently creates the profile-data mount and has no VA-API socket mount. If a configured optional device is missing, the adapter retries without **all** optional devices; required GPU access must not silently ride that fallback. [Runtime defaults][runtime] [Environment parsing][config] [Deployment Compose][rebroid-compose] [Container provisioning][provisioning]

`SCRCPY_VIDEO_ENCODER` is currently a global sidecar setting forwarded at server startup. Pinning it to `c2.hardware.encoder.h264` would affect incompatible images too. Upstream scrcpy's named-encoder branch raises an error if that encoder is absent; it does not silently choose a software replacement. A future capability policy must select a compatible encoder **before** entering the protected startup sequence. Software fallback must be deliberate and visible, with consumer/source ownership preserved. [Sidecar config][sidecar-config] [Server arguments][scrcpy-service] [scrcpy selection][scrcpy-selection]

## Proposed implementation and validation stages

1. **Record a baseline and capability inventory.** Record actual render-node identity, kernel/Mesa/libva versions, VA-API H.264 encode capability, image digest, and enumerated Android codecs. Measure idle UI, scrolling, and video independently; include total host CPU, daemon CPU, frame delivery, bitrate, latency, and Jellyfin contention. These are future checks, not work performed here.
2. **Qualify host rendering alone.** Use an opt-in image/application policy and required device mapping. Preserve current guest defaults and profiles. Verify Android 16 rendering independently before adding encoding, so regressions have a clear cause. [Redroid modes][redroid] [Runtime defaults][runtime]
3. **Build a reproducible encoder image.** An Android 15 disposable control can establish that the published path works locally; the deliverable remains an Android 16-compatible image. Pin provenance/digests, inspect dependencies and licenses, and bake registration, properties, init configuration, and vendor artifacts into a derived image before activation. If Android 16 still requires Forge-style post-boot media restarts, stop rollout under the current startup constraint rather than quietly adding a hook. Host rendering and changed image initialization still require manual boot verification even when scrcpy socket ordering is untouched. Keep lifecycle integration behind the owning services and Docker ports; preserve profile volumes when replacing a runtime container. [Artifacts][release] [Integration][codec-service] [Architecture constraints][agents]
4. **Add a bounded daemon and capability contract.** Prefer a dedicated, least-privileged service with only the selected DRM node and controlled socket directory. Advertise validated image/codec/backend combinations, health, and unavailable reasons. Use opt-in `off`/`prefer`/`require` semantics: `prefer` may select the known software path before startup; `require` fails clearly. This is a proposal, not existing behavior.
5. **Qualify media semantics, then performance.** Start H.264 legacy/all-intra and decode disabled. Verify NAL/flag agreement, configuration plus IDR recovery, full reset-video, rotation, reconnect, queue overflow, source sharing, multiple applications, daemon failure, and GPU reset handling. Only then test P-frames or FFmpeg. A transport failure must detach its consumer without restarting ADB/scrcpy. Runtime/source failure recovery must remain bounded and respect lifecycle reservations. [RBD1/source contract][streaming] [Upstream risks][tier5]
6. **Document and gate rollout.** Publish the measured support matrix for exact GPU/image/driver/backend combinations, fallback behavior, operational limits, and deployment requirements. Keep Android 16 support experimental until the manual Redroid verification passes. Update the relevant deployment/streaming guides; do not claim production readiness from this research.

## Security, licensing, and maturity

Forge creates the socket directory with mode `0777`; the daemon makes the socket `0666`. In the inspected encode handler, peer credentials identify the stream PID, not an authorization allowlist. The accept loop processes encode requests synchronously, and decode sessions create detached threads; no socket read/write deadlines or global session cap were found in this file. These are review findings for a future deployment boundary, not proof of an exploitable vulnerability. Tighten peer admission, directory ownership, input/FD validation, deadlines, concurrency, and shutdown before multi-user use; do not give the encoder daemon the Docker socket. [Supervision][hwaccel] [Daemon source][daemon]

Both projects use Apache-2.0, but packaged Android libraries and FFmpeg retain their own licenses. Forge deliberately builds a restricted, dynamically linked FFmpeg configuration with GPL/nonfree components disabled. FFmpeg's own guidance requires corresponding source and build/license information when distributing its libraries; copying Forge's Dockerfile does not by itself complete redistribution compliance. Preserve notices and inspect the actual binary dependency set. [Forge license][forge-license] [Research license][hwenc-license] [Build flags][dockerfile] [FFmpeg licensing][ffmpeg-license]

This is a recent, small hardware test matrix with published artifacts and substantive working code, alongside stale documentation, source/artifact provenance gaps, known GPU failures, and unqualified Android 16 behavior. The appropriate next step is a bounded experiment and reproducible integration, not a global default change. [Releases][release-api] [Compatibility][hwreadme] [Manifest][manifest]

## Source snapshot

Forge was reviewed at `94c27179f0eaa50205746820a8754ec4d189ea22` (2026-11-09), and `redroid-hwenc` at `98f9f4245788f5e499f695e1e62d86a4ba214da5` (2026-11-09). Upstream code links below are pinned. Rebroid links refer to the inspected working checkout, which already contained unrelated changes. Neither a root glossary nor `docs/adr/` was present during this review.

[manifest]: https://github.com/fogelmanjg/redroid-forge/blob/94c27179f0eaa50205746820a8754ec4d189ea22/backend/src/modules/hwenc/manifest.json
[release]: https://github.com/fogelmanjg/redroid-hwenc/releases/tag/v0.2.0
[release-api]: https://api.github.com/repos/fogelmanjg/redroid-hwenc/releases
[amd]: https://ir.amd.com/news-events/press-releases/detail/926/amd-announces-worlds-highest-performance-desktop-and-ultrathin-laptop-processors-at-ces-2020
[jellyfin]: https://jellyfin.org/docs/general/post-install/transcoding/hardware-acceleration/amd/
[hwreadme]: https://github.com/fogelmanjg/redroid-hwenc/blob/98f9f4245788f5e499f695e1e62d86a4ba214da5/README.md
[tier5]: https://github.com/fogelmanjg/redroid-hwenc/blob/98f9f4245788f5e499f695e1e62d86a4ba214da5/tier5-vaapi-daemon/README.md
[redroid]: https://github.com/remote-android/redroid-doc#configuration
[integrate]: https://github.com/fogelmanjg/redroid-forge/blob/94c27179f0eaa50205746820a8754ec4d189ea22/backend/src/modules/hwenc/integrate.js
[module-readme]: https://github.com/fogelmanjg/redroid-forge/blob/94c27179f0eaa50205746820a8754ec4d189ea22/backend/src/modules/hwenc/README.md
[component]: https://github.com/fogelmanjg/redroid-forge/blob/94c27179f0eaa50205746820a8754ec4d189ea22/android/vaapi_codec2/component/VaapiEncComponent.cpp
[component-layout]: https://github.com/fogelmanjg/redroid-forge/blob/94c27179f0eaa50205746820a8754ec4d189ea22/android/vaapi_codec2/component/VaapiEncComponent.cpp#L299-L302
[component-sync]: https://github.com/fogelmanjg/redroid-forge/blob/94c27179f0eaa50205746820a8754ec4d189ea22/android/vaapi_codec2/component/VaapiEncComponent.cpp#L356-L358
[research-component]: https://github.com/fogelmanjg/redroid-hwenc/blob/98f9f4245788f5e499f695e1e62d86a4ba214da5/tier5-vaapi-daemon/codec2-component/VaapiEncComponent.cpp
[research-sync]: https://github.com/fogelmanjg/redroid-hwenc/blob/98f9f4245788f5e499f695e1e62d86a4ba214da5/tier5-vaapi-daemon/codec2-component/VaapiEncComponent.cpp#L349-L351
[decode-manifest]: https://github.com/fogelmanjg/redroid-forge/blob/94c27179f0eaa50205746820a8754ec4d189ea22/backend/src/modules/hwdec/manifest.json
[dockerfile]: https://github.com/fogelmanjg/redroid-forge/blob/94c27179f0eaa50205746820a8754ec4d189ea22/Dockerfile
[codec-service]: https://github.com/fogelmanjg/redroid-forge/blob/94c27179f0eaa50205746820a8754ec4d189ea22/backend/src/lib/codec2Service.js
[nodcc]: https://github.com/fogelmanjg/redroid-forge/blob/94c27179f0eaa50205746820a8754ec4d189ea22/backend/src/modules/hwenc/redroid-nodcc.rc
[compose]: https://github.com/fogelmanjg/redroid-forge/blob/94c27179f0eaa50205746820a8754ec4d189ea22/docker-compose.yml
[hwaccel]: https://github.com/fogelmanjg/redroid-forge/blob/94c27179f0eaa50205746820a8754ec4d189ea22/backend/src/lib/hwAccel.js
[protocol]: https://github.com/fogelmanjg/redroid-forge/blob/94c27179f0eaa50205746820a8754ec4d189ea22/backend/native/vaapi-daemon/protocol.h
[snapshot]: https://github.com/fogelmanjg/redroid-forge/blob/94c27179f0eaa50205746820a8754ec4d189ea22/backend/db/snapshot.json
[daemon]: https://github.com/fogelmanjg/redroid-forge/blob/94c27179f0eaa50205746820a8754ec4d189ea22/backend/native/vaapi-daemon/daemon.c
[scrcpy-selection]: https://github.com/Genymobile/scrcpy/blob/v5.0.1/server/src/main/java/com/genymobile/scrcpy/video/SurfaceEncoder.java#L280-L301
[forge-license]: https://github.com/fogelmanjg/redroid-forge/blob/94c27179f0eaa50205746820a8754ec4d189ea22/LICENSE
[hwenc-license]: https://github.com/fogelmanjg/redroid-hwenc/blob/98f9f4245788f5e499f695e1e62d86a4ba214da5/LICENSE
[ffmpeg-license]: https://ffmpeg.org/legal.html
[streaming]: ../display-streaming.md
[agents]: ../../AGENTS.md
[runtime]: ../../packages/android-application-core/src/redroid-runtime.ts
[config]: ../../apps/orchestrator/src/config/app-config-sections.ts
[rebroid-compose]: ../../deploy/compose.yaml
[provisioning]: ../../apps/orchestrator/src/docker/containers/services/docker-container-provisioning.service.ts
[sidecar-config]: ../../apps/display-sidecar/src/modules/shared/sidecar-config.service.ts
[scrcpy-service]: ../../apps/display-sidecar/src/modules/scrcpy/scrcpy.service.ts
