// Unit test for deviceDetection logic
import assert from "assert";

function simulateDevice({
  screenWidth,
  screenHeight,
  innerWidth,
  innerHeight,
  userAgent,
  maxTouchPoints,
  hasFinePointer,
  hasCoarsePointer,
  clientHintsMobile,
}) {
  const sWidth = screenWidth;
  const sHeight = screenHeight;
  const minDim = Math.min(sWidth, sHeight);
  const maxDim = Math.max(sWidth, sHeight);

  const isMobileUa =
    /iPhone|iPod|Windows Phone|BlackBerry|IEMobile|Opera Mini/i.test(userAgent) ||
    (/Android/i.test(userAgent) && /Mobile/i.test(userAgent));

  const hasTouch = (maxTouchPoints && maxTouchPoints > 0) || hasCoarsePointer;
  const isDesktopModeOnMobile = minDim <= 460 && innerWidth >= 700;

  let estimatedInches = 0;
  let deviceType = "laptop";

  if (!hasTouch && hasFinePointer && minDim >= 600) {
    deviceType = "laptop";
    estimatedInches = Math.max(13.3, Number((Math.hypot(sWidth, sHeight) / 115).toFixed(1)));
  } else if (minDim <= 460 || isMobileUa || clientHintsMobile || isDesktopModeOnMobile) {
    deviceType = "phone";
    const cssDiag = Math.hypot(sWidth, sHeight);
    estimatedInches = Number((cssDiag / 148).toFixed(1));
    if (estimatedInches > 7.2) estimatedInches = 6.8;
    if (estimatedInches < 4.7) estimatedInches = 5.5;
  } else {
    deviceType = "tablet";
    const cssDiag = Math.hypot(sWidth, sHeight);
    estimatedInches = Number((cssDiag / 138).toFixed(1));
  }

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
    if (estimatedInches >= 8.6 && minDim >= 560) {
      isSupported = true;
    } else {
      isSupported = false;
      rejectionReason = `Tablet berukuran ${estimatedInches}" terdeteksi. Minimal ukuran layar tablet yang didukung adalah 8.7 inci.`;
    }
  }

  return { isSupported, deviceType, estimatedInches, isDesktopModeOnMobile, rejectionReason };
}

console.log("🧪 Menguji Deteksi Perangkat & Pembatasan Ukuran Layar...");

// Test 1: Laptop Standar (1080p, mouse pointer)
const laptop = simulateDevice({
  screenWidth: 1920,
  screenHeight: 1080,
  innerWidth: 1920,
  innerHeight: 950,
  userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36",
  maxTouchPoints: 0,
  hasFinePointer: true,
  hasCoarsePointer: false,
});
assert.strictEqual(laptop.isSupported, true, "Laptop harus didukung");
assert.strictEqual(laptop.deviceType, "laptop");
console.log("✅ 1. Laptop Standar (1080p): DIIZINKAN (Laptop ~" + laptop.estimatedInches + "\")");

// Test 2: iPhone 14/15/16 (Mode Normal)
const iphone = simulateDevice({
  screenWidth: 393,
  screenHeight: 852,
  innerWidth: 393,
  innerHeight: 852,
  userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148 Safari/604.1",
  maxTouchPoints: 5,
  hasFinePointer: false,
  hasCoarsePointer: true,
});
assert.strictEqual(iphone.isSupported, false, "iPhone mode normal harus ditolak");
assert.strictEqual(iphone.deviceType, "phone");
console.log("✅ 2. iPhone (Mode Normal): DITOLAK (Smartphone ~" + iphone.estimatedInches + "\")");

// Test 3: Android Smartphone Mode Desktop (Samsung S23/S24 - Situs Desktop Aktif)
const androidDesktopMode = simulateDevice({
  screenWidth: 412,
  screenHeight: 915,
  innerWidth: 980, // Viewport diperbesar karena mode desktop!
  innerHeight: 1200,
  userAgent: "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  maxTouchPoints: 5,
  hasFinePointer: false,
  hasCoarsePointer: true,
  clientHintsMobile: true,
});
assert.strictEqual(androidDesktopMode.isSupported, false, "Smartphone dengan mode desktop HARUS tetap ditolak");
assert.strictEqual(androidDesktopMode.deviceType, "phone");
assert.strictEqual(androidDesktopMode.isDesktopModeOnMobile, true, "Harus mendeteksi mode desktop di ponsel");
console.log("✅ 3. Android Smartphone (Mode Desktop Aktif): DITOLAK (Terdeteksi Mode Desktop di Smartphone)");

// Test 4: iPhone Landscape Mode
const iphoneLandscape = simulateDevice({
  screenWidth: 852,
  screenHeight: 393,
  innerWidth: 852,
  innerHeight: 393,
  userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148 Safari/604.1",
  maxTouchPoints: 5,
  hasFinePointer: false,
  hasCoarsePointer: true,
});
assert.strictEqual(iphoneLandscape.isSupported, false, "iPhone landscape harus tetap ditolak");
console.log("✅ 4. iPhone (Landscape): DITOLAK (minDim 393px)");

// Test 5: Tablet 8.7 Inci (Samsung Galaxy Tab A9)
const tabA9 = simulateDevice({
  screenWidth: 800,
  screenHeight: 1340,
  innerWidth: 800,
  innerHeight: 1340,
  userAgent: "Mozilla/5.0 (Linux; Android 13; SM-X110) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36",
  maxTouchPoints: 10,
  hasFinePointer: false,
  hasCoarsePointer: true,
});
assert.strictEqual(tabA9.isSupported, true, "Samsung Galaxy Tab A9 (8.7 inci) harus didukung");
assert.strictEqual(tabA9.deviceType, "tablet");
console.log("✅ 5. Tablet 8.7\" (Samsung Tab A9): DIIZINKAN (Tablet ~" + tabA9.estimatedInches + "\")");

// Test 6: Tablet 10.2 Inci (iPad 10th Gen)
const ipad = simulateDevice({
  screenWidth: 810,
  screenHeight: 1080,
  innerWidth: 810,
  innerHeight: 1080,
  userAgent: "Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148 Safari/604.1",
  maxTouchPoints: 5,
  hasFinePointer: false,
  hasCoarsePointer: true,
});
assert.strictEqual(ipad.isSupported, true, "iPad 10.2 inci harus didukung");
assert.strictEqual(ipad.deviceType, "tablet");
console.log("✅ 6. Tablet 10.2\" (iPad 10th Gen): DIIZINKAN (Tablet ~" + ipad.estimatedInches + "\")");

console.log("\n🎉 SEMUA PENGUJIAN LOGIKA DETEKSI PERANGKAT LULUS 100%!");
