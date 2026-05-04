/**
 * RideMatchService.js
 * Hệ thống ghép chuyến thông minh dựa trên lịch sử + GPS
 *
 * Bảng điểm:
 *  +30  Từng chở đúng hành khách này (lịch sử COMPLETED)
 *  +30  Điểm đón gần (GPS ≤ 500m hoặc so sánh chuỗi nếu không có GPS)
 *  +25  Điểm đến gần (GPS ≤ 500m hoặc so sánh chuỗi)
 *  +20  Khung giờ trùng (chênh ≤ 60 phút)
 *
 * Ngưỡng thông báo:
 *  - Tài xế quen (có lịch sử với khách): ≥ 50 điểm
 *  - Tài xế mới: trùng đủ cả 3 tiêu chí route + giờ (≥ 75 điểm)
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// ============================================
// UTILS
// ============================================

/**
 * Tính khoảng cách Haversine giữa 2 toạ độ GPS (đơn vị: mét)
 */
function haversineDistance(lat1, lng1, lat2, lng2) {
  const R = 6371000; // bán kính Trái Đất (mét)
  const toRad = (x) => (x * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

/**
 * Chuẩn hóa chuỗi địa chỉ (loại số nhà, ký tự đặc biệt)
 */
function normalizeLocation(text) {
  if (!text) return [];
  return text
    .toLowerCase()
    .replace(/[0-9]+\/[0-9]+/g, '') // loại số nhà kiểu 10/3
    .replace(/\b\d+\b/g, '')        // loại số đơn lẻ
    .replace(/[^\p{L}\s]/gu, ' ')   // loại ký tự đặc biệt
    .split(/\s+/)
    .filter((w) => w.length >= 2);  // giữ từ ≥ 2 ký tự
}

/**
 * So sánh chuỗi địa chỉ dựa trên số từ chung
 * Trả về true nếu ≥ 2 từ chung
 */
function locationTextMatch(a, b) {
  const wordsA = new Set(normalizeLocation(a));
  const wordsB = new Set(normalizeLocation(b));
  let common = 0;
  for (const w of wordsA) if (wordsB.has(w)) common++;
  return common >= 2;
}

/**
 * So sánh địa điểm: ưu tiên GPS, fallback về text
 * Trả về true nếu "gần nhau" (GPS ≤ 500m hoặc text trùng)
 */
function locationMatch(lat1, lng1, lat2, lng2, text1, text2) {
  if (lat1 && lng1 && lat2 && lng2) {
    const dist = haversineDistance(lat1, lng1, lat2, lng2);
    return dist <= 500; // trong vòng 500 mét
  }
  return locationTextMatch(text1, text2);
}

/**
 * So sánh khung giờ (parse HH:MM, chênh ≤ 60 phút)
 * Bỏ qua nếu chuỗi không phân tích được
 */
function timeMatch(timeA, timeB) {
  try {
    const parse = (t) => {
      if (!t) return null;
      // tìm pattern HH:MM trong chuỗi
      const m = t.match(/(\d{1,2}):(\d{2})/);
      if (!m) return null;
      return parseInt(m[1]) * 60 + parseInt(m[2]);
    };
    const a = parse(timeA);
    const b = parse(timeB);
    if (a === null || b === null) return false;
    return Math.abs(a - b) <= 60;
  } catch {
    return false;
  }
}

// ============================================
// CORE MATCHING
// ============================================

/**
 * Tìm tài xế phù hợp cho một yêu cầu mới.
 * @param {object} newRequest - CarpoolRequest vừa tạo (có passengerId, departure, destination, departureTime, lat/lng)
 * @returns {Array<{driverId, score, reasons}>}
 */
async function findMatchingDrivers(newRequest) {
  const {
    passengerId,
    departure, departureLat, departureLng,
    destination, destinationLat, destinationLng,
    departureTime
  } = newRequest;

  // Lấy tất cả chuyến COMPLETED trong 90 ngày gần đây có tài xế
  const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
  const completedRides = await prisma.carpoolRequest.findMany({
    where: {
      status: 'COMPLETED',
      driverId: { not: null },
      driverId: { not: passengerId }, // loại chính người đặt
      createdAt: { gte: ninetyDaysAgo }
    },
    select: {
      driverId: true,
      passengerId: true,
      departure: true,
      destination: true,
      departureTime: true,
      departureLat: true,
      departureLng: true,
      destinationLat: true,
      destinationLng: true
    }
  });

  // Tổng hợp điểm theo driverId
  const driverScores = new Map(); // driverId -> { score, reasons }

  for (const ride of completedRides) {
    const dId = ride.driverId;
    if (!dId || dId === passengerId) continue;

    let entry = driverScores.get(dId) || { score: 0, reasons: [], hasHistory: false, fullRouteMatch: false };

    // ---- 1. Lịch sử cùng khách (+30) ----
    if (ride.passengerId === passengerId && !entry.hasHistory) {
      entry.score += 30;
      entry.reasons.push('Đã từng chở hành khách này');
      entry.hasHistory = true;
    }

    // ---- 2. Điểm đón gần (+30) ----
    const depMatch = locationMatch(
      ride.departureLat, ride.departureLng,
      departureLat, departureLng,
      ride.departure, departure
    );
    if (depMatch && !entry.reasons.includes('Trùng điểm đón')) {
      entry.score += 30;
      entry.reasons.push('Trùng điểm đón');
    }

    // ---- 3. Điểm đến gần (+25) ----
    const destMatch = locationMatch(
      ride.destinationLat, ride.destinationLng,
      destinationLat, destinationLng,
      ride.destination, destination
    );
    if (destMatch && !entry.reasons.includes('Trùng điểm đến')) {
      entry.score += 25;
      entry.reasons.push('Trùng điểm đến');
    }

    // ---- 4. Khung giờ (+20) ----
    const timeOk = timeMatch(ride.departureTime, departureTime);
    if (timeOk && !entry.reasons.includes('Trùng khung giờ')) {
      entry.score += 20;
      entry.reasons.push('Trùng khung giờ');
    }

    // Kiểm tra full route match (đủ 3 tiêu chí route+giờ, không cần lịch sử)
    if (depMatch && destMatch && timeOk) {
      entry.fullRouteMatch = true;
    }

    driverScores.set(dId, entry);
  }

  // Lọc tài xế đủ điều kiện
  const results = [];
  for (const [driverId, entry] of driverScores) {
    // Tài xế quen: ≥ 50 điểm
    // Tài xế mới: fullRouteMatch (trùng đủ 3 tiêu chí = ≥ 75 điểm)
    const isEligible = entry.hasHistory
      ? entry.score >= 50
      : entry.fullRouteMatch;

    if (isEligible) {
      results.push({ driverId, score: entry.score, reasons: entry.reasons });
    }
  }

  // Sắp xếp theo điểm giảm dần
  results.sort((a, b) => b.score - a.score);
  return results;
}

module.exports = { findMatchingDrivers };
