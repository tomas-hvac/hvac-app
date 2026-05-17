export type DetectedRoomWorkflowStatus =
  | "needs-review"
  | "confirmed"
  | "converted-to-trace"
  | "sent-to-manual-d";

export type DetectedBlueprintRoom = {
  id: string;
  name: string;
  squareFeet: number;
  floorLevel: string;
  windowsCount: string;
  exteriorWallsCount: string;
  confirmed: boolean;
  confidencePercent: number;
  workflowStatus: DetectedRoomWorkflowStatus;
  overlay: {
    leftPercent: number;
    topPercent: number;
    widthPercent: number;
    heightPercent: number;
  };
};

const MIN_ROOM_OVERLAY_WIDTH_PERCENT = 4;
const MIN_ROOM_OVERLAY_HEIGHT_PERCENT = 4;
const MAX_ROOM_OVERLAY_WIDTH_PERCENT = 70;
const MAX_ROOM_OVERLAY_HEIGHT_PERCENT = 70;
const MIN_ROOM_OVERLAY_AREA_PERCENT = 0.5;
const MAX_ROOM_OVERLAY_AREA_PERCENT = 45;
const MIN_ROOM_ASPECT_RATIO = 0.25;
const MAX_ROOM_ASPECT_RATIO = 4;

function clampPercent(value: number) {
  return Math.min(100, Math.max(0, value));
}

function normalizeDetectedRoomOverlay(room: DetectedBlueprintRoom): DetectedBlueprintRoom {
  const leftPercent = clampPercent(room.overlay.leftPercent);
  const topPercent = clampPercent(room.overlay.topPercent);
  const widthPercent = Math.min(100 - leftPercent, Math.max(0, room.overlay.widthPercent));
  const heightPercent = Math.min(100 - topPercent, Math.max(0, room.overlay.heightPercent));

  return {
    ...room,
    overlay: {
      leftPercent,
      topPercent,
      widthPercent,
      heightPercent,
    },
  };
}

function isReliableDetectedRoomCandidate(room: DetectedBlueprintRoom) {
  const { widthPercent, heightPercent } = room.overlay;
  if (widthPercent < MIN_ROOM_OVERLAY_WIDTH_PERCENT) return false;
  if (heightPercent < MIN_ROOM_OVERLAY_HEIGHT_PERCENT) return false;
  if (widthPercent > MAX_ROOM_OVERLAY_WIDTH_PERCENT) return false;
  if (heightPercent > MAX_ROOM_OVERLAY_HEIGHT_PERCENT) return false;

  const areaPercent = (widthPercent * heightPercent) / 100;
  if (areaPercent < MIN_ROOM_OVERLAY_AREA_PERCENT) return false;
  if (areaPercent > MAX_ROOM_OVERLAY_AREA_PERCENT) return false;

  const aspectRatio = widthPercent / Math.max(1, heightPercent);
  if (aspectRatio < MIN_ROOM_ASPECT_RATIO) return false;
  if (aspectRatio > MAX_ROOM_ASPECT_RATIO) return false;

  return room.squareFeet > 0 && room.confidencePercent >= 50;
}

function stabilizeDetectedRoomCandidates(rooms: DetectedBlueprintRoom[]) {
  return rooms
    .map(normalizeDetectedRoomOverlay)
    .filter(isReliableDetectedRoomCandidate)
    .sort((a, b) => b.confidencePercent - a.confidencePercent);
}

const mockBlueprintRooms: DetectedBlueprintRoom[] = [
  {
    id: "mock-detected-living-room",
    name: "Living Room",
    squareFeet: 320,
    floorLevel: "1",
    windowsCount: "4",
    exteriorWallsCount: "2",
    confirmed: false,
    confidencePercent: 91,
    workflowStatus: "needs-review",
    overlay: { leftPercent: 12, topPercent: 16, widthPercent: 30, heightPercent: 28 },
  },
  {
    id: "mock-detected-kitchen",
    name: "Kitchen",
    squareFeet: 180,
    floorLevel: "1",
    windowsCount: "2",
    exteriorWallsCount: "2",
    confirmed: false,
    confidencePercent: 86,
    workflowStatus: "needs-review",
    overlay: { leftPercent: 48, topPercent: 18, widthPercent: 22, heightPercent: 22 },
  },
  {
    id: "mock-detected-bedroom",
    name: "Bedroom",
    squareFeet: 160,
    floorLevel: "2",
    windowsCount: "2",
    exteriorWallsCount: "2",
    confirmed: false,
    confidencePercent: 82,
    workflowStatus: "needs-review",
    overlay: { leftPercent: 18, topPercent: 55, widthPercent: 24, heightPercent: 24 },
  },
  {
    id: "mock-detected-bathroom",
    name: "Bathroom",
    squareFeet: 70,
    floorLevel: "2",
    windowsCount: "1",
    exteriorWallsCount: "1",
    confirmed: false,
    confidencePercent: 74,
    workflowStatus: "needs-review",
    overlay: { leftPercent: 54, topPercent: 56, widthPercent: 16, heightPercent: 18 },
  },
];

export function detectRoomsFromBlueprint(file?: Pick<File, "name"> | null): DetectedBlueprintRoom[] {
  // Placeholder parser foundation only. Real AI/PDF/image parsing will plug in here later.
  return stabilizeDetectedRoomCandidates(
    mockBlueprintRooms.map((room) => ({
      ...room,
      id: file ? `${room.id}-${file.name}` : room.id,
    }))
  );
}
