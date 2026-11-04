'use client';

import React, { useState, useEffect, useRef } from 'react';
import {
  Camera,
  MapPin,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Loader2,
  ShieldCheck,
  User,
  ArrowRight,
  Building2,
  Sparkles,
} from 'lucide-react';
import {
  Employee,
  OfficeLocation,
  AttendanceLog,
  AttendanceStatus,
} from '@/types/attendance';
import {
  calculateEuclideanDistance,
  detectFaceFromLiveVideo,
  areModelsLoaded,
  loadFaceApiModels,
  FACE_MATCH_THRESHOLD,
} from '@/lib/faceApi';
// [LOCATION FUNCTIONALITY COMMENTED OUT FOR TESTING]
// import {
//   calculateHaversineDistance,
//   getDeviceLocation,
//   Coordinates,
// } from '@/lib/geo';
import {
  fetchOfficeLocation,
  checkTodayAttendance,
  recordAttendanceLog,
} from '@/lib/supabase';

interface Props {
  currentEmployee: Employee | null;
  onNavigateToRegister: () => void;
  modelsLoaded: boolean;
}

export function AttendanceTab({
  currentEmployee,
  onNavigateToRegister,
}: Props) {
  // Office & Status State
  const [office, setOffice] = useState<OfficeLocation | null>(null);
  const [todayLog, setTodayLog] = useState<AttendanceLog | null>(null);
  const [checkingTodayStatus, setCheckingTodayStatus] = useState(false);

  // Camera & Verification State
  const [cameraOpen, setCameraOpen] = useState(false);
  const [cameraLoading, setCameraLoading] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [verifying, setVerifying] = useState(false);
  const [verificationStep, setVerificationStep] = useState<string>('');

  // [LOCATION FUNCTIONALITY COMMENTED OUT FOR TESTING]
  // const [, setLiveLocation] = useState<Coordinates | null>(null);
  // const [liveDistanceToOffice, setLiveDistanceToOffice] = useState<number | null>(null);

  // Verification Outcome Modal/Card
  const [outcome, setOutcome] = useState<{
    status: AttendanceStatus | 'error';
    title: string;
    message: string;
    faceDistance?: number;
    geoDistance?: number;
    allowedRadius?: number;
  } | null>(null);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);

  // Load office details and employee today status asynchronously
  useEffect(() => {
    let active = true;

    async function initializeData() {
      try {
        const officeData = await fetchOfficeLocation();
        if (!active) return;
        setOffice(officeData);

        if (currentEmployee) {
          setCheckingTodayStatus(true);
          const log = await checkTodayAttendance(currentEmployee.employee_id);
          if (!active) return;
          setTodayLog(log);
          setCheckingTodayStatus(false);
        }
      } catch (err) {
        console.error('Error loading attendance prerequisites:', err);
        if (active) setCheckingTodayStatus(false);
      }
    }

    initializeData();

    return () => {
      active = false;
    };
  }, [currentEmployee]);

  // Clean up camera stream on unmount
  useEffect(() => {
    return () => {
      if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach((track) => track.stop());
      }
    };
  }, []);

  // Open LIVE camera (Strictly getUserMedia, NO file upload permitted)
  const handleOpenLiveCamera = async () => {
    setCameraError(null);
    setOutcome(null);
    setCameraLoading(true);

    try {
      // Ensure face-api models are initialized
      if (!areModelsLoaded()) {
        setVerificationStep('Loading AI face models...');
        await loadFaceApiModels();
      }

      // Check camera permission and get user media
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('Your browser does not support live camera access.');
      }

      setVerificationStep('Accessing live camera...');
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: 'user',
          width: { ideal: 640 },
          height: { ideal: 480 },
        },
        audio: false,
      });

      mediaStreamRef.current = stream;
      setCameraOpen(true);

      // [LOCATION FUNCTIONALITY COMMENTED OUT FOR TESTING]
      /*
      getDeviceLocation()
        .then((coords) => {
          setLiveLocation(coords);
          if (office) {
            const dist = calculateHaversineDistance(
              coords.latitude,
              coords.longitude,
              office.latitude,
              office.longitude
            );
            setLiveDistanceToOffice(dist);
          }
        })
        .catch((err) => {
          console.warn('Initial live location warning:', err.message);
        });
      */
    } catch (err: unknown) {
      const msg =
        err instanceof Error
          ? err.message
          : 'Unable to start camera. Please verify camera permissions in your browser.';
      setCameraError(msg);
      setCameraOpen(false);
    } finally {
      setCameraLoading(false);
      setVerificationStep('');
    }
  };

  // Attach stream to video element when camera is opened
  useEffect(() => {
    if (cameraOpen && videoRef.current && mediaStreamRef.current) {
      videoRef.current.srcObject = mediaStreamRef.current;
      videoRef.current.play().catch((err) => {
        console.error('Video play error:', err);
      });
    }
  }, [cameraOpen]);

  // Close live camera and release hardware
  const handleCloseCamera = () => {
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((track) => track.stop());
      mediaStreamRef.current = null;
    }
    setCameraOpen(false);
    setCameraError(null);
    setVerifying(false);
  };

  // Execute Attendance Verification Workflow (FACE ONLY MODE)
  const handleCaptureAndVerify = async () => {
    if (!currentEmployee || !videoRef.current) return;

    // Check once more if already marked today
    const existing = await checkTodayAttendance(currentEmployee.employee_id);
    if (existing) {
      setTodayLog(existing);
      setOutcome({
        status: 'error',
        title: 'Already Marked Today',
        message: `You have already marked attendance today at ${new Date(
          existing.captured_at
        ).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}. Only one successful attendance per employee per day is permitted.`,
      });
      handleCloseCamera();
      return;
    }

    setVerifying(true);
    setCameraError(null);

    let capturedFaceDist: number | null = null;

    try {
      // STEP 1: Biometric Face Verification
      setVerificationStep('Scanning face from live video frame...');
      const faceResult = await detectFaceFromLiveVideo(videoRef.current);

      if (!faceResult.success || !faceResult.descriptor) {
        throw new Error(
          faceResult.error ||
            'Could not clearly detect face. Please center your face in the live frame and avoid shadows.'
        );
      }

      // Calculate Euclidean distance with registered descriptor
      capturedFaceDist = calculateEuclideanDistance(
        currentEmployee.face_descriptor,
        faceResult.descriptor
      );

      const isFaceMatch = capturedFaceDist < FACE_MATCH_THRESHOLD;

      // [LOCATION FUNCTIONALITY COMMENTED OUT FOR TESTING]
      /*
      setVerificationStep('Acquiring high-accuracy GPS coordinates...');
      let userCoords: Coordinates | null = null;
      let distanceToOffice: number | null = null;
      let locationErrorMsg: string | null = null;

      try {
        userCoords = await getDeviceLocation();
        distanceToOffice = calculateHaversineDistance(
          userCoords.latitude,
          userCoords.longitude,
          office.latitude,
          office.longitude
        );
      } catch (locErr: unknown) {
        locationErrorMsg =
          locErr instanceof Error ? locErr.message : 'Location permission denied.';
      }

      // Rule A: Location permission denied
      if (locationErrorMsg || !userCoords || distanceToOffice === null) {
        await recordAttendanceLog({
          employee_id: currentEmployee.employee_id,
          latitude: null,
          longitude: null,
          distance_meters: null,
          face_distance: capturedFaceDist,
          status: 'location_failed',
          failure_reason: locationErrorMsg || 'Location permission denied',
        });
        setOutcome({
          status: 'location_failed',
          title: 'Location Permission Denied',
          message: locationErrorMsg || 'Location permission is required.',
          faceDistance: capturedFaceDist,
        });
        handleCloseCamera();
        return;
      }

      // Rule B: Outside radius
      const isInsideOfficeRadius = distanceToOffice <= office.radius_meters;
      if (!isInsideOfficeRadius) {
        await recordAttendanceLog({
          employee_id: currentEmployee.employee_id,
          latitude: userCoords.latitude,
          longitude: userCoords.longitude,
          distance_meters: distanceToOffice,
          face_distance: capturedFaceDist,
          status: 'location_failed',
          failure_reason: `Outside allowed office perimeter (${Math.round(distanceToOffice)}m > ${office.radius_meters}m)`,
        });
        setOutcome({
          status: 'location_failed',
          title: 'Location Verification Failed',
          message: `You are ${Math.round(distanceToOffice)} meters away from office.`,
          faceDistance: capturedFaceDist,
          geoDistance: distanceToOffice,
        });
        handleCloseCamera();
        return;
      }
      */

      // STEP 2: Evaluate Biometric Face Match Only
      if (!isFaceMatch) {
        await recordAttendanceLog({
          employee_id: currentEmployee.employee_id,
          latitude: null,
          longitude: null,
          distance_meters: null,
          face_distance: capturedFaceDist,
          status: 'face_mismatch',
          failure_reason: `Face distance ${capturedFaceDist} >= threshold ${FACE_MATCH_THRESHOLD}`,
        });

        setOutcome({
          status: 'face_mismatch',
          title: 'Face Not Matched',
          message: `The live camera photo does not match your registered face profile. (Biometric distance: ${capturedFaceDist}, required < ${FACE_MATCH_THRESHOLD}). Please look directly into the camera in good lighting.`,
          faceDistance: capturedFaceDist,
        });
        handleCloseCamera();
        return;
      }

      // Face Match Success: Save attendance as "present"
      setVerificationStep('Saving attendance record...');
      const savedLog = await recordAttendanceLog({
        employee_id: currentEmployee.employee_id,
        latitude: null,
        longitude: null,
        distance_meters: null,
        face_distance: capturedFaceDist,
        status: 'present',
      });

      setTodayLog(savedLog);
      setOutcome({
        status: 'present',
        title: 'Attendance Confirmed: PRESENT',
        message: `Welcome, ${currentEmployee.name}! Face biometric verified successfully (Similarity distance: ${capturedFaceDist} < ${FACE_MATCH_THRESHOLD}).`,
        faceDistance: capturedFaceDist,
      });

      handleCloseCamera();
    } catch (err: unknown) {
      const msg =
        err instanceof Error
          ? err.message
          : 'Verification failed. Please try again.';
      setCameraError(msg);
    } finally {
      setVerifying(false);
      setVerificationStep('');
    }
  };

  // If unauthenticated, show sign-in prompt
  if (!currentEmployee) {
    return (
      <div className="max-w-md mx-auto text-center py-12 px-6 bg-slate-900 border border-slate-800 rounded-3xl space-y-5 shadow-xl">
        <div className="w-16 h-16 bg-slate-800 rounded-2xl flex items-center justify-center mx-auto text-emerald-400">
          <User className="w-8 h-8" />
        </div>
        <div className="space-y-1.5">
          <h2 className="text-xl font-bold text-white">Sign In Required</h2>
          <p className="text-sm text-slate-400 leading-relaxed">
            Please register your face once or sign in with your Employee ID to access live attendance punch-in.
          </p>
        </div>
        <button
          onClick={onNavigateToRegister}
          className="w-full py-3.5 px-5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold rounded-2xl text-sm transition flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/20"
        >
          <span>Go to Register / Sign In</span>
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-xl mx-auto space-y-6">
      {/* Face Attendance Notice Banner */}
      <div className="p-3.5 bg-emerald-950/40 border border-emerald-500/30 rounded-2xl flex items-center justify-between text-xs text-emerald-300">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>
            <strong>Face-Only Attendance Mode Active:</strong> Location check is temporarily commented out.
          </span>
        </div>
      </div>

      {/* Employee & Attendance Status Card */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-7 shadow-xl space-y-6">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
            Daily Attendance Kiosk
          </span>
          <span className="text-xs text-slate-400">
            {new Date().toLocaleDateString(undefined, {
              weekday: 'short',
              month: 'short',
              day: 'numeric',
            })}
          </span>
        </div>

        {/* Profile Card */}
        <div className="flex items-center gap-4 p-4 rounded-2xl bg-slate-950 border border-slate-800">
          {currentEmployee.photo_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={currentEmployee.photo_url}
              alt={currentEmployee.name}
              className="w-16 h-16 rounded-2xl object-cover border-2 border-emerald-500 shadow-md"
            />
          ) : (
            <div className="w-16 h-16 rounded-2xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center text-xl font-bold border border-emerald-500/40">
              {currentEmployee.name.charAt(0)}
            </div>
          )}

          <div className="space-y-1 flex-1">
            <h3 className="text-lg font-bold text-white leading-tight">
              {currentEmployee.name}
            </h3>
            <p className="text-xs font-mono text-emerald-400 font-semibold tracking-wide">
              {currentEmployee.employee_id}
            </p>
            <div className="flex items-center gap-1.5 text-[11px] text-slate-400 pt-0.5">
              <Building2 className="w-3.5 h-3.5 text-slate-400" />
              <span>Office: {office?.name || 'Headquarters'}</span>
            </div>
          </div>
        </div>

        {/* Today's Status Banner */}
        {checkingTodayStatus ? (
          <div className="p-4 bg-slate-950 rounded-2xl border border-slate-800 flex items-center justify-center gap-2 text-slate-400 text-xs">
            <Loader2 className="w-4 h-4 animate-spin text-emerald-400" />
            <span>Checking today&apos;s records...</span>
          </div>
        ) : todayLog ? (
          <div className="p-5 bg-emerald-950/40 border border-emerald-500/40 rounded-2xl space-y-2 animate-in fade-in">
            <div className="flex items-center gap-2.5">
              <CheckCircle2 className="w-6 h-6 text-emerald-400 shrink-0" />
              <div>
                <h4 className="text-sm font-bold text-emerald-300">
                  Attendance Marked: PRESENT
                </h4>
                <p className="text-xs text-emerald-200/80">
                  Punch-in recorded at{' '}
                  <span className="font-semibold text-white">
                    {new Date(todayLog.captured_at).toLocaleTimeString([], {
                      hour: '2-digit',
                      minute: '2-digit',
                      second: '2-digit',
                    })}
                  </span>
                </p>
              </div>
            </div>
            <div className="pt-2 text-xs text-emerald-300/80 border-t border-emerald-800/40 flex items-center justify-between">
              <span>Biometric Face Verification</span>
              <span>
                Score:{' '}
                {todayLog.face_distance !== null
                  ? `${todayLog.face_distance} (Match < 0.5)`
                  : 'Verified'}
              </span>
            </div>
          </div>
        ) : (
          <div className="p-4 bg-slate-950 rounded-2xl border border-slate-800 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-3 h-3 rounded-full bg-amber-400 animate-ping" />
              <div>
                <p className="text-xs font-semibold text-slate-200">
                  Status: Not Marked Today
                </p>
                <p className="text-[11px] text-slate-400">
                  Requires live face biometric scan
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Primary Mark Attendance Action Button */}
        {!todayLog && (
          <button
            type="button"
            onClick={handleOpenLiveCamera}
            disabled={cameraLoading}
            className="w-full py-4 px-6 rounded-2xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-base transition shadow-lg shadow-emerald-500/25 flex items-center justify-center gap-3 active:scale-[0.99] disabled:opacity-50"
          >
            {cameraLoading ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                <span>Initializing Live Camera...</span>
              </>
            ) : (
              <>
                <Camera className="w-6 h-6" />
                <span>Mark Attendance (Open Camera)</span>
              </>
            )}
          </button>
        )}
      </div>

      {/* Outcome Banner (After Verification) */}
      {outcome && (
        <div
          className={`p-6 rounded-3xl border shadow-xl space-y-3 animate-in zoom-in-95 duration-200 ${
            outcome.status === 'present'
              ? 'bg-emerald-950/60 border-emerald-500 text-emerald-200'
              : 'bg-rose-950/60 border-rose-500 text-rose-200'
          }`}
        >
          <div className="flex items-start gap-3">
            {outcome.status === 'present' ? (
              <CheckCircle2 className="w-7 h-7 text-emerald-400 shrink-0 mt-0.5" />
            ) : (
              <XCircle className="w-7 h-7 text-rose-400 shrink-0 mt-0.5" />
            )}
            <div className="space-y-1">
              <h3
                className={`text-base font-bold ${
                  outcome.status === 'present' ? 'text-emerald-300' : 'text-rose-300'
                }`}
              >
                {outcome.title}
              </h3>
              <p className="text-xs sm:text-sm leading-relaxed">{outcome.message}</p>
            </div>
          </div>

          {outcome.faceDistance !== undefined && (
            <div className="pt-3 border-t border-white/10 text-xs">
              <div className="bg-black/30 p-2 rounded-xl flex items-center justify-between">
                <span className="text-[10px] text-slate-400 uppercase">
                  Face Euclidean Distance
                </span>
                <span
                  className={`font-mono font-bold ${
                    outcome.faceDistance < FACE_MATCH_THRESHOLD
                      ? 'text-emerald-300'
                      : 'text-rose-300'
                  }`}
                >
                  {outcome.faceDistance} (Threshold: {FACE_MATCH_THRESHOLD})
                </span>
              </div>
            </div>
          )}

          {outcome.status !== 'present' && (
            <button
              onClick={handleOpenLiveCamera}
              className="mt-2 w-full py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-medium text-xs transition"
            >
              Retry Live Attendance Verification
            </button>
          )}
        </div>
      )}

      {/* LIVE CAMERA MODAL (Strictly live getUserMedia - No file upload) */}
      {cameraOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/90 backdrop-blur-md animate-in fade-in duration-200">
          <div className="bg-slate-900 border border-slate-700 w-full max-w-lg rounded-3xl overflow-hidden shadow-2xl flex flex-col">
            {/* Modal Header */}
            <div className="px-5 py-4 border-b border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-2.5 h-2.5 rounded-full bg-rose-500 animate-pulse" />
                <span className="text-sm font-bold text-white uppercase tracking-wider">
                  Live Camera Verification
                </span>
              </div>
              <button
                type="button"
                onClick={handleCloseCamera}
                disabled={verifying}
                className="text-xs text-slate-400 hover:text-slate-200 px-2 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 transition"
              >
                Cancel
              </button>
            </div>

            {/* Live Camera Viewfinder */}
            <div className="relative bg-black aspect-[4/3] w-full overflow-hidden flex items-center justify-center">
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="w-full h-full object-cover transform -scale-x-100"
              />

              {/* Viewfinder Biometric Reticle */}
              <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                {/* Oval Guide */}
                <div className="w-48 h-64 border-2 border-emerald-400/80 rounded-[50%] shadow-[0_0_20px_rgba(16,185,129,0.3)] relative">
                  {/* Scanning beam line */}
                  <div className="absolute top-0 left-0 right-0 h-0.5 bg-emerald-400 shadow-[0_0_12px_#34d399] animate-bounce" />
                </div>

                {/* Corner reticle brackets */}
                <div className="absolute top-6 left-6 w-8 h-8 border-t-2 border-l-2 border-emerald-500" />
                <div className="absolute top-6 right-6 w-8 h-8 border-t-2 border-r-2 border-emerald-500" />
                <div className="absolute bottom-6 left-6 w-8 h-8 border-b-2 border-l-2 border-emerald-500" />
                <div className="absolute bottom-6 right-6 w-8 h-8 border-b-2 border-r-2 border-emerald-500" />
              </div>

              {/* Processing Spinner Overlay */}
              {verifying && (
                <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-xs flex flex-col items-center justify-center text-white p-6 text-center space-y-3">
                  <Loader2 className="w-10 h-10 text-emerald-400 animate-spin" />
                  <p className="text-sm font-semibold">{verificationStep}</p>
                  <p className="text-xs text-slate-400">
                    Comparing 128-D face biometric vector...
                  </p>
                </div>
              )}
            </div>

            {/* Error Message within Modal */}
            {cameraError && (
              <div className="p-3 mx-4 mt-3 rounded-xl bg-rose-950/60 border border-rose-500/50 text-rose-300 text-xs flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>{cameraError}</span>
              </div>
            )}

            {/* Modal Controls */}
            <div className="p-5 space-y-3 bg-slate-900">
              <p className="text-xs text-center text-slate-400">
                Center your face in the oval guide. The AI will match your biometric signature.
              </p>

              <button
                type="button"
                onClick={handleCaptureAndVerify}
                disabled={verifying}
                className="w-full py-4 rounded-2xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-base transition shadow-lg shadow-emerald-500/30 flex items-center justify-center gap-2 active:scale-[0.98] disabled:opacity-50"
              >
                {verifying ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    <span>Verifying Face Biometrics...</span>
                  </>
                ) : (
                  <>
                    <ShieldCheck className="w-5 h-5" />
                    <span>Verify Face & Mark Attendance</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
