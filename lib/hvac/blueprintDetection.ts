export type DetectedRoomWorkflowStatus = "needs-review" | "confirmed" | "sent-to-manual-d";

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
  return mockBlueprintRooms.map((room) => ({
    ...room,
    id: file ? `${room.id}-${file.name}` : room.id,
  }));
}
