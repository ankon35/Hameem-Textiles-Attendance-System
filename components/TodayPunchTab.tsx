'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Clock,
  LogIn,
  LogOut,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Loader2,
  ShieldCheck,
  Camera,
  Scan,
  Sparkles,
} from 'lucide-react';
import { Employee, AttendanceLog, PunchType } from '@/types/attendance';
import {
  calculateEuclideanDistance,
  detectFaceFromLiveVideo,
  areModelsLoaded,
  loadFaceApiModels,
  FACE_MATCH_THRESHOLD,
} from '@/lib/faceApi';
import { checkTodayPunches, recordAttendanceLog } from '@/lib/supabase';

interface Props {
  currentEmployee: Employee;
  onRefreshData?: () => void;
}

export function TodayPunchTab({ currentEmployee, onRefreshData }: Props) {
  const [currentTime, setCurrentTime] = useState<string>('');
  const [currentDate, setCurrentDate] = useState<string>('');
  const [checkInLog, setCheckInLog] = useState<AttendanceLog | null>(null);
  const [checkOutLog, setCheckOutLog] = useState<AttendanceLog | null>(null);
  const [loadingPunches, setLoadingPunches] = useState(true);
  const [activeShiftHours, setActiveShiftHours] = useState('0h 0m');

  // Modal & Live Camera State
  const [cameraOpen, setCameraOpen] = useState(false);
  const [punchAction, setPunchAction] = useState<PunchType>('check_in');
  const [cameraLoading, setCameraLoading] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [verifying, setVerifying] = useState(false);
  const [verificationStep, setVerificationStep] = useState<string>('');

  // Continuous Auto-Detection State
  const [scanState, setScanState] = useState<'idle' | 'searching' | 'analyzing' | 'matched' | 'mismatch' | 'error'>('idle');
  const [scanMessage, setScanMessage] = useState<string>('');
  const [matchSimilarity, setMatchSimilarity] = useState<number | null>(null);

  // Outcome banner
  const [outcome, setOutcome] = useState<{
    status: 'success' | 'error';
    title: string;
    message: string;
    faceDistance?: number;
    timestamp?: string;
  } | null>(null);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const scanTimerRef = useRef<NodeJS.Timeout | null>(null);
  const isProcessingRef = useRef(false);
  const cameraOpenRef = useRef(false);
  const hasPunchedRef = useRef(false);

  // Live Clock & Shift duration updater
  useEffect(() => {
    const update = () => {
      const now = new Date();
      setCurrentTime(
        now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
      );
      setCurrentDate(
        now.toLocaleDateString([], { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })
      );

      if (checkInLog) {
        const inTime = new Date(checkInLog.captured_at).getTime();
        const outTime = checkOutLog ? new Date(checkOutLog.captured_at).getTime() : now.getTime();
        const diffMs = Math.max(0, outTime - inTime);
        const totalMinutes = Math.floor(diffMs / (1000 * 60));
        const hours = Math.floor(totalMinutes / 60);
        const mins = totalMinutes % 60;
        setActiveShiftHours(`${hours}h ${mins}m`);
      }
    };

    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, [checkInLog, checkOutLog]);

  // Load today's check-in / check-out
  useEffect(() => {
    let active = true;

    async function fetchPunches() {
      try {
        const { checkIn, checkOut } = await checkTodayPunches(currentEmployee.employee_id);
        if (!active) return;
        setCheckInLog(checkIn);
        setCheckOutLog(checkOut);
      } catch (err) {
        console.error('Failed to load punches:', err);
      } finally {
        if (active) setLoadingPunches(false);
      }
    }

    fetchPunches();

    return () => {
      active = false;
    };
  }, [currentEmployee.employee_id]);

  // Clean up camera stream and scanning loop on unmount
  useEffect(() => {
    return () => {
      cameraOpenRef.current = false;
      if (scanTimerRef.current) {
        clearTimeout(scanTimerRef.current);
        scanTimerRef.current = null;
      }
      if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach((track) => track.stop());
      }
    };
  }, []);

  // Close live camera
  const handleCloseCamera = useCallback(() => {
    cameraOpenRef.current = false;
    if (scanTimerRef.current) {
      clearTimeout(scanTimerRef.current);
      scanTimerRef.current = null;
    }
    isProcessingRef.current = false;

    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((track) => track.stop());
      mediaStreamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setCameraOpen(false);
    setCameraError(null);
    setVerifying(false);
    setScanState('idle');
    setMatchSimilarity(null);
  }, []);

  // Execute Punch (automatically upon match, or manual fallback)
  const executePunch = useCallback(
    async (capturedFaceDist: number) => {
      if (verifying) return;
      setVerifying(true);
      setVerificationStep(
        punchAction === 'check_in' ? 'Recording Check In...' : 'Recording Check Out...'
      );

      try {
        const saved = await recordAttendanceLog({
          employee_id: currentEmployee.employee_id,
          punch_type: punchAction,
          latitude: null,
          longitude: null,
          distance_meters: null,
          face_distance: capturedFaceDist,
          status: 'present',
        });

        const formattedTime = new Date(saved.captured_at).toLocaleTimeString([], {
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
        });

        if (punchAction === 'check_in') {
          setCheckInLog(saved);
          setOutcome({
            status: 'success',
            title: 'Check-In Confirmed',
            message: `Good day, ${currentEmployee.name}! Face biometric verified. Checked in at ${formattedTime}.`,
            faceDistance: capturedFaceDist,
            timestamp: formattedTime,
          });
        } else {
          setCheckOutLog(saved);
          setOutcome({
            status: 'success',
            title: 'Check-Out Confirmed',
            message: `Great work today, ${currentEmployee.name}! Face biometric verified. Checked out at ${formattedTime}.`,
            faceDistance: capturedFaceDist,
            timestamp: formattedTime,
          });
        }

        onRefreshData?.();

        // Brief delay for employee to see the verified checkmark before closing
        setTimeout(() => {
          handleCloseCamera();
        }, 700);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Biometric recording error.';
        setCameraError(msg);
        hasPunchedRef.current = false;
        setVerifying(false);
      }
    },
    [currentEmployee, punchAction, onRefreshData, handleCloseCamera, verifying]
  );

  // Open LIVE Camera for Check In or Check Out
  const handleOpenLiveCamera = async (action: PunchType) => {
    setPunchAction(action);
    setCameraError(null);
    setOutcome(null);
    setCameraLoading(true);
    setScanState('idle');
    setScanMessage('Starting camera stream...');
    setMatchSimilarity(null);
    hasPunchedRef.current = false;
    isProcessingRef.current = false;

    try {
      if (!areModelsLoaded()) {
        setVerificationStep('Preparing biometric face recognition engine...');
        await loadFaceApiModels();
      }

      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('Your browser does not support live camera access.');
      }

      setVerificationStep('Accessing camera...');
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: 'user',
          width: { ideal: 640 },
          height: { ideal: 480 },
        },
        audio: false,
      });

      mediaStreamRef.current = stream;
      cameraOpenRef.current = true;
      setCameraOpen(true);
      setScanState('searching');
      setScanMessage('Looking for face... Please look directly into the camera.');
    } catch (err: unknown) {
      const msg =
        err instanceof Error
          ? err.message
          : 'Unable to access camera. Please allow camera permissions in your browser.';
      setCameraError(msg);
      setCameraOpen(false);
    } finally {
      setCameraLoading(false);
      setVerificationStep('');
    }
  };

  // Attach stream to video element when camera opens
  useEffect(() => {
    if (cameraOpen && videoRef.current && mediaStreamRef.current) {
      videoRef.current.srcObject = mediaStreamRef.current;
      videoRef.current.play().catch((err) => {
        console.error('Video play error:', err);
      });
    }
  }, [cameraOpen]);

  // CONTINUOUS AUTOMATIC REAL-TIME FACE DETECTION & MATCHING LOOP
  useEffect(() => {
    if (!cameraOpen) {
      if (scanTimerRef.current) {
        clearTimeout(scanTimerRef.current);
        scanTimerRef.current = null;
      }
      isProcessingRef.current = false;
      return;
    }

    cameraOpenRef.current = true;
    hasPunchedRef.current = false;
    isProcessingRef.current = false;
    let localActive = true;

    const runAutoScan = async () => {
      if (!localActive || !cameraOpenRef.current || hasPunchedRef.current) return;

      const video = videoRef.current;
      if (!video || video.readyState < 2 || video.paused || video.ended) {
        // Video stream not ready yet, wait and retry
        scanTimerRef.current = setTimeout(runAutoScan, 200);
        return;
      }

      if (isProcessingRef.current) {
        scanTimerRef.current = setTimeout(runAutoScan, 200);
        return;
      }

      isProcessingRef.current = true;

      try {
        const faceResult = await detectFaceFromLiveVideo(video);

        if (!localActive || !cameraOpenRef.current || hasPunchedRef.current) return;

        if (!faceResult.success || !faceResult.descriptor) {
          setScanState('searching');
          setMatchSimilarity(null);
          setScanMessage(
            faceResult.count > 1
              ? 'Multiple faces detected. Please ensure only 1 person is in frame.'
              : 'Looking for face... Please look directly into the camera.'
          );
        } else {
          // Exactly 1 face detected! Compare with registered descriptor
          if (
            !currentEmployee.face_descriptor ||
            currentEmployee.face_descriptor.length === 0
          ) {
            setScanState('error');
            setCameraError(
              'No reference biometric template found for this employee profile. Please re-register with your photo.'
            );
            return;
          }

          const dist = calculateEuclideanDistance(
            currentEmployee.face_descriptor,
            faceResult.descriptor
          );

          const isMatch = dist < FACE_MATCH_THRESHOLD;
          const similarityPct = Math.max(0, Math.min(100, Math.round((1 - dist) * 100)));
          setMatchSimilarity(similarityPct);

          if (isMatch) {
            // MATCH CONFIRMED! Take attendance automatically
            hasPunchedRef.current = true;
            setScanState('matched');
            setScanMessage(`Face Verified (${similarityPct}% match)! Taking attendance automatically...`);
            await executePunch(dist);
            return;
          } else {
            // Face present, but does not match current employee
            setScanState('mismatch');
            setScanMessage(
              `Face detected (${similarityPct}% similarity). Align your face directly in the oval guide in good light.`
            );
          }
        }
      } catch (err) {
        console.warn('Real-time frame scan error:', err);
      } finally {
        isProcessingRef.current = false;
        if (localActive && cameraOpenRef.current && !hasPunchedRef.current) {
          // Process next frame in 300ms for smooth non-blocking execution
          scanTimerRef.current = setTimeout(runAutoScan, 300);
        }
      }
    };

    // Allow 350ms for camera autofocus & exposure before beginning scan
    scanTimerRef.current = setTimeout(runAutoScan, 350);

    return () => {
      localActive = false;
      cameraOpenRef.current = false;
      if (scanTimerRef.current) {
        clearTimeout(scanTimerRef.current);
        scanTimerRef.current = null;
      }
    };
  }, [cameraOpen, currentEmployee, executePunch]);

  // Fallback manual capture button (if employee prefers to trigger manually)
  const handleManualCapture = async () => {
    if (!currentEmployee || !videoRef.current || verifying) return;

    setVerifying(true);
    setCameraError(null);

    try {
      setVerificationStep('Scanning face from camera frame...');
      const faceResult = await detectFaceFromLiveVideo(videoRef.current);

      if (!faceResult.success || !faceResult.descriptor) {
        throw new Error(
          faceResult.error ||
            'No face detected clearly in frame. Please center your face in the camera in good lighting.'
        );
      }

      setVerificationStep('Matching biometric signature...');
      const capturedFaceDist = calculateEuclideanDistance(
        currentEmployee.face_descriptor,
        faceResult.descriptor
      );

      const isMatch = capturedFaceDist < FACE_MATCH_THRESHOLD;

      if (!isMatch) {
        await recordAttendanceLog({
          employee_id: currentEmployee.employee_id,
          punch_type: punchAction,
          latitude: null,
          longitude: null,
          distance_meters: null,
          face_distance: capturedFaceDist,
          status: 'face_mismatch',
          failure_reason: `Face similarity distance was ${capturedFaceDist} (threshold: ${FACE_MATCH_THRESHOLD})`,
        });

        setOutcome({
          status: 'error',
          title: 'Face Not Matched',
          message: `Biometric verification failed (Similarity score: ${capturedFaceDist}, required < ${FACE_MATCH_THRESHOLD}). Look straight into the camera.`,
          faceDistance: capturedFaceDist,
        });
        handleCloseCamera();
        return;
      }

      await executePunch(capturedFaceDist);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Biometric verification error.';
      setCameraError(msg);
      setVerifying(false);
      setVerificationStep('');
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Top Greeting & Live Clock Card */}
      <div className="bg-white rounded-2xl border border-slate-200/90 p-6 sm:p-7 shadow-xs space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-5">
          <div className="space-y-1">
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
              Welcome, {currentEmployee.name}
            </h1>
            <p className="text-xs text-slate-500">
              {currentEmployee.role || 'Staff Member'} • {currentEmployee.department || 'Operations'} ({currentEmployee.employee_id})
            </p>
          </div>

          <div className="text-left sm:text-right">
            <span className="text-2xl sm:text-3xl font-mono font-bold text-teal-800 tracking-tight block">
              {currentTime || '--:--:--'}
            </span>
            <span className="text-xs text-slate-500 font-medium block mt-0.5">
              {currentDate || 'Today'}
            </span>
          </div>
        </div>

        {/* Shift Punch Status Card */}
        {loadingPunches ? (
          <div className="py-8 flex items-center justify-center gap-2 text-slate-400 text-xs">
            <Loader2 className="w-5 h-5 animate-spin text-teal-600" />
            <span>Loading shift status...</span>
          </div>
        ) : !checkInLog ? (
          /* NOT CHECKED IN YET */
          <div className="p-5 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <span className="w-3 h-3 rounded-full bg-slate-400" />
                <span className="text-sm font-semibold text-slate-700">
                  Shift Not Started
                </span>
              </div>
              <span className="text-xs text-slate-500 font-medium">
                Standard shift: 9:00 AM – 5:30 PM
              </span>
            </div>

            <div className="bg-white/80 p-3 rounded-xl border border-slate-200/60 flex items-start gap-2.5">
              <Sparkles className="w-4 h-4 text-teal-600 shrink-0 mt-0.5" />
              <p className="text-xs text-slate-600 leading-relaxed">
                <strong>Automatic Attendance:</strong> Just open the camera and look directly at the screen. The system will automatically detect your face and record your check-in hands-free.
              </p>
            </div>

            <button
              type="button"
              onClick={() => handleOpenLiveCamera('check_in')}
              disabled={cameraLoading}
              className="w-full py-4 px-6 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-bold text-sm sm:text-base transition shadow-sm hover:shadow-md flex items-center justify-center gap-2.5 active:scale-[0.99] disabled:opacity-50 cursor-pointer"
            >
              {cameraLoading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <span>Starting Camera...</span>
                </>
              ) : (
                <>
                  <Camera className="w-5 h-5" />
                  <span>Check In (Auto Face Detection)</span>
                </>
              )}
            </button>
          </div>
        ) : !checkOutLog ? (
          /* CHECKED IN - SHIFT IN PROGRESS */
          <div className="p-5 rounded-2xl bg-teal-50/60 border border-teal-200/80 space-y-4">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-emerald-500 animate-pulse" />
                <span className="text-sm font-bold text-teal-900">
                  Shift In Progress (Checked In)
                </span>
              </div>
              <div className="text-xs font-mono font-bold text-teal-800 bg-white/80 px-2.5 py-1 rounded-lg border border-teal-200">
                Logged Duration: {activeShiftHours}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs bg-white/90 p-3.5 rounded-xl border border-teal-100">
              <div>
                <span className="text-[10px] uppercase font-semibold text-slate-400 block">
                  Check-In Time
                </span>
                <span className="text-sm font-mono font-bold text-slate-900">
                  {new Date(checkInLog.captured_at).toLocaleTimeString([], {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </span>
              </div>
              <div>
                <span className="text-[10px] uppercase font-semibold text-slate-400 block">
                  Biometric Status
                </span>
                <span className="text-xs font-mono text-emerald-700 font-semibold flex items-center gap-1 mt-0.5">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                  Verified
                </span>
              </div>
            </div>

            <button
              type="button"
              onClick={() => handleOpenLiveCamera('check_out')}
              disabled={cameraLoading}
              className="w-full py-4 px-6 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-sm sm:text-base transition shadow-sm hover:shadow-md flex items-center justify-center gap-2.5 active:scale-[0.99] disabled:opacity-50 cursor-pointer"
            >
              {cameraLoading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <span>Starting Camera...</span>
                </>
              ) : (
                <>
                  <Camera className="w-5 h-5 text-rose-400" />
                  <span>Check Out & End Shift (Auto Face Detection)</span>
                </>
              )}
            </button>
          </div>
        ) : (
          /* SHIFT COMPLETED */
          <div className="p-5 rounded-2xl bg-emerald-50/70 border border-emerald-200/90 space-y-3">
            <div className="flex items-center gap-2.5">
              <CheckCircle2 className="w-6 h-6 text-emerald-600 shrink-0" />
              <div>
                <h3 className="font-bold text-emerald-900 text-sm sm:text-base">
                  Today&apos;s Shift Completed
                </h3>
                <p className="text-xs text-emerald-700">
                  Both check-in and check-out have been logged. Total shift duration: <strong>{activeShiftHours}</strong>.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2 text-xs bg-white p-3 rounded-xl border border-emerald-100 font-mono">
              <div>
                <span className="text-[10px] font-sans text-slate-400 block">Check In</span>
                <span className="font-bold text-slate-800">
                  {new Date(checkInLog.captured_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
              <div>
                <span className="text-[10px] font-sans text-slate-400 block">Check Out</span>
                <span className="font-bold text-slate-800">
                  {new Date(checkOutLog.captured_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
              <div>
                <span className="text-[10px] font-sans text-slate-400 block">Total Hours</span>
                <span className="font-bold text-teal-700">{activeShiftHours}</span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Outcome Feedback Banner */}
      {outcome && (
        <div
          className={`p-5 rounded-2xl border shadow-xs space-y-2 animate-in fade-in zoom-in-95 ${
            outcome.status === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
              : 'bg-rose-50 border-rose-200 text-rose-900'
          }`}
        >
          <div className="flex items-start gap-3">
            {outcome.status === 'success' ? (
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
            ) : (
              <XCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
            )}
            <div className="space-y-1">
              <h4 className="font-bold text-sm">{outcome.title}</h4>
              <p className="text-xs leading-relaxed opacity-90">{outcome.message}</p>
            </div>
          </div>
        </div>
      )}

      {/* Today's Attendance Timeline */}
      <div className="bg-white rounded-2xl border border-slate-200/90 p-5 shadow-xs space-y-4">
        <h3 className="font-bold text-slate-900 text-sm">
          Today&apos;s Attendance Timeline
        </h3>

        <div className="space-y-3">
          {/* Check-in item */}
          <div className="flex items-start gap-3 text-xs">
            <div
              className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 ${
                checkInLog
                  ? 'bg-emerald-100 text-emerald-700 font-bold'
                  : 'bg-slate-100 text-slate-400'
              }`}
            >
              <LogIn className="w-3.5 h-3.5" />
            </div>
            <div className="flex-1">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-slate-800">Check In</span>
                <span className="font-mono text-slate-600">
                  {checkInLog
                    ? new Date(checkInLog.captured_at).toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit',
                      })
                    : 'Pending'}
                </span>
              </div>
              <p className="text-[11px] text-slate-500 mt-0.5">
                {checkInLog
                  ? 'Automatic face biometric match confirmed'
                  : 'Open camera to check in automatically'}
              </p>
            </div>
          </div>

          <div className="w-0.5 h-4 bg-slate-200 ml-3.5" />

          {/* Check-out item */}
          <div className="flex items-start gap-3 text-xs">
            <div
              className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 ${
                checkOutLog
                  ? 'bg-rose-100 text-rose-700 font-bold'
                  : 'bg-slate-100 text-slate-400'
              }`}
            >
              <LogOut className="w-3.5 h-3.5" />
            </div>
            <div className="flex-1">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-slate-800">Check Out</span>
                <span className="font-mono text-slate-600">
                  {checkOutLog
                    ? new Date(checkOutLog.captured_at).toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit',
                      })
                    : checkInLog
                    ? 'In Progress'
                    : 'Pending'}
                </span>
              </div>
              <p className="text-[11px] text-slate-500 mt-0.5">
                {checkOutLog
                  ? 'Shift completed and recorded to timesheet'
                  : checkInLog
                  ? 'Open camera to check out automatically'
                  : 'Available after check in'}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* LIVE CAMERA MODAL (Continuous Auto-Detection & Instant Hands-Free Punch) */}
      {cameraOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white border border-slate-200 w-full max-w-md rounded-2xl overflow-hidden shadow-2xl flex flex-col">
            {/* Header */}
            <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <div className="flex items-center gap-2.5">
                <span className="relative flex h-3 w-3">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500" />
                </span>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">
                    {punchAction === 'check_in' ? 'Check In Camera' : 'Check Out Camera'}
                  </h3>
                  <p className="text-[11px] text-teal-700 font-medium">
                    Hands-free automatic biometric attendance
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={handleCloseCamera}
                disabled={verifying}
                className="text-xs text-slate-500 hover:text-slate-800 px-3 py-1.5 rounded-lg border border-slate-200 hover:bg-white transition cursor-pointer"
              >
                Cancel
              </button>
            </div>

            {/* Video Viewport with Interactive Reticle HUD */}
            <div className="relative bg-slate-950 aspect-[4/3] w-full overflow-hidden flex items-center justify-center">
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="w-full h-full object-cover transform -scale-x-100"
              />

              {/* Floating Top HUD Tag */}
              <div className="absolute top-3 left-3 right-3 flex items-center justify-between pointer-events-none">
                <span className="text-[11px] font-medium px-2.5 py-1 rounded-full bg-slate-900/80 backdrop-blur-md text-slate-200 border border-white/10 flex items-center gap-1.5">
                  <Scan className="w-3 h-3 text-teal-400 animate-pulse" />
                  Auto Face Detection Active
                </span>

                {matchSimilarity !== null && (
                  <span
                    className={`text-[11px] font-mono font-bold px-2 py-0.5 rounded-full border backdrop-blur-md ${
                      matchSimilarity >= 50
                        ? 'bg-emerald-950/80 text-emerald-300 border-emerald-500/50'
                        : 'bg-amber-950/80 text-amber-300 border-amber-500/50'
                    }`}
                  >
                    Match: {matchSimilarity}%
                  </span>
                )}
              </div>

              {/* Reticle Guide Overlay */}
              <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                <div
                  className={`w-48 h-60 rounded-[50%] transition-all duration-300 relative flex items-center justify-center ${
                    scanState === 'matched'
                      ? 'border-4 border-emerald-400 bg-emerald-500/20 shadow-[0_0_35px_rgba(52,211,153,0.7)] scale-105'
                      : scanState === 'mismatch'
                      ? 'border-2 border-amber-400 shadow-[0_0_15px_rgba(251,191,36,0.3)]'
                      : 'border-2 border-teal-400/90 shadow-[0_0_20px_rgba(45,212,191,0.3)]'
                  }`}
                >
                  {/* Scanning Radar Line (active when searching/analyzing) */}
                  {scanState !== 'matched' && (
                    <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-teal-400/20 via-teal-300 to-teal-400/20 shadow-[0_0_10px_#2dd4bf] animate-bounce" />
                  )}

                  {/* Corner Target Markers */}
                  <div className="absolute -top-1 -left-1 w-3 h-3 border-t-2 border-l-2 border-white/90" />
                  <div className="absolute -top-1 -right-1 w-3 h-3 border-t-2 border-r-2 border-white/90" />
                  <div className="absolute -bottom-1 -left-1 w-3 h-3 border-b-2 border-l-2 border-white/90" />
                  <div className="absolute -bottom-1 -right-1 w-3 h-3 border-b-2 border-r-2 border-white/90" />

                  {/* Match Confirmed Visual Stamp */}
                  {scanState === 'matched' && (
                    <div className="bg-emerald-600 text-white rounded-full p-3 shadow-lg animate-in zoom-in-75 duration-200">
                      <CheckCircle2 className="w-10 h-10" />
                    </div>
                  )}
                </div>
              </div>

              {/* Submitting Overlay */}
              {verifying && (
                <div className="absolute inset-0 bg-white/90 backdrop-blur-xs flex flex-col items-center justify-center text-slate-900 p-6 text-center space-y-2 z-20">
                  <Loader2 className="w-9 h-9 text-teal-600 animate-spin" />
                  <p className="text-sm font-bold text-slate-800">{verificationStep}</p>
                  <p className="text-xs text-slate-500">Recording biometric log...</p>
                </div>
              )}
            </div>

            {/* Camera Error Message */}
            {cameraError && (
              <div className="p-3 mx-4 mt-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0 text-rose-600" />
                <span>{cameraError}</span>
              </div>
            )}

            {/* Bottom Real-Time Status & Feedback Bar */}
            <div className="p-5 space-y-4 bg-white">
              <div
                className={`p-3.5 rounded-xl border flex items-start gap-3 text-xs transition-colors ${
                  scanState === 'matched'
                    ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                    : scanState === 'mismatch'
                    ? 'bg-amber-50 border-amber-200 text-amber-900'
                    : 'bg-slate-50 border-slate-200 text-slate-700'
                }`}
              >
                {scanState === 'matched' ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                ) : scanState === 'mismatch' ? (
                  <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                ) : (
                  <Loader2 className="w-4 h-4 text-teal-600 animate-spin shrink-0 mt-0.5" />
                )}

                <div className="space-y-0.5 flex-1">
                  <div className="font-semibold">
                    {scanState === 'matched'
                      ? 'Identity Verified!'
                      : scanState === 'mismatch'
                      ? 'Checking Biometric Alignment'
                      : 'Scanning Live Video'}
                  </div>
                  <div className="text-[11px] leading-relaxed opacity-90">
                    {scanMessage || 'Keep your face centered in the guide. System will auto-punch upon match.'}
                  </div>
                </div>
              </div>

              {/* Informational Guidance */}
              <p className="text-[11px] text-center text-slate-500">
                ✨ <strong>No button press needed:</strong> Attendance is automatically taken as soon as your face matches.
              </p>

              {/* Fallback Manual Trigger */}
              <div className="pt-1 flex items-center justify-between gap-3">
                <button
                  type="button"
                  onClick={handleCloseCamera}
                  disabled={verifying}
                  className="w-1/3 py-2.5 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 text-xs font-semibold transition"
                >
                  Cancel
                </button>

                <button
                  type="button"
                  onClick={handleManualCapture}
                  disabled={verifying}
                  className="w-2/3 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold transition flex items-center justify-center gap-1.5 cursor-pointer"
                  title="Force a manual biometric verification check"
                >
                  <ShieldCheck className="w-3.5 h-3.5 text-slate-600" />
                  <span>Manual Verify (Optional)</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
