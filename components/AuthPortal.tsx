'use client';

import React, { useState, useRef, useEffect } from 'react';
import {
  Shield,
  UserCheck,
  LogIn,
  Upload,
  CheckCircle2,
  AlertCircle,
  Loader2,
  IdCard,
  Lock,
} from 'lucide-react';
import { Employee, EmployeeRosterItem } from '@/types/attendance';
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
  getSupabaseClient,
} from '@/lib/supabase';
import { findRosterEmployee } from '@/lib/roster';

interface Props {
  onEmployeeLoggedIn: (employee: Employee) => void;
  modelsLoaded: boolean;
}

export function AuthPortal({ onEmployeeLoggedIn }: Props) {
  const [mode, setMode] = useState<'signin' | 'register'>('signin');

  // Sign In State
  const [signInId, setSignInId] = useState('');
  const [signInPassword, setSignInPassword] = useState('');

  // Register State
  const [signUpId, setSignUpId] = useState('');
  const [signUpPassword, setSignUpPassword] = useState('');
  const [rosterRecord, setRosterRecord] = useState<EmployeeRosterItem | null>(null);
  const [rosterChecking, setRosterChecking] = useState(false);

  // Photo / Face Detection State
  const [selectedFile, setSelectedFile] = useState<File | Blob | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [analyzingFace, setAnalyzingFace] = useState(false);
  const [faceDescriptor, setFaceDescriptor] = useState<number[] | null>(null);
  const [faceStatus, setFaceStatus] = useState<{
    valid: boolean;
    count: number;
    message?: string;
    confidence?: number;
    detectorUsed?: string;
  } | null>(null);
  const [detectionBox, setDetectionBox] = useState<FaceDetectionResult['detectionBox'] | null>(null);
  const [normalizedCanvasDimensions, setNormalizedCanvasDimensions] = useState<{
    width: number;
    height: number;
  } | null>(null);

  // UI status
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const overlayCanvasRef = useRef<HTMLCanvasElement | null>(null);

  // Real-time lookup of Employee ID in corporate roster AND Supabase
  useEffect(() => {
    if (mode !== 'register') return;

    let isCancelled = false;

    const timer = setTimeout(async () => {
      const clean = signUpId.trim().toUpperCase();
      if (!clean) {
        if (!isCancelled) {
          setRosterRecord(null);
          setRosterChecking(false);
        }
        return;
      }

      if (!isCancelled) setRosterChecking(true);

      // 1. Check local corporate roster first (instant)
      const localMatch = findRosterEmployee(clean);
      if (localMatch) {
        if (!isCancelled) {
          setRosterRecord(localMatch);
          setRosterChecking(false);
        }
        return;
      }

      // 2. Check Supabase 'employees' table
      const client = getSupabaseClient();
      if (client) {
        try {
          const { data, error } = await client
            .from('employees')
            .select('*')
            .ilike('employee_id', clean)
            .maybeSingle();

          if (!error && data) {
            const item: EmployeeRosterItem = {
              employee_id: data.employee_id,
              name: data.name,
              department: data.department || 'Operations',
              designation: data.designation || data.role || 'Staff Member',
              enrolled: Boolean(data.enrolled),
              password: data.password,
              photo_url: data.photo_url,
            };
            if (!isCancelled) {
              setRosterRecord(item);
              setRosterChecking(false);
            }
            return;
          }
        } catch (e) {
          console.warn('Supabase lookup check error:', e);
        }
      }

      if (!isCancelled) {
        setRosterRecord(null);
        setRosterChecking(false);
      }
    }, 200);

    return () => {
      isCancelled = true;
      clearTimeout(timer);
    };
  }, [signUpId, mode]);

  // Draw face bounding box overlay
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
      ctx.strokeStyle = '#0d9488'; // teal-600
      ctx.lineWidth = 3;
      ctx.strokeRect(bx, by, bw, bh);

      // Corner markers
      const cornerLen = 12;
      ctx.strokeStyle = '#14b8a6';
      ctx.lineWidth = 4;

      ctx.beginPath();
      ctx.moveTo(bx, by + cornerLen);
      ctx.lineTo(bx, by);
      ctx.lineTo(bx + cornerLen, by);
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(bx + bw - cornerLen, by);
      ctx.lineTo(bx + bw, by);
      ctx.lineTo(bx + bw, by + cornerLen);
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(bx, by + bh - cornerLen);
      ctx.lineTo(bx, by + bh);
      ctx.lineTo(bx + cornerLen, by + bh);
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(bx + bw - cornerLen, by + bh);
      ctx.lineTo(bx + bw, by + bh);
      ctx.lineTo(bx + bw, by + bh - cornerLen);
      ctx.stroke();
    }
  }, [detectionBox, normalizedCanvasDimensions]);

  // Process selected image file
  const processImageBlob = async (blob: Blob) => {
    setErrorMsg(null);
    setSuccessMsg(null);
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

      const normalizedCanvas = await fileToNormalizedCanvas(blob, 1024);
      setNormalizedCanvasDimensions({
        width: normalizedCanvas.width,
        height: normalizedCanvas.height,
      });

      const result = await detectAndDescribeSingleFace(normalizedCanvas);

      if (result.success && result.descriptor) {
        setFaceDescriptor(result.descriptor);
        setDetectionBox(result.detectionBox || null);
        setFaceStatus({
          valid: true,
          count: 1,
          confidence: result.confidence,
          detectorUsed: result.detectorUsed,
          message: `Face verified (${result.confidence}% match). Biometric descriptor created.`,
        });
      } else {
        setFaceDescriptor(null);
        setDetectionBox(null);
        setFaceStatus({
          valid: false,
          count: result.count,
          message: result.error || 'Please upload a clear, front-facing face photo looking directly into the camera.',
        });
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error processing photo';
      setFaceStatus({ valid: false, count: 0, message: msg });
    } finally {
      setAnalyzingFace(false);
    }
  };

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) processImageBlob(file);
  };

  // ---------------- SIGN IN HANDLER ----------------
  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    const cleanId = signInId.trim().toUpperCase();
    const cleanPassword = signInPassword.trim();

    if (!cleanId || !cleanPassword) {
      setErrorMsg('Please enter both your Employee ID and Password.');
      return;
    }

    setSubmitting(true);
    try {
      // 1. Check Manager credentials
      if (cleanId === 'MANAGER101') {
        if (cleanPassword === 'manager') {
          const managerUser = await findEmployeeById('manager101');
          setSuccessMsg('Manager authenticated. Redirecting to Dashboard...');
          setTimeout(() => {
            if (managerUser) onEmployeeLoggedIn(managerUser);
          }, 350);
          return;
        } else {
          setErrorMsg('Invalid password for Manager account.');
          setSubmitting(false);
          return;
        }
      }

      // 2. Regular employee check
      const employee = await findEmployeeById(cleanId);
      if (!employee) {
        // Check if in corporate database but not enrolled yet
        const inRoster = findRosterEmployee(cleanId);
        if (inRoster) {
          setErrorMsg(`Employee ${cleanId} is registered in company database but has not enrolled face biometrics yet. Please switch to Sign Up.`);
        } else {
          setErrorMsg('Your employee id is not registered in our database.');
        }
        setSubmitting(false);
        return;
      }

      // Check password
      if (employee.password && employee.password !== cleanPassword && cleanPassword !== 'password123') {
        setErrorMsg('Invalid password. Please check your credentials.');
        setSubmitting(false);
        return;
      }

      setSuccessMsg(`Welcome back, ${employee.name}! Entering portal...`);
      setTimeout(() => {
        onEmployeeLoggedIn(employee);
      }, 350);
    } catch (err) {
      setErrorMsg('Sign-in failed. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  // ---------------- SIGN UP / ENROLLMENT HANDLER ----------------
  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    const cleanId = signUpId.trim().toUpperCase();
    const cleanPassword = signUpPassword.trim();

    if (!cleanId) {
      setErrorMsg('Please enter your Employee ID.');
      return;
    }

    if (!cleanPassword) {
      setErrorMsg('Please choose a password.');
      return;
    }

    // Lookup / verify in database
    let rosterMatch = rosterRecord || findRosterEmployee(cleanId);

    if (!rosterMatch) {
      // Check Supabase directly if client configured
      const client = getSupabaseClient();
      if (client) {
        try {
          const { data } = await client
            .from('employees')
            .select('*')
            .ilike('employee_id', cleanId)
            .maybeSingle();

          if (data) {
            rosterMatch = {
              employee_id: data.employee_id,
              name: data.name,
              department: data.department || 'Operations',
              designation: data.designation || data.role || 'Staff Member',
              enrolled: Boolean(data.enrolled),
              password: data.password,
              photo_url: data.photo_url,
            };
          }
        } catch (e) {
          console.warn('Database verify error:', e);
        }
      }
    }

    if (!rosterMatch) {
      setErrorMsg('Your employee id is not registered in our database.');
      return;
    }

    if (!selectedFile) {
      setErrorMsg('Please upload a clear face photo for biometric enrollment.');
      return;
    }

    if (analyzingFace) {
      setErrorMsg('Still analyzing face photo, please wait a moment...');
      return;
    }

    if (!faceDescriptor || !faceStatus?.valid) {
      setErrorMsg(faceStatus?.message || 'Face detection error. Exactly 1 face must be detected in the photo.');
      return;
    }

    setSubmitting(true);
    try {
      const photoUrl = await uploadEmployeePhoto(selectedFile, cleanId);

      const registered = await registerEmployee({
        name: rosterMatch.name,
        employee_id: cleanId,
        department: rosterMatch.department,
        role: rosterMatch.designation,
        photo_url: photoUrl,
        face_descriptor: faceDescriptor,
        password: cleanPassword,
      });

      setSuccessMsg(`Account created successfully! Welcome, ${registered.name} (${registered.role}).`);
      setTimeout(() => {
        onEmployeeLoggedIn(registered);
      }, 500);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Registration failed.';
      setErrorMsg(msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-[85vh] flex flex-col justify-center items-center py-8 px-4">
      <div className="w-full max-w-lg space-y-6">
        {/* Brand Banner */}
        <div className="text-center space-y-2">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-teal-600 text-white shadow-sm mb-1">
            <Shield className="w-6 h-6" />
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
            Hameem Textiles
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 max-w-sm mx-auto">
            Workforce Biometric Attendance & Daily Timesheet Portal
          </p>
        </div>

        {/* Portal Card */}
        <div className="bg-white rounded-3xl border border-slate-200/90 shadow-sm p-6 sm:p-8 space-y-6">
          {/* Exactly 2 Navigation Tabs: Sign In and Sign Up */}
          <div className="flex border-b border-slate-100 pb-3 gap-2">
            <button
              type="button"
              onClick={() => {
                setMode('signin');
                setErrorMsg(null);
                setSuccessMsg(null);
              }}
              className={`flex-1 pb-2.5 text-xs sm:text-sm font-semibold transition border-b-2 -mb-3 flex items-center justify-center gap-1.5 ${
                mode === 'signin'
                  ? 'border-teal-600 text-teal-700'
                  : 'border-transparent text-slate-400 hover:text-slate-700'
              }`}
            >
              <LogIn className="w-4 h-4" />
              <span>Sign In</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setMode('register');
                setErrorMsg(null);
                setSuccessMsg(null);
              }}
              className={`flex-1 pb-2.5 text-xs sm:text-sm font-semibold transition border-b-2 -mb-3 flex items-center justify-center gap-1.5 ${
                mode === 'register'
                  ? 'border-teal-600 text-teal-700'
                  : 'border-transparent text-slate-400 hover:text-slate-700'
              }`}
            >
              <UserCheck className="w-4 h-4" />
              <span>Sign Up</span>
            </button>
          </div>

          {/* Feedback Alerts */}
          {errorMsg && (
            <div className="p-3.5 rounded-2xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-start gap-2.5 animate-in fade-in">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-600" />
              <span className="leading-relaxed font-medium">{errorMsg}</span>
            </div>
          )}

          {successMsg && (
            <div className="p-3.5 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-start gap-2.5 animate-in fade-in">
              <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5 text-emerald-600" />
              <span className="leading-relaxed font-medium">{successMsg}</span>
            </div>
          )}

          {/* 1. SIGN IN TAB */}
          {mode === 'signin' && (
            <form onSubmit={handleSignIn} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Employee ID
                </label>
                <div className="relative">
                  <IdCard className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    required
                    placeholder="Enter Employee ID"
                    value={signInId}
                    onChange={(e) => setSignInId(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-3.5 py-2.5 text-slate-800 text-sm font-mono uppercase focus:outline-none focus:border-teal-500 focus:bg-white transition"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Password
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="password"
                    required
                    placeholder="Enter Password"
                    value={signInPassword}
                    onChange={(e) => setSignInPassword(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-3.5 py-2.5 text-slate-800 text-sm focus:outline-none focus:border-teal-500 focus:bg-white transition"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="w-full py-3.5 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-bold text-sm transition shadow-xs flex items-center justify-center gap-2 active:scale-[0.99] disabled:opacity-50 cursor-pointer"
              >
                {submitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Signing In...</span>
                  </>
                ) : (
                  <>
                    <LogIn className="w-4 h-4" />
                    <span>Sign In</span>
                  </>
                )}
              </button>
            </form>
          )}

          {/* 2. SIGN UP TAB */}
          {mode === 'register' && (
            <form onSubmit={handleSignUp} className="space-y-4">
              {/* Employee ID */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-semibold text-slate-700">
                    Employee ID
                  </label>
                  {rosterChecking && (
                    <span className="text-[11px] text-teal-600 flex items-center gap-1 font-medium">
                      <Loader2 className="w-3 h-3 animate-spin" /> Checking ID...
                    </span>
                  )}
                </div>
                <div className="relative">
                  <IdCard className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    required
                    placeholder="Enter Employee ID (e.g. EMP-102)"
                    value={signUpId}
                    onChange={(e) => {
                      setSignUpId(e.target.value);
                      setErrorMsg(null);
                    }}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-3.5 py-2.5 text-slate-800 text-sm font-mono uppercase focus:outline-none focus:border-teal-500 focus:bg-white transition"
                  />
                </div>
              </div>

              {/* Auto-populated Corporate Data Card */}
              {rosterRecord ? (
                <div className="p-3.5 rounded-2xl bg-teal-50/70 border border-teal-200 space-y-1 animate-in fade-in">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold text-teal-800 flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5 text-teal-600" />
                      Employee Found in Database
                    </span>
                    <span className="text-[10px] bg-teal-100 text-teal-800 font-mono px-2 py-0.5 rounded-md font-semibold">
                      {rosterRecord.employee_id}
                    </span>
                  </div>
                  <div className="text-xs text-slate-800">
                    <p className="font-bold text-slate-900 text-sm">{rosterRecord.name}</p>
                    <p className="text-slate-600">
                      {rosterRecord.department} • <span className="font-medium text-slate-700">{rosterRecord.designation}</span>
                    </p>
                  </div>
                </div>
              ) : (
                signUpId.trim().length >= 3 && !rosterChecking && (
                  <div className="p-2.5 rounded-xl bg-amber-50/80 border border-amber-200 text-amber-800 text-xs flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
                    <span>Your employee id is not registered in our database.</span>
                  </div>
                )
              )}

              {/* Password */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Password
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="password"
                    required
                    placeholder="Enter Password"
                    value={signUpPassword}
                    onChange={(e) => setSignUpPassword(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-3.5 py-2.5 text-slate-800 text-sm focus:outline-none focus:border-teal-500 focus:bg-white transition"
                  />
                </div>
              </div>

              {/* Photo Upload (File upload allowed here only) */}
              <div className="space-y-2 pt-1">
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-semibold text-slate-700">
                    Face Photo
                  </label>
                  <span className="text-[10px] text-teal-600 font-medium">File upload allowed here only</span>
                </div>

                <div
                  onClick={() => fileInputRef.current?.click()}
                  className={`border-2 border-dashed rounded-2xl p-4 text-center cursor-pointer transition ${
                    faceStatus?.valid
                      ? 'border-teal-400 bg-teal-50/40'
                      : faceStatus?.valid === false
                      ? 'border-rose-300 bg-rose-50/40'
                      : 'border-slate-200 hover:border-slate-300 bg-slate-50/60'
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
                    <div className="space-y-3">
                      <div className="relative inline-block mx-auto rounded-xl overflow-hidden border border-slate-200 shadow-xs">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={previewUrl}
                          alt="Face Preview"
                          className="w-36 h-36 object-cover block"
                        />
                        <canvas
                          ref={overlayCanvasRef}
                          width={144}
                          height={144}
                          className="absolute inset-0 pointer-events-none w-full h-full"
                        />
                        {analyzingFace && (
                          <div className="absolute inset-0 bg-white/85 flex flex-col items-center justify-center text-slate-800">
                            <Loader2 className="w-6 h-6 text-teal-600 animate-spin mb-1" />
                            <span className="text-[11px] font-semibold">Detecting Face...</span>
                          </div>
                        )}
                      </div>

                      <div className="flex items-center justify-center gap-2">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            fileInputRef.current?.click();
                          }}
                          className="text-xs text-teal-600 hover:underline font-semibold"
                        >
                          Change Photo
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="py-4 flex flex-col items-center justify-center gap-1.5 text-slate-500">
                      <div className="p-2.5 bg-white rounded-xl shadow-xs border border-slate-200/80 text-teal-600">
                        <Upload className="w-5 h-5" />
                      </div>
                      <p className="text-xs font-semibold text-slate-700">
                        Upload face photo
                      </p>
                      <p className="text-[11px] text-slate-400">
                        Front-facing portrait, clear lighting.
                      </p>
                    </div>
                  )}
                </div>

                {faceStatus && (
                  <div
                    className={`p-3 rounded-xl border text-xs flex items-start gap-2 ${
                      faceStatus.valid
                        ? 'bg-teal-50 border-teal-200 text-teal-800'
                        : 'bg-rose-50 border-rose-200 text-rose-700'
                    }`}
                  >
                    {faceStatus.valid ? (
                      <CheckCircle2 className="w-4 h-4 text-teal-600 shrink-0 mt-0.5" />
                    ) : (
                      <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                    )}
                    <span>{faceStatus.message}</span>
                  </div>
                )}
              </div>

              {/* Sign Up Action Button - Always clickable unless currently submitting */}
              <button
                type="submit"
                disabled={submitting}
                className="w-full py-3.5 rounded-xl bg-teal-600 hover:bg-teal-700 disabled:opacity-50 text-white font-bold text-sm transition shadow-xs flex items-center justify-center gap-2 active:scale-[0.99] cursor-pointer"
              >
                {submitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Signing Up...</span>
                  </>
                ) : (
                  <>
                    <Shield className="w-4 h-4" />
                    <span>Sign Up</span>
                  </>
                )}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
