# MediaPipe assets

MediaPipe Tasks Vision 0.10.32 is copyright Google LLC, licensed under Apache License 2.0:
https://github.com/google-ai-edge/mediapipe/blob/master/LICENSE

BlazeFace short-range float16 model, version 1, from Google's official model repository:
https://storage.googleapis.com/mediapipe-models/face_detector/blaze_face_short_range/float16/1/blaze_face_short_range.tflite

Model SHA-256: b4578f35940bf5a1a655214a1cce5cab13eba73c1297cd78e1a04c2380b0152f

Runtime assets are copied from the locked npm dependency by scripts/prepare-media.mjs before dev/build.
No CDN script is executed at runtime. Model and WASM requests go to this application's own origin.

Optional phone-candidate filter: EfficientDet-Lite0 INT8, version 1, Apache-2.0 Google model:
https://storage.googleapis.com/mediapipe-models/object_detector/efficientdet_lite0/int8/1/efficientdet_lite0.tflite

SHA-256: 0720bf247bd76e6594ea28fa9c6f7c5242be774818997dbbeffc4da460c723bb
The filter only returns phone candidates locally; optional external confirmation requires separate consent.
