import type { BlueprintCalibrationPoint } from "./blueprintCalibration";

export type Point = { x: number; y: number };

/**
 * Finds the best snapping point (corner, intersection, or edge) near the target.
 * This is a lightweight image analysis utility that avoids AI/ML.
 */
export function findSnapPoint(
  image: HTMLImageElement | null,
  targetX: number, // in pixels relative to image natural size
  targetY: number, // in pixels relative to image natural size
  radius: number,   // in pixels relative to image natural size
  existingPolygons: BlueprintCalibrationPoint[][] = []
): Point {
  const originalPoint = { x: targetX, y: targetY };

  if (!image || image.naturalWidth === 0 || image.naturalHeight === 0) {
    return originalPoint;
  }

  // 1. Edge Snapping (Highest Priority for tracing consistency)
  const edgePoint = snapToPolygonEdge(originalPoint, existingPolygons, image, radius);
  
  // 2. Pixel-level Corner/Intersection Detection
  const pixelPoint = findPixelSnapPoint(image, targetX, targetY, radius);
  
  // Arbitration: Pixel snapping usually feels better for blueprints if a corner is found.
  // If we found a pixel-level corner, use it. Otherwise use the edge snap.
  return pixelPoint || edgePoint || originalPoint;
}

/**
 * Snaps a point to the nearest edge of any existing polygon.
 */
function snapToPolygonEdge(
  point: Point,
  polygons: BlueprintCalibrationPoint[][],
  image: HTMLImageElement | null,
  radius: number
): Point | null {
  if (!image || polygons.length === 0) return null;

  let bestPoint: Point | null = null;
  let minDistance = radius;

  const w = image.naturalWidth;
  const h = image.naturalHeight;

  for (const polygon of polygons) {
    for (let i = 0; i < polygon.length; i++) {
      const p1 = {
        x: (polygon[i].xPercent / 100) * w,
        y: (polygon[i].yPercent / 100) * h
      };
      const p2 = {
        x: (polygon[(i + 1) % polygon.length].xPercent / 100) * w,
        y: (polygon[(i + 1) % polygon.length].yPercent / 100) * h
      };

      const nearest = getNearestPointOnSegment(point, p1, p2);
      const dist = getDistance(point, nearest);

      if (dist < minDistance) {
        minDistance = dist;
        bestPoint = nearest;
      }
    }
  }

  return bestPoint;
}

function getNearestPointOnSegment(p: Point, a: Point, b: Point): Point {
  const atob = { x: b.x - a.x, y: b.y - a.y };
  const atop = { x: p.x - a.x, y: p.y - a.y };
  const lenSq = atob.x * atob.x + atob.y * atob.y;
  let t = lenSq === 0 ? -1 : (atop.x * atob.x + atop.y * atob.y) / lenSq;
  
  if (t < 0) return a;
  if (t > 1) return b;
  
  return {
    x: a.x + t * atob.x,
    y: a.y + t * atob.y
  };
}

function getDistance(p1: Point, p2: Point): number {
  return Math.sqrt((p1.x - p2.x) ** 2 + (p1.y - p2.y) ** 2);
}

/**
 * Analyzes local pixels to find corners or intersections.
 */
function findPixelSnapPoint(
  image: HTMLImageElement,
  targetX: number,
  targetY: number,
  radius: number
): Point | null {
  try {
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) return null;

    const size = radius * 2;
    canvas.width = size;
    canvas.height = size;

    const sourceX = Math.floor(targetX - radius);
    const sourceY = Math.floor(targetY - radius);

    ctx.drawImage(image, sourceX, sourceY, size, size, 0, 0, size, size);
    const imageData = ctx.getImageData(0, 0, size, size);
    const pixels = imageData.data;

    // 1. Convert to grayscale and find threshold
    let sum = 0;
    const grayscale = new Uint8Array(size * size);
    for (let i = 0; i < pixels.length; i += 4) {
      const avg = (pixels[i] + pixels[i + 1] + pixels[i + 2]) / 3;
      grayscale[i / 4] = avg;
      sum += avg;
    }
    const avgIntensity = sum / (size * size);
    // Dark pixels are likely walls. Use a threshold slightly darker than average.
    const threshold = avgIntensity * 0.85;

    // 2. Identify "Junctionness" or "Cornerness"
    let bestX = -1;
    let bestY = -1;
    let maxScore = 0;

    // Scan a smaller inner area to stay within radius
    const margin = 2;
    for (let y = margin; y < size - margin; y++) {
      for (let x = margin; x < size - margin; x++) {
        const idx = y * size + x;
        if (grayscale[idx] > threshold) continue; // Skip light pixels

        // Simple junction detection: 
        // Count transitions in a ring around the pixel
        const score = calculateJunctionScore(grayscale, x, y, size, threshold);
        
        if (score > maxScore) {
          maxScore = score;
          bestX = x;
          bestY = y;
        } else if (score === maxScore && maxScore > 0) {
          // Tie-break: pick the one closest to the center
          const currentDist = Math.abs(x - radius) + Math.abs(y - radius);
          const bestDist = Math.abs(bestX - radius) + Math.abs(bestY - radius);
          if (currentDist < bestDist) {
            bestX = x;
            bestY = y;
          }
        }
      }
    }

    if (maxScore >= 3) { // 3 or more "arms" = intersection
      return { x: sourceX + bestX, y: sourceY + bestY };
    }
    
    // If no clear intersection, look for "strong" corners (2 arms with angle)
    // For now, we'll return the darkest/most connected point if it's significant
    if (maxScore >= 2) {
        return { x: sourceX + bestX, y: sourceY + bestY };
    }

    return null;
  } catch (e) {
    console.error("Error during pixel snapping:", e);
    return null;
  }
}

/**
 * Calculates how many "arms" (lines) meet at this pixel.
 * Uses a ring of radius 3 and counts white-to-black transitions.
 */
function calculateJunctionScore(
  grayscale: Uint8Array,
  x: number,
  y: number,
  size: number,
  threshold: number
): number {
  const r = 3;
  const ring: boolean[] = [];
  
  // Sample a ring around the pixel
  for (let angle = 0; angle < 360; angle += 45) {
    const rad = (angle * Math.PI) / 180;
    const nx = Math.round(x + Math.cos(rad) * r);
    const ny = Math.round(y + Math.sin(rad) * r);
    
    if (nx >= 0 && nx < size && ny >= 0 && ny < size) {
      ring.push(grayscale[ny * size + nx] <= threshold);
    } else {
      ring.push(false);
    }
  }

  // Count transitions
  let transitions = 0;
  for (let i = 0; i < ring.length; i++) {
    const current = ring[i];
    const next = ring[(i + 1) % ring.length];
    if (!current && next) { // White to black transition
      transitions++;
    }
  }

  return transitions;
}
