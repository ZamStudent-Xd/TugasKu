/**
 * Device & Screen Size Detection Utility
 * 
 * Aturan Akses TugasKu:
 * - HANYA dapat diakses melalui LAPTOP dan TABLET dengan ukuran layar minimal 8.7 INCI.
 * - Smartphone dan perangkat berlayar kecil di bawah 8.7 inci DITOLAK OTOMATIS.
 * - Tetap mendeteksi dan menolak smartphone meskipun pengguna mengaktifkan "Situs Desktop / Mode Desktop" di browser ponsel.
 */

export interface DeviceInfo {
  isSupported: boolean;
  deviceType: "laptop" | "tablet" | "phone";
  estimatedInches: number;
  screenWidth: number;
  screenHeight: number;
  minScreenDimension: number;
  maxScreenDimension: number;
  isDesktopModeOnMobile: boolean;
  userAgentMobile: boolean;
  rejectionReason?: string;
}

/**
 * Menghitung estimasi ukuran diagonal layar fisik dalam satuan inci (inches)
 * dan menentukan kelayakan perangkat (minimal 8.7 inci, laptop, atau tablet).
 */
export function checkDeviceSupport(): DeviceInfo {
  if (typeof window === "undefined" || typeof navigator === "undefined") {
    // Default fallback untuk SSR
    return {
      isSupported: true,
      deviceType: "laptop",
      estimatedInches: 14.0,
      screenWidth: 1920,
      screenHeight: 1080,
      minScreenDimension: 1080,
      maxScreenDimension: 1920,
      isDesktopModeOnMobile: false,
      userAgentMobile: false,
    };
  }

  const ua = navigator.userAgent || "";
  const dpr = window.devicePixelRatio || 1;

  // Dimensi layar fisik dalam CSS pixels
  // Catatan: window.screen.width/height TIDAK berubah saat ponsel mengaktifkan mode desktop
  const sWidth = window.screen.width || window.innerWidth;
  const sHeight = window.screen.height || window.innerHeight;
  const minDim = Math.min(sWidth, sHeight);
  const maxDim = Math.max(sWidth, sHeight);

  // Deteksi User-Agent ponsel (iPhone, iPod, Android Mobile, Windows Phone, dll)
  // Perhatikan: Android Tablet biasanya TIDAK menyertakan kata "Mobile" di UA
  const isMobileUa = /iPhone|iPod|Windows Phone|BlackBerry|IEMobile|Opera Mini/i.test(ua) ||
    (/Android/i.test(ua) && /Mobile/i.test(ua));

  // Client Hints API (Chrome)
  const navData = (navigator as unknown as { userAgentData?: { mobile?: boolean } }).userAgentData;
  const isClientHintsMobile = navData?.mobile === true;

  // Deteksi Touchscreen
  const hasTouch = (navigator.maxTouchPoints && navigator.maxTouchPoints > 0) ||
    window.matchMedia("(pointer: coarse)").matches;

  // Deteksi Mouse/Trackpad presisi (Ciri khas Laptop/PC)
  const hasFinePointer = window.matchMedia("(pointer: fine)").matches &&
    window.matchMedia("(hover: hover)").matches;

  // Deteksi apakah ponsel sedang menyamar dalam "Mode Desktop / Desktop Site"
  // Pada ponsel dengan Mode Desktop: window.innerWidth diperbesar (>= 768px),
  // namun dimensi fisik layar screen.width/height tetap kecil (minDim <= 460px).
  const isDesktopModeOnMobile = (minDim <= 460) && (window.innerWidth >= 700);

  // ==========================================================================
  // PERHITUNGAN INCI FISIK LAYAR (DIAGONAL ESTIMASI)
  // ==========================================================================
  let estimatedInches = 0;
  let deviceType: "laptop" | "tablet" | "phone" = "laptop";

  if (!hasTouch && hasFinePointer && minDim >= 600) {
    // Laptop atau Komputer Desktop
    deviceType = "laptop";
    // Standar laptop 13.3" - 16"
    estimatedInches = Math.max(13.3, Number((Math.hypot(sWidth, sHeight) / 115).toFixed(1)));
  } else if (minDim <= 460 || isMobileUa || isClientHintsMobile || isDesktopModeOnMobile) {
    // Pasti Smartphone (iPhone 16 Pro Max pun CSS width hanya 430px)
    deviceType = "phone";
    // Hitung inci fisik smartphone (rata-rata 5.4" - 6.8")
    const cssDiag = Math.hypot(sWidth, sHeight);
    estimatedInches = Number((cssDiag / 148).toFixed(1));
    if (estimatedInches > 7.2) estimatedInches = 6.8; // Batas wajar ukuran fisik smartphone
    if (estimatedInches < 4.7) estimatedInches = 5.5;
  } else {
    // Tablet (Touchscreen dengan minDim >= 460px)
    deviceType = "tablet";
    // Tablet 8.7" (misal Samsung Galaxy Tab A9): hardware 800x1340, CSS minDim ~600-800px
    // Tablet 10.2" - 12.9" (iPad/Galaxy Tab S): minDim 768-1024px
    const cssDiag = Math.hypot(sWidth, sHeight);
    // Faktor konversi density CSS tablet
    const tabletInches = Number((cssDiag / 138).toFixed(1));
    estimatedInches = tabletInches;
  }

  // ==========================================================================
  // ATURAN VALIDASI KELAYAKAN (MINIMAL 8.7 INCI)
  // ==========================================================================
  // 1. Laptop / Desktop selalu didukung (layar >= 13 inci)
  // 2. Smartphone APAPUN (bahkan jika mengaktifkan mode desktop) DITOLAK
  // 3. Tablet harus berukuran minimal 8.7 inci (minDim >= 580px dan diagonal >= 8.7")
  let isSupported = false;
  let rejectionReason = "";

  if (deviceType === "laptop") {
    isSupported = true;
  } else if (deviceType === "phone" || minDim < 560 || isDesktopModeOnMobile) {
    isSupported = false;
    deviceType = "phone";
    if (isDesktopModeOnMobile) {
      rejectionReason = "Mode Desktop di smartphone terdeteksi. Akses tetap ditolak karena ukuran fisik layar di bawah 8.7 inci.";
    } else {
      rejectionReason = "Smartphone tidak didukung. TugasKu dirancang khusus untuk layar kerja minimal 8.7 inci (Tablet / Laptop).";
    }
  } else if (deviceType === "tablet") {
    // Tablet Samsung Tab A9 (8.7 inci) memiliki minDim >= 580px dan estimasi inci >= 8.7
    // Tablet di bawah 8.7 inci (seperti iPad Mini 8.3 inci atau phablet 7 inci) ditolak
    if (estimatedInches >= 8.6 && minDim >= 560) {
      isSupported = true;
    } else {
      isSupported = false;
      rejectionReason = `Tablet berukuran ${estimatedInches}" terdeteksi. Minimal ukuran layar tablet yang didukung adalah 8.7 inci.`;
    }
  }

  return {
    isSupported,
    deviceType,
    estimatedInches,
    screenWidth: sWidth,
    screenHeight: sHeight,
    minScreenDimension: minDim,
    maxScreenDimension: maxDim,
    isDesktopModeOnMobile,
    userAgentMobile: isMobileUa || isClientHintsMobile,
    rejectionReason,
  };
}
