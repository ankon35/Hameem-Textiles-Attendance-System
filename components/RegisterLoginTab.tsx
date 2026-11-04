'use client';

import React, { useState, useRef, useEffect } from 'react';
import {
  Upload,
  UserCheck,
  AlertCircle,
  CheckCircle2,
  Loader2,
  LogIn,
  Info,
  Shield,
  Scan,
  RefreshCw,
  Sparkles,
} from 'lucide-react';
import { Employee } from '@/types/attendance';
import {
  detectAndDescribeSingleFace,
  fileToNormalizedCanvas,
  areModelsLoaded,
  loadFaceApiModels,
  FaceDetectionResult,
} from '@/lib/faceApi';
import {
  findEmployeeById,
  registerEmployee,
  uploadEmployeePhoto,
} from '@/lib/supabase';

interface Props {
  onEmployeeLoggedIn: (employee: Employee) => void;
  onNavigateToAttendance: () => void;
  modelsLoaded: boolean;
}

export function RegisterLoginTab({
  onEmployeeLoggedIn,
  onNavigateToAttendance,
  modelsLoaded,
}: Props) {
  const [mode, setMode] = useState<'register' | 'login'>('register');

  // Form State
  const [name, setName] = useState('');
  const [employeeId, setEmployeeId] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | Blob | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  // Face Detection State
  const [analyzingFace, setAnalyzingFace] = useState(false);
  const [faceDescriptor, setFaceDescriptor] = useState<number[] | null>(null);
  const [faceStatus, setFaceStatus] = useState<{
    valid: boolean;
    count: number;
    message?: string;
    confidence?: number;
    detectorUsed?: string;
  } | null>(null);

  // Submission State
  const [submitting, setSubmitting] = useState(false);
  const [generalError, setGeneralError] = useState<string | null>(null);
  const [generalSuccess, setGeneralSuccess] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const overlayCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const [detectionBox, setDetectionBox] = useState<FaceDetectionResult['detectionBox'] | null>(null);
  const [normalizedCanvasDimensions, setNormalizedCanvasDimensions] = useState<{
    width: number;
    height: number;
  } | null>(null);

  // Draw face bounding box overlay whenever detectionBox changes
  useEffect(() => {
    const canvas = overlayCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    if (detectionBox && normalizedCanvasDimensions) {
      const scaleX = canvas.width / normalizedCanvasDimensions.width;
      const scaleY = canvas.height / normalizedCanvasDimensions.height;

      const bx = detectionBox.x * scaleX;
      const by = detectionBox.y * scaleY;
      const bw = detectionBox.width * scaleX;
      const bh = detectionBox.height * scaleY;

      // Draw bounding box
      ctx.strokeStyle = '#10b981'; // emerald-500
      ctx.lineWidth = 3;
      ctx.strokeRect(bx, by, bw, bh);

      // Draw subtle corner accents
      const cornerLen = 12;
      ctx.strokeStyle = '#34d399';
      ctx.lineWidth = 4;

      // Top-left corner
      ctx.beginPath();
      ctx.moveTo(bx, by + cornerLen);
      ctx.lineTo(bx, by);
      ctx.lineTo(bx + cornerLen, by);
      ctx.stroke();

      // Top-right corner
      ctx.beginPath();
      ctx.moveTo(bx + bw - cornerLen, by);
      ctx.lineTo(bx + bw, by);
      ctx.lineTo(bx + bw, by + cornerLen);
      ctx.stroke();

      // Bottom-left corner
      ctx.beginPath();
      ctx.moveTo(bx, by + bh - cornerLen);
      ctx.lineTo(bx, by + bh);
      ctx.lineTo(bx + cornerLen, by + bh);
      ctx.stroke();

      // Bottom-right corner
      ctx.beginPath();
      ctx.moveTo(bx + bw - cornerLen, by + bh);
      ctx.lineTo(bx + bw, by + bh);
      ctx.lineTo(bx + bw, by + bh - cornerLen);
      ctx.stroke();
    }
  }, [detectionBox, normalizedCanvasDimensions]);

  // Process and analyze an image File or Blob
  const processImageBlob = async (blob: Blob, fileName = 'face_photo.jpg') => {
    setGeneralError(null);
    setGeneralSuccess(null);
    setSelectedFile(blob);
    setFaceDescriptor(null);
    setFaceStatus(null);
    setDetectionBox(null);

    const objectUrl = URL.createObjectURL(blob);
    setPreviewUrl(objectUrl);

    setAnalyzingFace(true);
    try {
      if (!areModelsLoaded()) {
        await loadFaceApiModels();
      }

      // Convert to an upright, properly scaled canvas
      const normalizedCanvas = await fileToNormalizedCanvas(blob, 1024);
      setNormalizedCanvasDimensions({
        width: normalizedCanvas.width,
        height: normalizedCanvas.height,
      });

      // Run multi-pass detection cascade
      const result = await detectAndDescribeSingleFace(normalizedCanvas);

      if (result.success && result.descriptor) {
        setFaceDescriptor(result.descriptor);
        setDetectionBox(result.detectionBox || null);
        setFaceStatus({
          valid: true,
          count: 1,
          confidence: result.confidence,
          detectorUsed: result.detectorUsed,
          message: `Single face detected! 128-D biometric descriptor generated (${result.detectorUsed}, Confidence: ${result.confidence}%).`,
        });
      } else {
        setFaceDescriptor(null);
        setDetectionBox(null);
        setFaceStatus({
          valid: false,
          count: result.count,
          message:
            result.error ||
            'Face verification failed. Exactly one face must be clearly visible.',
        });
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error analyzing photo';
      setFaceStatus({
        valid: false,
        count: 0,
        message: msg,
      });
    } finally {
      setAnalyzingFace(false);
    }
  };

  // Handle Photo Selection from file input
  const handlePhotoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    await processImageBlob(file, file.name);
  };

  // Re-run analysis on current image
  const handleReanalyze = async () => {
    if (selectedFile) {
      await processImageBlob(selectedFile);
    }
  };

  // Submit Registration
  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setGeneralError(null);
    setGeneralSuccess(null);

    const cleanName = name.trim();
    const cleanId = employeeId.trim().toUpperCase();

    if (!cleanName || !cleanId) {
      setGeneralError('Please enter both Full Name and Employee ID.');
      return;
    }

    if (!selectedFile || !faceDescriptor || !faceStatus?.valid) {
      setGeneralError('A valid photo with exactly one detected face is required.');
      return;
    }

    setSubmitting(true);
    try {
      // Check if Employee ID already exists
      const existing = await findEmployeeById(cleanId);
      if (existing) {
        if (existing.name.toLowerCase() === cleanName.toLowerCase()) {
          setGeneralSuccess(
            `Employee ${cleanId} is already registered. Logging you in as ${existing.name}...`
          );
          setTimeout(() => {
            onEmployeeLoggedIn(existing);
            onNavigateToAttendance();
          }, 1000);
          return;
        } else {
          setGeneralError(
            `Employee ID "${cleanId}" is already registered to "${existing.name}". If this is you, use the correct name or sign in.`
          );
          setSubmitting(false);
          return;
        }
      }

      // Upload photo to Supabase Storage bucket 'employee_photos'
      const photoUrl = await uploadEmployeePhoto(selectedFile, cleanId);

      // Save to Supabase 'employees' table
      const registered = await registerEmployee({
        name: cleanName,
        employee_id: cleanId,
        photo_url: photoUrl,
        face_descriptor: faceDescriptor,
      });

      setGeneralSuccess(`Employee ${cleanName} (${cleanId}) registered successfully!`);
      setTimeout(() => {
        onEmployeeLoggedIn(registered);
        onNavigateToAttendance();
      }, 1200);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to register employee.';
      setGeneralError(msg);
    } finally {
      setSubmitting(false);
    }
  };

  // Submit Login
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setGeneralError(null);
    setGeneralSuccess(null);

    const cleanName = name.trim();
    const cleanId = employeeId.trim().toUpperCase();

    if (!cleanName || !cleanId) {
      setGeneralError('Please enter both Full Name and Employee ID.');
      return;
    }

    setSubmitting(true);
    try {
      const existing = await findEmployeeById(cleanId);
      if (!existing) {
        setGeneralError(
          `No employee found with ID "${cleanId}". Please register as a new employee first.`
        );
        return;
      }

      // Check name match
      if (existing.name.toLowerCase() !== cleanName.toLowerCase()) {
        setGeneralError(
          `Name mismatch for ${cleanId}. Registered name is "${existing.name}".`
        );
        return;
      }

      setGeneralSuccess(`Welcome back, ${existing.name}!`);
      setTimeout(() => {
        onEmployeeLoggedIn(existing);
        onNavigateToAttendance();
      }, 600);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Login failed.';
      setGeneralError(msg);
    } finally {
      setSubmitting(false);
    }
  };

  const handleFillDemo = () => {
    setName('Sarah Connor');
    setEmployeeId('EMP-101');
    setMode('login');
  };

  return (
    <div className="max-w-xl mx-auto space-y-6">
      {/* Mode Switcher */}
      <div className="bg-slate-900 border border-slate-800 p-1.5 rounded-2xl flex items-center shadow-lg">
        <button
          type="button"
          onClick={() => {
            setMode('register');
            setGeneralError(null);
            setGeneralSuccess(null);
          }}
          className={`flex-1 py-2.5 rounded-xl text-xs sm:text-sm font-semibold transition flex items-center justify-center gap-2 ${
            mode === 'register'
              ? 'bg-emerald-500 text-slate-950 shadow-md'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <UserCheck className="w-4 h-4" />
          Register New Employee
        </button>
        <button
          type="button"
          onClick={() => {
            setMode('login');
            setGeneralError(null);
            setGeneralSuccess(null);
          }}
          className={`flex-1 py-2.5 rounded-xl text-xs sm:text-sm font-semibold transition flex items-center justify-center gap-2 ${
            mode === 'login'
              ? 'bg-emerald-500 text-slate-950 shadow-md'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <LogIn className="w-4 h-4" />
          Employee Sign In
        </button>
      </div>

      {/* Main Card */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-xl space-y-6 relative overflow-hidden">
        {/* Decorative Top Accent */}
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-emerald-500 via-teal-400 to-emerald-600" />

        {/* Section Header */}
        <div className="space-y-1">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold text-white tracking-tight">
              {mode === 'register' ? 'Biometric Face Enrollment' : 'Employee Login'}
            </h2>
            <button
              type="button"
              onClick={handleFillDemo}
              className="text-[11px] text-emerald-400 hover:text-emerald-300 font-medium bg-emerald-500/10 px-2.5 py-1 rounded-lg border border-emerald-500/20 transition"
            >
              Demo: Sarah (EMP-101)
            </button>
          </div>
          <p className="text-xs text-slate-400">
            {mode === 'register'
              ? 'Register with your name, ID, and a clear face photo. File upload is permitted on this page only.'
              : 'Sign in with your registered Full Name and Employee ID to proceed to attendance.'}
          </p>
        </div>

        {/* General Messages */}
        {generalError && (
          <div className="p-4 rounded-2xl bg-rose-950/50 border border-rose-500/40 text-rose-200 text-xs sm:text-sm flex items-start gap-3 animate-in fade-in">
            <AlertCircle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <p className="font-semibold text-rose-300">Action Required</p>
              <p className="leading-relaxed">{generalError}</p>
            </div>
          </div>
        )}

        {generalSuccess && (
          <div className="p-4 rounded-2xl bg-emerald-950/50 border border-emerald-500/40 text-emerald-200 text-xs sm:text-sm flex items-start gap-3 animate-in fade-in">
            <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <p className="font-semibold text-emerald-300">Success</p>
              <p className="leading-relaxed">{generalSuccess}</p>
            </div>
          </div>
        )}

        {/* Form */}
        <form
          onSubmit={mode === 'register' ? handleRegister : handleLogin}
          className="space-y-5"
        >
          {/* Full Name */}
          <div className="space-y-1.5">
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider">
              Full Name
            </label>
            <input
              type="text"
              required
              placeholder="e.g. Alex Morgan"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full bg-slate-950 border border-slate-700 focus:border-emerald-500 rounded-2xl px-4 py-3.5 text-slate-100 placeholder:text-slate-600 focus:outline-none text-sm transition shadow-inner"
            />
          </div>

          {/* Employee ID */}
          <div className="space-y-1.5">
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider">
              Employee ID
            </label>
            <input
              type="text"
              required
              placeholder="e.g. EMP-204"
              value={employeeId}
              onChange={(e) => setEmployeeId(e.target.value)}
              className="w-full bg-slate-950 border border-slate-700 focus:border-emerald-500 rounded-2xl px-4 py-3.5 text-slate-100 placeholder:text-slate-600 focus:outline-none text-sm font-mono tracking-wider transition shadow-inner"
            />
          </div>

          {/* Face Photo Upload (Registration Mode Only) */}
          {mode === 'register' && (
            <div className="space-y-2 pt-2">
              <div className="flex items-center justify-between">
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider">
                  Face Photo Enrollment
                </label>
                <span className="text-[11px] text-amber-400/90 font-medium">
                  File upload allowed here only
                </span>
              </div>

              {/* Upload Dropzone */}
              <div
                onClick={() => fileInputRef.current?.click()}
                className={`relative border-2 border-dashed rounded-3xl p-5 text-center cursor-pointer transition ${
                  faceStatus?.valid
                    ? 'border-emerald-500/60 bg-emerald-950/20'
                    : faceStatus?.valid === false
                    ? 'border-rose-500/60 bg-rose-950/20'
                    : 'border-slate-700 hover:border-slate-600 bg-slate-950/60'
                }`}
              >
                <input
                  type="file"
                  ref={fileInputRef}
                  accept="image/png, image/jpeg, image/jpg, image/webp"
                  onChange={handlePhotoChange}
                  className="hidden"
                />

                {previewUrl ? (
                  <div className="space-y-4">
                    <div className="relative inline-block mx-auto rounded-2xl overflow-hidden border-2 border-slate-700 shadow-md">
                      {/* Base Image Preview */}
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={previewUrl}
                        alt="Face Preview"
                        className="w-44 h-44 sm:w-52 sm:h-52 object-cover block"
                      />

                      {/* Interactive Bounding Box Overlay Canvas */}
                      <canvas
                        ref={overlayCanvasRef}
                        width={208}
                        height={208}
                        className="absolute inset-0 pointer-events-none w-full h-full"
                      />

                      {analyzingFace && (
                        <div className="absolute inset-0 bg-black/60 rounded-2xl flex flex-col items-center justify-center text-white backdrop-blur-xs">
                          <Loader2 className="w-8 h-8 text-emerald-400 animate-spin mb-1.5" />
                          <span className="text-xs font-semibold">Running Multi-Pass Face AI...</span>
                          <span className="text-[10px] text-slate-300 mt-0.5">Detecting landmarks & 128-D vector</span>
                        </div>
                      )}
                    </div>

                    <div className="flex items-center justify-center gap-3">
                      <span className="text-xs text-slate-400 max-w-[180px] truncate">
                        Photo Loaded
                      </span>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          fileInputRef.current?.click();
                        }}
                        className="text-xs text-emerald-400 hover:underline font-medium"
                      >
                        Change Photo
                      </button>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleReanalyze();
                        }}
                        className="text-xs text-slate-400 hover:text-slate-200 flex items-center gap-1 font-medium bg-slate-800 px-2 py-0.5 rounded-lg border border-slate-700"
                        title="Re-run face detection"
                      >
                        <RefreshCw className="w-3 h-3" />
                        Re-scan
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="py-6 flex flex-col items-center justify-center gap-2">
                    <div className="p-3 bg-slate-800 text-slate-300 rounded-2xl">
                      <Upload className="w-6 h-6 text-emerald-400" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-slate-200">
                        Tap to select face photo
                      </p>
                      <p className="text-xs text-slate-400 mt-1 max-w-xs mx-auto">
                        High resolution, front-facing portrait. Exactly one face must be detected.
                      </p>
                    </div>
                  </div>
                )}
              </div>

              {/* Face Detection Status Banner */}
              {faceStatus && (
                <div
                  className={`p-4 rounded-2xl border text-xs sm:text-sm flex items-start gap-3 animate-in fade-in ${
                    faceStatus.valid
                      ? 'bg-emerald-950/40 border-emerald-500/50 text-emerald-300'
                      : 'bg-rose-950/40 border-rose-500/50 text-rose-300'
                  }`}
                >
                  {faceStatus.valid ? (
                    <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
                  ) : (
                    <AlertCircle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
                  )}
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-bold">
                        {faceStatus.valid
                          ? 'Face Verified for Enrollment'
                          : `Face Detection Error (${faceStatus.count} faces detected)`}
                      </p>
                      {faceStatus.valid && faceStatus.confidence && (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                          {faceStatus.confidence}% match confidence
                        </span>
                      )}
                    </div>
                    <p className="text-xs opacity-90 leading-relaxed">
                      {faceStatus.message}
                    </p>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Action Button */}
          <button
            type="submit"
            disabled={
              submitting ||
              (mode === 'register' && (!faceStatus?.valid || !faceDescriptor))
            }
            className="w-full py-4 rounded-2xl bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 disabled:cursor-not-allowed text-slate-950 font-bold text-base transition shadow-lg shadow-emerald-500/25 flex items-center justify-center gap-2 active:scale-[0.99]"
          >
            {submitting ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                <span>
                  {mode === 'register' ? 'Registering & Uploading...' : 'Signing In...'}
                </span>
              </>
            ) : mode === 'register' ? (
              <>
                <Shield className="w-5 h-5" />
                <span>Complete Biometric Registration</span>
              </>
            ) : (
              <>
                <LogIn className="w-5 h-5" />
                <span>Sign In & Continue to Attendance</span>
              </>
            )}
          </button>
        </form>

        {/* Verification Rules Information */}
        <div className="pt-2 border-t border-slate-800/80 flex items-start gap-2.5 text-slate-400 text-xs">
          <Info className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
          <p className="leading-relaxed">
            Registered faces generate a 128-dimensional biometric descriptor. Daily attendance requires live camera verification and office geofence proximity (within 200m).
          </p>
        </div>
      </div>
    </div>
  );
}
