'use client';

export const CDN_MODEL_URL = 'https://cdn.jsdelivr.net/npm/@vladmandic/face-api/model';
export const FACE_MATCH_THRESHOLD = 0.5;

// Lazy reference to faceapi module so it is never evaluated during SSR / prerender build
let faceapiModule: unknown = null;
let modelsLoadingPromise: Promise<void> | null = null;
let modelsLoaded = false;

export async function getFaceApi(): Promise<any> {
  if (typeof window === 'undefined') return null;
  if (!faceapiModule) {
    // Dynamic import to prevent SSR evaluation
    const imported = await import('@vladmandic/face-api');
    faceapiModule = imported.default || imported;
  }
  return faceapiModule;
}

export interface FaceDetectionResult {
  success: boolean;
  count: number;
  descriptor?: number[];
  confidence?: number;
  detectorUsed?: string;
  detectionBox?: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  normalizedCanvas?: HTMLCanvasElement;
  error?: string;
}

/**
 * Loads SSD MobileNet v1, Tiny Face Detector, Landmark 68, and Recognition models from CDN.
 */
export async function loadFaceApiModels(
  onProgress?: (status: string) => void
): Promise<void> {
  if (typeof window === 'undefined') return;

  if (modelsLoaded) {
    onProgress?.('Models ready');
    return;
  }

  if (modelsLoadingPromise) {
    return modelsLoadingPromise;
  }

  modelsLoadingPromise = (async () => {
    try {
      onProgress?.('Initializing Face AI engine...');
      const faceapi = await getFaceApi();
      if (!faceapi) {
        throw new Error('Face API can only be initialized in the browser.');
      }

      // Load SSD MobileNet v1 face detector
      onProgress?.('Loading primary face detector (SSD MobileNet)...');
      await faceapi.nets.ssdMobilenetv1.loadFromUri(CDN_MODEL_URL);

      // Load Tiny Face Detector as fallback for high-res/mobile portrait images
      onProgress?.('Loading lightweight portrait detector...');
      await faceapi.nets.tinyFaceDetector.loadFromUri(CDN_MODEL_URL);

      // Load 68-point face landmark detector
      onProgress?.('Loading facial landmark model...');
      await faceapi.nets.faceLandmark68Net.loadFromUri(CDN_MODEL_URL);

      // Load 128-D face recognition descriptor model
      onProgress?.('Loading biometric recognition model...');
      await faceapi.nets.faceRecognitionNet.loadFromUri(CDN_MODEL_URL);

      modelsLoaded = true;
      onProgress?.('Face recognition models ready');
    } catch (err: unknown) {
      modelsLoadingPromise = null;
      modelsLoaded = false;
      const message = err instanceof Error ? err.message : 'Unknown error';
      console.error('Failed to load face-api models from CDN:', err);
      throw new Error(`Failed to load face-api models: ${message}`);
    }
  })();

  return modelsLoadingPromise;
}

export function areModelsLoaded(): boolean {
  return modelsLoaded;
}

/**
 * Converts any File, Blob, or Image into an upright, properly scaled HTMLCanvasElement.
 * This resolves EXIF rotation issues and prevents receptive field mismatch in SSD MobileNet.
 */
export async function fileToNormalizedCanvas(
  fileOrBlob: Blob,
  maxDimension = 1024
): Promise<HTMLCanvasElement> {
  // 1. Try createImageBitmap (automatically applies EXIF orientation)
  if (typeof window !== 'undefined' && 'createImageBitmap' in window) {
    try {
      const bitmap = await createImageBitmap(fileOrBlob);
      const canvas = document.createElement('canvas');
      let width = bitmap.width;
      let height = bitmap.height;

      if (width > maxDimension || height > maxDimension) {
        if (width > height) {
          height = Math.round((height * maxDimension) / width);
          width = maxDimension;
        } else {
          width = Math.round((width * maxDimension) / height);
          height = maxDimension;
        }
      }

      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      if (!ctx) throw new Error('Could not create 2D canvas context');
      ctx.drawImage(bitmap, 0, 0, width, height);
      bitmap.close();
      return canvas;
    } catch (err) {
      console.warn('createImageBitmap failed, trying FileReader:', err);
    }
  }

  // 2. Fallback: FileReader + Image element without crossOrigin to prevent canvas tainting
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      // DO NOT set crossOrigin on data/blob URLs
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.naturalWidth || img.width;
        let height = img.naturalHeight || img.height;

        if (width > maxDimension || height > maxDimension) {
          if (width > height) {
            height = Math.round((height * maxDimension) / width);
            width = maxDimension;
          } else {
            width = Math.round((width * maxDimension) / height);
            height = maxDimension;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        if (!ctx) {
          reject(new Error('Canvas 2D context error'));
          return;
        }
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas);
      };
      img.onerror = () => reject(new Error('Failed to load image into element'));
      img.src = reader.result as string;
    };
    reader.onerror = () => reject(new Error('Failed to read image file'));
    reader.readAsDataURL(fileOrBlob);
  });
}

/**
 * Detects faces using a multi-pass adaptive cascade:
 * 1. SSD MobileNet v1 (confidence 0.35)
 * 2. SSD MobileNet v1 (confidence 0.20)
 * 3. Tiny Face Detector (inputSize 416, threshold 0.25)
 * 4. Tiny Face Detector (inputSize 512, threshold 0.15)
 * Enforces rule: Exactly one face must be present.
 */
export async function detectAndDescribeSingleFace(
  input: HTMLImageElement | HTMLCanvasElement | HTMLVideoElement
): Promise<FaceDetectionResult> {
  const faceapi = await getFaceApi();
  if (!faceapi) {
    return { success: false, count: 0, error: 'Face API is not supported in this environment.' };
  }

  if (!modelsLoaded) {
    await loadFaceApiModels();
  }

  // Ensure input canvas has dimensions
  let targetInput: HTMLCanvasElement | HTMLImageElement | HTMLVideoElement = input;
  if (input instanceof HTMLImageElement && (input.naturalWidth > 1200 || input.naturalHeight > 1200)) {
    const canvas = document.createElement('canvas');
    const maxDim = 1024;
    let w = input.naturalWidth || input.width;
    let h = input.naturalHeight || input.height;
    if (w > maxDim || h > maxDim) {
      if (w > h) {
        h = Math.round((h * maxDim) / w);
        w = maxDim;
      } else {
        w = Math.round((w * maxDim) / h);
        h = maxDim;
      }
    }
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (ctx) {
      ctx.drawImage(input, 0, 0, w, h);
      targetInput = canvas;
    }
  }

  // Cascade Pass 1: SSD MobileNet v1 (Standard 0.35)
  let detections: any[] = [];
  let detectorUsed = 'SSD MobileNet v1 (0.35)';

  try {
    detections = await faceapi
      .detectAllFaces(targetInput, new faceapi.SsdMobilenetv1Options({ minConfidence: 0.35 }))
      .withFaceLandmarks()
      .withFaceDescriptors();
  } catch (err) {
    console.warn('SSD MobileNet pass 1 error:', err);
  }

  // Cascade Pass 2: SSD MobileNet v1 with lower confidence (0.20)
  if (detections.length === 0) {
    try {
      detectorUsed = 'SSD MobileNet v1 (0.20)';
      detections = await faceapi
        .detectAllFaces(targetInput, new faceapi.SsdMobilenetv1Options({ minConfidence: 0.20 }))
        .withFaceLandmarks()
        .withFaceDescriptors();
    } catch (err) {
      console.warn('SSD MobileNet pass 2 error:', err);
    }
  }

  // Cascade Pass 3: Tiny Face Detector (size 416, threshold 0.25)
  if (detections.length === 0 && faceapi.nets.tinyFaceDetector.params) {
    try {
      detectorUsed = 'Tiny Face Detector (416)';
      detections = await faceapi
        .detectAllFaces(
          targetInput,
          new faceapi.TinyFaceDetectorOptions({ inputSize: 416, scoreThreshold: 0.25 })
        )
        .withFaceLandmarks()
        .withFaceDescriptors();
    } catch (err) {
      console.warn('TinyFaceDetector pass 3 error:', err);
    }
  }

  // Cascade Pass 4: Tiny Face Detector (size 512, threshold 0.15)
  if (detections.length === 0 && faceapi.nets.tinyFaceDetector.params) {
    try {
      detectorUsed = 'Tiny Face Detector (512, high sensitivity)';
      detections = await faceapi
        .detectAllFaces(
          targetInput,
          new faceapi.TinyFaceDetectorOptions({ inputSize: 512, scoreThreshold: 0.15 })
        )
        .withFaceLandmarks()
        .withFaceDescriptors();
    } catch (err) {
      console.warn('TinyFaceDetector pass 4 error:', err);
    }
  }

  const count = detections.length;

  if (count === 0) {
    return {
      success: false,
      count: 0,
      error: 'No face detected in the image. Please upload a clear photo with the face centered, upright, and well-lit.',
    };
  }

  if (count > 1) {
    return {
      success: false,
      count,
      error: `Detected ${count} faces in the image. Exactly ONE face is required for employee registration.`,
    };
  }

  const single = detections[0];
  const descriptorArray = Array.from(single.descriptor as Float32Array).map(Number);
  const score = single.detection?.score ?? single.score ?? 0.95;

  return {
    success: true,
    count: 1,
    descriptor: descriptorArray,
    confidence: Math.round(score * 100),
    detectorUsed,
    detectionBox: {
      x: Math.round(single.detection.box.x),
      y: Math.round(single.detection.box.y),
      width: Math.round(single.detection.box.width),
      height: Math.round(single.detection.box.height),
    },
  };
}

/**
 * Detects face from live video stream frame.
 */
/**
 * Detects face from live video stream frame.
 * Downsamples high-res video streams to max 640px width for responsive real-time recognition.
 */
export async function detectFaceFromLiveVideo(
  video: HTMLVideoElement
): Promise<FaceDetectionResult> {
  const faceapi = await getFaceApi();
  if (!faceapi) {
    return { success: false, count: 0, error: 'Face API is not supported in this environment.' };
  }

  if (!modelsLoaded) {
    await loadFaceApiModels();
  }

  // Downsample to max width 640 for rapid real-time frame scanning
  let w = video.videoWidth || 640;
  let h = video.videoHeight || 480;
  if (w > 640) {
    h = Math.round((h * 640) / w);
    w = 640;
  }

  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) {
    throw new Error('Could not create canvas context to capture camera frame.');
  }
  ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

  return detectAndDescribeSingleFace(canvas);
}

/**
 * Calculates Euclidean Distance between two 128-D biometric descriptors:
 * d(p, q) = sqrt(sum((p_i - q_i)^2))
 */
export function calculateEuclideanDistance(
  descA: number[],
  descB: number[]
): number {
  if (!descA || !descB || descA.length === 0 || descB.length === 0) {
    return 1.0;
  }

  const length = Math.min(descA.length, descB.length);
  let sumSq = 0;

  for (let i = 0; i < length; i++) {
    const diff = descA[i] - descB[i];
    sumSq += diff * diff;
  }

  const dist = Math.sqrt(sumSq);
  return Math.round(dist * 10000) / 10000;
}

/**
 * Evaluates whether two face descriptors match according to the 0.5 threshold.
 */
export function verifyFaceDescriptors(
  storedDescriptor: number[],
  capturedDescriptor: number[],
  threshold = FACE_MATCH_THRESHOLD
): { matched: boolean; distance: number; threshold: number } {
  const distance = calculateEuclideanDistance(storedDescriptor, capturedDescriptor);
  const matched = distance < threshold;
  return {
    matched,
    distance,
    threshold,
  };
}
