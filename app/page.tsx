"use client";

import { useState } from "react";
import Image from "next/image";
import { Bell, BookOpen, Briefcase, Calculator, Cpu, Crown, DollarSign, FileText, Home, Layers, Mail, Percent, PlusCircle, Settings, Shield, Thermometer, TrendingUp, Users, Zap } from "lucide-react";
import CustomerProposal from "./components/CustomerProposal";
import LoadCalculator from "./components/LoadCalculator";
import {
  calculateAvailableStaticPressure,
  calculateFrictionRate,
  calculateResidentialAirflow,
  calculateTotalEquivalentLength,
  getFrictionRateStatus,
  recommendRoundDuctSize,
} from "@/lib/hvac/manualD";

const oregonZipMultiplierMap: Record<string, number> = {
  970: 1.06,
  971: 1.05,
  972: 1.08,
  973: 1.07,
  974: 1.09,
  975: 1.10,
  976: 1.12,
  977: 1.08,
  978: 1.09,
  979: 1.10,
};

type ActiveScreen =
  | "dashboard"
  | "load"
  | "proposal"
  | "tech"
  | "manuals"
  | "pricing"
  | "customers";

type Room = {
  name: string;
  squareFeet: number;
};

const sidebarItems: { label: string; icon: string; screen: ActiveScreen }[] = [
  { label: "Dashboard", icon: "Dashboard", screen: "dashboard" },
  { label: "Proposals", icon: "Proposals", screen: "proposal" },
  { label: "Load Calculator", icon: "Load Calculator", screen: "load" },
  { label: "Tech Hub", icon: "Tech Hub", screen: "tech" },
  { label: "Manuals", icon: "Manuals", screen: "manuals" },
  { label: "Pricing Options", icon: "Pricing Options", screen: "pricing" },
  { label: "Customers", icon: "Customers", screen: "customers" },
];

const quickActions: { title: string; description: string; icon: string; screen: ActiveScreen }[] = [
  { title: "New Proposal", description: "Build a tailored contract", icon: "New Proposal", screen: "proposal" },
  { title: "Load Calculator", description: "Run Manual J estimates", icon: "Load Calculator", screen: "load" },
  { title: "Tech Hub", description: "Field tools and notes", icon: "Tech Hub", screen: "tech" },
  { title: "Manuals", description: "Specs & installation guides", icon: "Manuals", screen: "manuals" },
  { title: "Pricing Options", description: "Compare tiered offers", icon: "Pricing Options", screen: "pricing" },
  { title: "Customers", description: "Access customer profiles", icon: "Customers", screen: "customers" },
];

const pandaLogoSrc = "/logos/panda-load-studio-logo.png";

const getOregonZipMultiplier = (zip: string) => {
  const prefix = zip.trim().slice(0, 3);
  if (/^97\d{3}$/.test(zip.trim())) {
    return oregonZipMultiplierMap[prefix] ?? 1.08;
  }

  return 1.08;
};

const PandaLogoImage = ({ size }: { size: "large" | "small" }) => (
  <Image
    src={pandaLogoSrc}
    alt="Panda Load Studio"
    fill
    sizes={size === "large" ? "120px" : "40px"}
    className="panda-brand-logo-img"
    style={size === "large" ? sidebarLogoImageStyle : technicianLogoImageStyle}
    priority={size === "large"}
    unoptimized
  />
);

const IconSvg = ({ name }: { name: string }) => {
  const common = { size: 18, strokeWidth: 1.8 };

  switch (name) {
    case "Dashboard":
      return <Home {...common} />;
    case "Proposals":
      return <FileText {...common} />;
    case "Jobs":
      return <Briefcase {...common} />;
    case "Load Calculator":
      return <Calculator {...common} />;
    case "Tech Hub":
      return <Cpu {...common} />;
    case "Manuals":
      return <BookOpen {...common} />;
    case "Pricing Options":
      return <Percent {...common} />;
    case "Customers":
      return <Users {...common} />;
    case "Settings":
      return <Settings {...common} />;
    case "PandaLogo":
      return (
        <span style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: "100%", height: "100%", color: "#f8fafc", fontWeight: 900 }}>
          P
        </span>
      );
    case "Crown":
      return <Crown {...common} />;
    case "Active Jobs":
      return <Layers {...common} />;
    case "ProposalsMetric":
      return <FileText {...common} />;
    case "AvgJobValue":
      return <DollarSign {...common} />;
    case "CloseRate":
      return <TrendingUp {...common} />;
    case "New Proposal":
      return <PlusCircle {...common} />;
    case "Bell":
      return <Bell {...common} />;
    default:
      return <Shield {...common} />;
  }
};

export default function HVACAppPage() {
  // STATES
  const [squareFeet, setSquareFeet] = useState(2200);
  const [ceilingHeight, setCeilingHeight] = useState(8);
  const [homeType, setHomeType] = useState("modern");
  const [zipCode, setZipCode] = useState("97201");
  const [activeScreen, setActiveScreen] = useState<ActiveScreen>("dashboard");

  const [rooms, setRooms] = useState<Room[]>([
    { name: "Living Room", squareFeet: 420 },
    { name: "Kitchen", squareFeet: 220 },
  ]);

  // ROOM FUNCTIONS
  function updateRoom(index: number, field: keyof Room, value: string | number) {
    setRooms((current) =>
      current.map((room, i) =>
        i === index ? { ...room, [field]: value } : room
      )
    );
  }

  function addRoom() {
    setRooms((current) => [
      ...current,
      {
        name: `Room ${current.length + 1}`,
        squareFeet: 150,
      },
    ]);
  }

  // 🔥 SMART SIZING LOGIC
  let btuPerSqFt = 16;

  if (homeType === "new") btuPerSqFt = 10;
  if (homeType === "modern") btuPerSqFt = 16;
  if (homeType === "old") btuPerSqFt = 24;

  const coolingBtu = squareFeet * btuPerSqFt;
  const baseTons = coolingBtu / 12000;

const tonsLow = Math.round((baseTons * 0.9) * 10) / 10;
const tonsHigh = Math.round((baseTons * 1.1) * 10) / 10;

const tons = Math.round(baseTons * 10) / 10;
  // UI
  const [equipmentCost, setEquipmentCost] = useState(4200);
const [laborHours, setLaborHours] = useState(36);
const [laborRate, setLaborRate] = useState(125);
const [ductworkCost, setDuctworkCost] = useState(1800);
const [difficulty, setDifficulty] = useState(1.15);
const [profitMargin, setProfitMargin] = useState(0.35);

const systemSizeFactor = tons;

const realEquipmentCost = systemSizeFactor * 2800;
const realLaborCost = systemSizeFactor * 1800;
const realDuctworkCost = homeType === "full" ? 2500 : 1200;
const regionMultiplier = getOregonZipMultiplier(zipCode);
const realSubtotal = realEquipmentCost + realLaborCost + realDuctworkCost;
const adjustedTotal = realSubtotal * difficulty * regionMultiplier;
const premiumPrice = adjustedTotal * (1 + profitMargin);
const basicPrice = premiumPrice * 0.9;
const elitePrice = premiumPrice * 1.22;
const finalPrice = premiumPrice;

// keep these for display
const laborCost = realLaborCost;
const equipmentDisplayCost = realEquipmentCost;

const formatMoney = (value: number) =>
  value.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  });

const totalSystemCfm = calculateResidentialAirflow(tons);
const mainDuctRecommendation = recommendRoundDuctSize(totalSystemCfm, "main");
const returnDuctRecommendation = recommendRoundDuctSize(totalSystemCfm, "main");
const totalHomeSquareFeet = Math.max(1, squareFeet);
const averageBranchCfm = rooms.length > 0 ? totalSystemCfm / rooms.length : 0;
const averageBranchRecommendation = recommendRoundDuctSize(averageBranchCfm, "branch");
const availableStaticPressure = calculateAvailableStaticPressure(0.5, [0.2, 0.2]);
const totalEquivalentLengthFeet = calculateTotalEquivalentLength(100);
const frictionRate = calculateFrictionRate(availableStaticPressure, totalEquivalentLengthFeet);
const frictionRateStatus = getFrictionRateStatus(frictionRate);
const cfmPerTon = tons > 0 ? totalSystemCfm / tons : 0;
const longestDuctRunFeet = totalEquivalentLengthFeet;
const supplyBranchesCount = rooms.length;
const returnBranchesCount = 1;
const airflowStatus =
  cfmPerTon < 350
    ? {
        status: "low",
        message: "System airflow is below the typical 350-450 CFM per ton comfort range.",
      }
    : cfmPerTon > 450
    ? {
        status: "high",
        message: "System airflow is above the typical 350-450 CFM per ton comfort range.",
      }
    : {
        status: "acceptable",
        message: "System airflow is within the typical 350-450 CFM per ton comfort range.",
      };
const roomDuctRecommendations = rooms.map((room) => {
  const roomSquareFeet = Math.max(0, room.squareFeet);
  const roomCfm = (roomSquareFeet / totalHomeSquareFeet) * totalSystemCfm;
  const ductRecommendation = recommendRoundDuctSize(roomCfm, "branch");

  return {
    room,
    roomCfm,
    ductRecommendation,
  };
});

const handlePrintManualDReport = () => {
  window.print();
};

  return (
    <div className="panda-app-shell" style={appGridStyle}>
      <aside className="panda-sidebar" style={sidebarStyle}>
        <div style={sidebarBrandStyle}>
          <div className="panda-brand-logo" style={sidebarLogoStyle}>
            <PandaLogoImage size="large" />
          </div>
          <div>
            <p style={sidebarNameStyle}>Panda Load Studio</p>
            <p style={sidebarSubtitleStyle}>Professional HVAC Design & Calculation Platform</p>
          </div>
        </div>

        <nav className="panda-sidebar-nav" style={navStyle}>
          {sidebarItems.map((item) => {
            const isActive = activeScreen === item.screen;
            return (
              <button
                key={item.label}
                type="button"
                className="sidebar-nav-item"
                title={item.label}
                onClick={() => setActiveScreen(item.screen)}
                style={{
                  ...navItemStyle,
                  background: isActive ? 'linear-gradient(90deg, rgba(212,175,55,0.07), rgba(212,175,55,0.025))' : 'transparent',
                  boxShadow: isActive ? 'inset 0 1px 0 rgba(255,255,255,0.035), 0 8px 18px rgba(0,0,0,0.14)' : 'none',
                  color: isActive ? '#f8fafc' : '#cbd5e1',
                }}
              >
                <span className="nav-icon" style={navIconStyle}>
                  <IconSvg name={item.icon} />
                </span>
                {item.label}
              </button>
            );
          })}
        </nav>

        <div style={sidebarFooterStyle}>
          <div style={technicianProfileStyle}>
            <div className="panda-brand-logo-small" style={technicianAvatarStyle}>
              <PandaLogoImage size="small" />
            </div>
            <div>
              <p style={technicianNameStyle}>John Doe</p>
              <p style={technicianRoleStyle}>Technician</p>
            </div>
          </div>
          <div style={footerStatusStyle}>
            <span style={syncDotStyle}></span>
            Live Sync
          </div>
          <div style={footerSyncStyle}>All synced</div>
          <div style={footerVersionStyle}>v1.0.0</div>
        </div>
      </aside>

      <style dangerouslySetInnerHTML={{
        __html: `
          html,
          body {
            overflow-x: hidden;
          }

          .panda-app-shell,
          .panda-app-main,
          .panda-dashboard-grid,
          .panda-metric-grid,
          .panda-bottom-banner,
          .panda-proposal-header,
          .panda-proposal-shell,
          .manual-d-report-table {
            min-width: 0;
          }

          .manual-d-print-only-report {
            display: none;
          }

          .sidebar-nav-item:hover {
            transform: translateY(-1px);
            background: rgba(12,18,32,0.74);
            border-color: rgba(212,175,55,0.095);
            color: #f8fafc;
            box-shadow: 0 8px 18px rgba(0,0,0,0.15);
          }
          .sidebar-nav-item:hover .nav-icon {
            background: rgba(212,175,55,0.065);
          }
        
          .quick-action-button:hover {
            transform: translateY(-2px);
            background: rgba(10,16,29,0.9);
            border-color: rgba(212,175,55,0.14);
            box-shadow: 0 18px 36px rgba(0,0,0,0.26);
          }
          .quick-action-button:hover .action-icon-el {
            background: linear-gradient(145deg, rgba(212,175,55,0.15), rgba(8,13,24,0.78)) !important;
            transform: scale(1.03);
            box-shadow: inset 0 1px 0 rgba(255,255,255,0.07), 0 12px 24px rgba(0,0,0,0.22) !important;
          }

          @media (hover: none), (pointer: coarse) {
            .sidebar-nav-item:hover,
            .quick-action-button:hover {
              transform: none !important;
            }

            .quick-action-button:hover .action-icon-el {
              transform: none !important;
            }
          }

          @media (max-width: 1024px) {
            .panda-app-shell {
              grid-template-columns: 1fr !important;
              padding: 14px !important;
              gap: 14px !important;
              width: 100% !important;
              max-width: 100% !important;
            }

            .panda-sidebar {
              min-height: auto !important;
              border-radius: 26px !important;
              padding: 14px !important;
              gap: 14px !important;
              position: relative !important;
              z-index: 1 !important;
              backdrop-filter: none !important;
              -webkit-backdrop-filter: none !important;
            }

            .panda-sidebar-nav {
              display: flex !important;
              gap: 10px !important;
              overflow-x: auto !important;
              padding-bottom: 4px !important;
              scrollbar-width: none;
              -webkit-overflow-scrolling: touch;
              position: relative !important;
              z-index: 1 !important;
            }

            .panda-sidebar-nav::-webkit-scrollbar {
              display: none;
            }

            .sidebar-nav-item {
              flex: 0 0 auto !important;
              min-height: 44px !important;
              white-space: nowrap !important;
              padding: 10px 12px !important;
              pointer-events: auto !important;
              position: relative !important;
              z-index: 2 !important;
            }

            .panda-app-main {
              width: 100% !important;
              position: relative !important;
              z-index: 5 !important;
              pointer-events: auto !important;
            }

            .panda-metric-grid,
            .panda-dashboard-grid,
            .panda-bottom-banner,
            .manual-d-calculated-grid,
            .panda-room-duct-grid {
              grid-template-columns: 1fr !important;
            }

            .panda-quick-actions-grid {
              grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
            }
          }

          @media (max-width: 640px) {
            .panda-app-shell {
              padding: 10px !important;
              gap: 12px !important;
            }

            .panda-brand-logo {
              width: 148px !important;
              height: 148px !important;
              border-radius: 0 !important;
            }

            .panda-brand-logo-img {
              padding: 0 !important;
            }

            .panda-sidebar {
              border-radius: 22px !important;
            }

            .panda-sidebar > div:last-child {
              display: none !important;
            }

            .panda-main-header,
            .panda-proposal-header {
              display: grid !important;
              grid-template-columns: 1fr !important;
              gap: 14px !important;
              padding: 18px !important;
            }

            .panda-proposal-actions {
              width: 100% !important;
              display: grid !important;
              grid-template-columns: 1fr 1fr !important;
            }

            .panda-main-header h1 {
              font-size: 30px !important;
              letter-spacing: 0 !important;
            }

            .panda-quick-actions-grid,
            .panda-mini-options-grid {
              grid-template-columns: 1fr !important;
            }

            .quick-action-button {
              min-height: 72px !important;
              padding: 14px !important;
            }

            .panda-bottom-banner {
              padding: 18px !important;
              border-radius: 24px !important;
            }

            .panda-proposal-shell {
              border-radius: 24px !important;
              overflow-x: hidden !important;
            }

            button,
            input,
            select,
            textarea {
              min-height: 44px;
              pointer-events: auto !important;
              position: relative !important;
              z-index: 10 !important;
              touch-action: manipulation !important;
              -webkit-tap-highlight-color: rgba(212,175,55,0.22);
            }
          }

          @media print {
            body {
              background: #ffffff !important;
            }

            .panda-app-shell {
              display: block !important;
              max-width: none !important;
              min-height: auto !important;
              padding: 0 !important;
              color: #111827 !important;
              background: #ffffff !important;
            }

            .panda-sidebar,
            .panda-app-main,
            .panda-main-header,
            .panda-metric-grid,
            .panda-bottom-banner,
            .panda-proposal-header,
            .panda-room-duct-grid,
            .manual-d-print-report,
            .manual-d-report-actions {
              display: none !important;
            }

            .manual-d-print-only-report {
              display: block !important;
              color: #111827 !important;
              background: #ffffff !important;
            }

            .manual-d-print-summary-grid {
              display: grid !important;
              grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
            }

            .manual-d-print-only-card {
              border: 1px solid #d1d5db !important;
              box-shadow: none !important;
              background: #ffffff !important;
            }

            .manual-d-print-only-table {
              width: 100% !important;
              border-collapse: collapse !important;
              color: #111827 !important;
              font-size: 10.5px !important;
            }

            .manual-d-print-only-table th,
            .manual-d-print-only-table td {
              border-bottom: 1px solid #d1d5db !important;
              color: #111827 !important;
              background: #ffffff !important;
              vertical-align: top !important;
            }

            .manual-d-print-only-table th {
              border-top: 1px solid #111827 !important;
              border-bottom: 2px solid #111827 !important;
            }

            button,
            input,
            textarea,
            select {
              display: none !important;
            }

            @page {
              margin: 0.55in;
            }
          }
        `
      }} />

      <section className="manual-d-print-only-report" style={manualDPrintOnlyReportStyle}>
        <div style={manualDPrintHeaderStyle}>
          <div>
            <p style={manualDPrintBrandStyle}>Panda Heating & Cooling</p>
            <h1 style={manualDPrintTitleStyle}>Manual D Room Airflow Report</h1>
          </div>
          <div style={manualDPrintBadgeStyle}>Residential Branch Duct Sizing</div>
        </div>

        <div className="manual-d-print-summary-grid" style={manualDPrintSummaryGridStyle}>
          <div className="manual-d-print-only-card" style={manualDPrintSummaryCardStyle}>
            <p style={manualDPrintLabelStyle}>Customer</p>
            <p style={manualDPrintValueStyle}>Hernandez Family</p>
            <p style={manualDPrintMutedStyle}>Proposal #P-1074</p>
          </div>
          <div className="manual-d-print-only-card" style={manualDPrintSummaryCardStyle}>
            <p style={manualDPrintLabelStyle}>Project</p>
            <p style={manualDPrintValueStyle}>{squareFeet.toLocaleString()} sq ft home</p>
            <p style={manualDPrintMutedStyle}>Oregon ZIP {zipCode}</p>
          </div>
          <div className="manual-d-print-only-card" style={manualDPrintSummaryCardStyle}>
            <p style={manualDPrintLabelStyle}>System Size</p>
            <p style={manualDPrintValueStyle}>{tons} tons</p>
            <p style={manualDPrintMutedStyle}>Estimated cooling load: {Math.round(coolingBtu).toLocaleString()} BTU/h</p>
          </div>
          <div className="manual-d-print-only-card" style={manualDPrintSummaryCardStyle}>
            <p style={manualDPrintLabelStyle}>Total System Airflow</p>
            <p style={manualDPrintValueStyle}>{Math.round(totalSystemCfm).toLocaleString()} CFM</p>
            <p style={manualDPrintMutedStyle}>Based on 400 CFM per ton</p>
          </div>
          <div className="manual-d-print-only-card" style={manualDPrintSummaryCardStyle}>
            <p style={manualDPrintLabelStyle}>Main Trunk Duct</p>
            <p style={manualDPrintValueStyle}>{mainDuctRecommendation.diameterInches}&quot; round</p>
            <p style={manualDPrintMutedStyle}>
              {Math.round(mainDuctRecommendation.velocityFpm).toLocaleString()} FPM - {mainDuctRecommendation.status}
            </p>
          </div>
          <div className="manual-d-print-only-card" style={manualDPrintSummaryCardStyle}>
            <p style={manualDPrintLabelStyle}>Available Static Pressure</p>
            <p style={manualDPrintValueStyle}>{availableStaticPressure.toFixed(2)} in. w.c.</p>
            <p style={manualDPrintMutedStyle}>After estimated component pressure drops</p>
          </div>
          <div className="manual-d-print-only-card" style={manualDPrintSummaryCardStyle}>
            <p style={manualDPrintLabelStyle}>Longest Duct Run</p>
            <p style={manualDPrintValueStyle}>{Math.round(longestDuctRunFeet).toLocaleString()} ft</p>
            <p style={manualDPrintMutedStyle}>Total equivalent length basis</p>
          </div>
          <div className="manual-d-print-only-card" style={manualDPrintSummaryCardStyle}>
            <p style={manualDPrintLabelStyle}>Supply Branches</p>
            <p style={manualDPrintValueStyle}>{supplyBranchesCount.toLocaleString()}</p>
            <p style={manualDPrintMutedStyle}>Room branch count</p>
          </div>
          <div className="manual-d-print-only-card" style={manualDPrintSummaryCardStyle}>
            <p style={manualDPrintLabelStyle}>Return Branches</p>
            <p style={manualDPrintValueStyle}>{returnBranchesCount.toLocaleString()}</p>
            <p style={manualDPrintMutedStyle}>First-pass return branch count</p>
          </div>
          <div className="manual-d-print-only-card" style={manualDPrintSummaryCardStyle}>
            <p style={manualDPrintLabelStyle}>Friction Rate</p>
            <p style={manualDPrintValueStyle}>{frictionRate.toFixed(2)} in. w.c. / 100 ft</p>
            <p style={manualDPrintMutedStyle}>{frictionRateStatus.status}</p>
          </div>
          <div className="manual-d-print-only-card" style={manualDPrintSummaryCardStyle}>
            <p style={manualDPrintLabelStyle}>Return Duct</p>
            <p style={manualDPrintValueStyle}>{returnDuctRecommendation.diameterInches}&quot; round</p>
            <p style={manualDPrintMutedStyle}>
              {Math.round(returnDuctRecommendation.velocityFpm).toLocaleString()} FPM - {returnDuctRecommendation.status}
            </p>
          </div>
          <div className="manual-d-print-only-card" style={manualDPrintSummaryCardStyle}>
            <p style={manualDPrintLabelStyle}>Branch Duct</p>
            <p style={manualDPrintValueStyle}>{averageBranchRecommendation.diameterInches}&quot; round</p>
            <p style={manualDPrintMutedStyle}>
              {Math.round(averageBranchCfm).toLocaleString()} CFM average branch
            </p>
          </div>
        </div>

        <div style={manualDPrintWarningsStyle}>
          {[mainDuctRecommendation, returnDuctRecommendation, averageBranchRecommendation].map(
            (recommendation, index) => (
              <p key={`manual-d-print-warning-${index}`} style={manualDPrintWarningStyle}>
                {recommendation.status.toUpperCase()}: {recommendation.message}
              </p>
            )
          )}
          <p style={manualDPrintWarningStyle}>
            {airflowStatus.status.toUpperCase()}: {airflowStatus.message}
          </p>
        </div>

        <table className="manual-d-print-only-table" style={manualDPrintTableStyle}>
          <thead>
            <tr>
              <th style={manualDPrintTableHeaderStyle}>Room</th>
              <th style={manualDPrintTableHeaderStyle}>Sq Ft</th>
              <th style={manualDPrintTableHeaderStyle}>Room CFM</th>
              <th style={manualDPrintTableHeaderStyle}>Recommended Duct</th>
              <th style={manualDPrintTableHeaderStyle}>Velocity</th>
              <th style={manualDPrintTableHeaderStyle}>Status</th>
              <th style={manualDPrintTableHeaderStyle}>Status Message</th>
            </tr>
          </thead>
          <tbody>
            {roomDuctRecommendations.map(({ room, roomCfm, ductRecommendation }, index) => (
              <tr key={`manual-d-print-${room.name}-${index}`}>
                <td style={manualDPrintTableCellStyle}>{room.name}</td>
                <td style={manualDPrintTableCellStyle}>{room.squareFeet.toLocaleString()}</td>
                <td style={manualDPrintTableCellStyle}>{Math.round(roomCfm).toLocaleString()} CFM</td>
                <td style={manualDPrintTableCellStyle}>{ductRecommendation.diameterInches}&quot; round</td>
                <td style={manualDPrintTableCellStyle}>
                  {Math.round(ductRecommendation.velocityFpm).toLocaleString()} FPM
                </td>
                <td style={manualDPrintTableCellStyle}>{ductRecommendation.status}</td>
                <td style={manualDPrintMessageCellStyle}>{ductRecommendation.message}</td>
              </tr>
            ))}
          </tbody>
        </table>

      </section>

      <main className="panda-app-main" style={mainStyle}>
        <header className="panda-main-header" style={mainHeaderStyle}>
          <div>
            <p style={welcomeStyle}>Welcome back,</p>
            <h1 style={mainTitleStyle}>Panda Load Studio</h1>
            <p style={mainSubtitleStyle}>Professional HVAC Design & Calculation Platform</p>
            <div style={zipRowStyle}>
              <label style={zipLabelStyle}>Oregon ZIP</label>
              <input
                type="text"
                style={zipInputStyle}
                value={zipCode}
                maxLength={5}
                onChange={(e) => setZipCode(e.target.value.replace(/[^0-9]/g, ""))}
              />
              <span style={zipBadgeStyle}>
                {zipCode.match(/^97\d{3}$/)
                  ? `OR local rate ${regionMultiplier.toFixed(2)}x`
                  : `Oregon default 1.08x`}
              </span>
            </div>
          </div>
          <button type="button" style={bellStyle}>
            <IconSvg name="Bell" />
            <span style={notificationDotStyle}>2</span>
          </button>
        </header>

        {activeScreen === "dashboard" && (
          <>
            <div className="panda-metric-grid" style={metricGridStyle}>
              {[
                { icon: 'Active Jobs', label: 'Active Jobs', value: '14' },
                { icon: 'ProposalsMetric', label: 'Proposals', value: '9' },
                { icon: 'AvgJobValue', label: 'Avg. Job Value', value: '$52,400' },
                { icon: 'CloseRate', label: 'Close Rate', value: '89%' },
              ].map((card) => (
                <div key={card.label} style={metricCardStyle}>
                  <div style={metricIconStyle}>
                    <IconSvg name={card.icon} />
                  </div>
                  <p style={metricLabelStyle}>{card.label}</p>
                  <p style={metricValueStyle}>{card.value}</p>
                </div>
              ))}
            </div>

            <div className="panda-dashboard-grid" style={dashboardGridStyle}>
              <section style={sectionCardStyle}>
                <div style={sectionHeadingStyle}>Recent Jobs</div>
                <div style={recentJobsStyle}>
                  {[
                    {
                      title: 'Hernandez Residence',
                      subtitle: '2107 Seacliff Ave, Salem, OR',
                      meta: '2.5 Ton Heat Pump • 3 Bed',
                      status: 'Install Scheduled',
                    },
                    {
                      title: 'Evergreen Townhome',
                      subtitle: '1188 Maple St, Eugene, OR',
                      meta: '3 Ton AC • Duct Retrofit',
                      status: 'Proposal Sent',
                    },
                    {
                      title: 'Willamette Ranch',
                      subtitle: '4427 River Rd, Corvallis, OR',
                      meta: '4 Ton Heat Pump • Manual J',
                      status: 'Follow Up',
                    },
                    {
                      title: 'Cascade Condo',
                      subtitle: '330 W 5th St, Portland, OR',
                      meta: '2 Ton Mini-Split • Design',
                      status: 'In Review',
                    },
                  ].map((job) => (
                    <div key={job.title} style={jobCardStyle}>
                      <div>
                        <p style={jobTitleStyle}>{job.title}</p>
                        <p style={jobSubtitleStyle}>{job.subtitle}</p>
                        <p style={jobMetaStyle}>{job.meta}</p>
                      </div>
                      <div style={{ ...jobStatusStyle, padding: '8px 12px', borderRadius: '999px', alignSelf: 'start' }}>{job.status}</div>
                    </div>
                  ))}
                </div>
              </section>

              <section style={sectionCardStyle}>
                <div style={sectionHeadingStyle}>Quick Actions</div>
                <div className="panda-quick-actions-grid" style={quickActionsButtonGridStyle}>
                  {quickActions.map((action) => (
                    <button
                      key={action.title}
                      type="button"
                      className="quick-action-button"
                      style={quickActionButtonStyle}
                      onClick={() => setActiveScreen(action.screen)}
                    >
                      <div className="action-icon-el" style={{ ...actionIconStyle, pointerEvents: "none" }}>
                        <IconSvg name={action.icon} />
                      </div>
                      <div style={{ pointerEvents: "none" }}>
                        <p style={quickActionTitleStyle}>{action.title}</p>
                        <p style={quickActionDescStyle}>{action.description}</p>
                      </div>
                    </button>
                  ))}
                </div>
              </section>

              <section style={sectionCardStyle}>
                <div style={sectionHeadingStyle}>Proposal Preview</div>
                <div style={miniProposalStyle}>
                  <div style={miniCustomerInfoStyle}>
                    <p style={miniCustomerNameStyle}>Hernandez Family</p>
                    <p style={miniProposalNumberStyle}>Proposal #P-1074</p>
                    <p style={miniHomeTypeStyle}>Modern Ranch • 2,200 sq ft</p>
                  </div>
                  <div className="panda-mini-options-grid" style={miniOptionsGridStyle}>
                    {[
                      { name: 'Basic Comfort', price: basicPrice, tier: 'GOOD' },
                      { name: 'Better Comfort', price: premiumPrice, tier: 'BETTER' },
                      { name: 'Elite Comfort', price: elitePrice, tier: 'ELITE' },
                    ].map((option) => (
                      <div key={option.name} style={miniOptionCardStyle}>
                        <p style={miniOptionTierStyle}>{option.tier}</p>
                        <h4 style={miniOptionTitleStyle}>{option.name}</h4>
                        <p style={miniOptionPriceStyle}>{formatMoney(option.price)}</p>
                      </div>
                    ))}
                  </div>
                  <button
                    type="button"
                    style={miniViewButtonStyle}
                    onClick={() => setActiveScreen("proposal")}
                  >
                    View Full Proposal
                  </button>
                </div>
              </section>

              <section className="manual-d-room-section" style={sectionCardStyle}>
                <div style={roomDuctHeaderStyle}>
                  <div>
                    <div style={sectionHeadingStyle}>Manual D Room Ducts</div>
                    <p style={roomDuctSubtextStyle}>
                      Branch sizing based on {Math.round(totalSystemCfm).toLocaleString()} CFM total airflow.
                    </p>
                  </div>
                  <button type="button" style={roomAddButtonStyle} onClick={addRoom}>
                    Add Room
                  </button>
                </div>

                <div style={mainDuctRecommendationStyle}>
                  <div style={mainDuctHeaderStyle}>
                    <div>
                      <p style={mainDuctEyebrowStyle}>Main Trunk</p>
                      <h3 style={mainDuctTitleStyle}>Recommended Main Round Duct</h3>
                    </div>
                    <div style={mainDuctSizeStyle}>{mainDuctRecommendation.diameterInches}&quot;</div>
                  </div>

                  <div style={mainDuctMetricsStyle}>
                    <div style={mainDuctMetricStyle}>
                      <span style={mainDuctMetricLabelStyle}>Total System CFM</span>
                      <strong style={mainDuctMetricValueStyle}>
                        {Math.round(totalSystemCfm).toLocaleString()} CFM
                      </strong>
                    </div>
                    <div style={mainDuctMetricStyle}>
                      <span style={mainDuctMetricLabelStyle}>Velocity</span>
                      <strong style={mainDuctMetricValueStyle}>
                        {Math.round(mainDuctRecommendation.velocityFpm).toLocaleString()} FPM
                      </strong>
                    </div>
                  </div>

                  <p
                    style={{
                      ...mainDuctMessageStyle,
                      borderColor:
                        mainDuctRecommendation.status === "high"
                          ? "rgba(248,113,113,0.32)"
                          : mainDuctRecommendation.status === "low"
                          ? "rgba(96,165,250,0.26)"
                          : "rgba(34,197,94,0.28)",
                      color:
                        mainDuctRecommendation.status === "high"
                          ? "#fecaca"
                          : mainDuctRecommendation.status === "low"
                          ? "#bfdbfe"
                          : "#bbf7d0",
                    }}
                  >
                    {mainDuctRecommendation.status.toUpperCase()}: {mainDuctRecommendation.message}
                  </p>
                </div>

                <div style={manualDCalculatedOutputsStyle}>
                  <div style={manualDCalculatedHeaderStyle}>
                    <div>
                      <p style={manualDCalculatedEyebrowStyle}>Calculated Outputs</p>
                      <h3 style={manualDCalculatedTitleStyle}>Manual D First-Pass Results</h3>
                    </div>
                    <span style={manualDCalculatedMetaStyle}>ASP {availableStaticPressure.toFixed(2)} in. w.c.</span>
                  </div>

                  <div className="manual-d-calculated-grid" style={manualDCalculatedGridStyle}>
                    <div style={manualDCalculatedItemStyle}>
                      <span style={manualDCalculatedLabelStyle}>Friction Rate</span>
                      <strong style={manualDCalculatedValueStyle}>
                        {frictionRate.toFixed(2)} in. w.c. / 100 ft
                      </strong>
                      <span style={manualDCalculatedNoteStyle}>{frictionRateStatus.message}</span>
                    </div>

                    <div style={manualDCalculatedItemStyle}>
                      <span style={manualDCalculatedLabelStyle}>Main Trunk</span>
                      <strong style={manualDCalculatedValueStyle}>
                        {mainDuctRecommendation.diameterInches}&quot; round
                      </strong>
                      <span style={manualDCalculatedNoteStyle}>
                        {Math.round(mainDuctRecommendation.velocityFpm).toLocaleString()} FPM
                      </span>
                    </div>

                    <div style={manualDCalculatedItemStyle}>
                      <span style={manualDCalculatedLabelStyle}>Return Trunk</span>
                      <strong style={manualDCalculatedValueStyle}>
                        {returnDuctRecommendation.diameterInches}&quot; round
                      </strong>
                      <span style={manualDCalculatedNoteStyle}>
                        {Math.round(returnDuctRecommendation.velocityFpm).toLocaleString()} FPM
                      </span>
                    </div>

                    <div style={manualDCalculatedItemStyle}>
                      <span style={manualDCalculatedLabelStyle}>Average Branch Airflow</span>
                      <strong style={manualDCalculatedValueStyle}>
                        {Math.round(averageBranchCfm).toLocaleString()} CFM
                      </strong>
                      <span style={manualDCalculatedNoteStyle}>
                        {averageBranchRecommendation.diameterInches}&quot; branch duct
                      </span>
                    </div>
                  </div>

                  <div style={manualDWarningGridStyle}>
                    {[mainDuctRecommendation, returnDuctRecommendation, averageBranchRecommendation].map(
                      (recommendation, index) => (
                        <p key={`${recommendation.diameterInches}-${index}`} style={manualDWarningStyle}>
                          {recommendation.status.toUpperCase()}: {recommendation.message}
                        </p>
                      )
                    )}
                    <p style={manualDWarningStyle}>
                      {airflowStatus.status.toUpperCase()}: {airflowStatus.message}
                    </p>
                  </div>

                  <button
                    type="button"
                    style={manualDPrintButtonStyle}
                    onClick={handlePrintManualDReport}
                  >
                    Print Manual D Report
                  </button>
                </div>

                <div className="panda-room-duct-grid" style={roomDuctGridStyle}>
                  {roomDuctRecommendations.map(({ room, roomCfm, ductRecommendation }, index) => (
                    <div key={`${room.name}-${index}`} style={roomDuctCardStyle}>
                      <div style={roomInputGridStyle}>
                        <input
                          type="text"
                          aria-label={`Room ${index + 1} name`}
                          value={room.name}
                          onChange={(e) => updateRoom(index, "name", e.target.value)}
                          style={roomInputStyle}
                        />
                        <input
                          type="number"
                          min="0"
                          aria-label={`${room.name} square feet`}
                          value={room.squareFeet}
                          onChange={(e) =>
                            updateRoom(index, "squareFeet", Number(e.target.value) || 0)
                          }
                          style={roomInputStyle}
                        />
                      </div>

                      <div style={roomDuctResultGridStyle}>
                        <div style={roomDuctMetricStyle}>
                          <span style={roomDuctLabelStyle}>Estimated CFM</span>
                          <strong style={roomDuctValueStyle}>{Math.round(roomCfm).toLocaleString()}</strong>
                        </div>
                        <div style={roomDuctMetricStyle}>
                          <span style={roomDuctLabelStyle}>Round Duct</span>
                          <strong style={roomDuctValueStyle}>{ductRecommendation.diameterInches}&quot;</strong>
                        </div>
                        <div style={roomDuctMetricStyle}>
                          <span style={roomDuctLabelStyle}>Velocity</span>
                          <strong style={roomDuctValueStyle}>
                            {Math.round(ductRecommendation.velocityFpm).toLocaleString()} FPM
                          </strong>
                        </div>
                      </div>

                      <p
                        style={{
                          ...roomDuctMessageStyle,
                          borderColor:
                            ductRecommendation.status === "high"
                              ? "rgba(248,113,113,0.32)"
                              : ductRecommendation.status === "low"
                              ? "rgba(96,165,250,0.26)"
                              : "rgba(34,197,94,0.28)",
                          color:
                            ductRecommendation.status === "high"
                              ? "#fecaca"
                              : ductRecommendation.status === "low"
                              ? "#bfdbfe"
                              : "#bbf7d0",
                        }}
                      >
                        {ductRecommendation.status.toUpperCase()}: {ductRecommendation.message}
                      </p>
                    </div>
                  ))}
                </div>

                <div style={manualDTestPanelStyle}>
                  <div style={manualDTestPanelHeaderStyle}>
                    <p style={manualDTestPanelEyebrowStyle}>Manual D Test Panel</p>
                    <strong style={manualDTestPanelTitleStyle}>
                      Total System: {Math.round(totalSystemCfm).toLocaleString()} CFM
                    </strong>
                  </div>

                  <div style={manualDTestSummaryStyle}>
                    <span style={manualDTestLabelStyle}>Main duct</span>
                    <strong style={manualDTestValueStyle}>
                      {mainDuctRecommendation.diameterInches}&quot; round
                    </strong>
                    <span style={manualDTestMetaStyle}>
                      {Math.round(mainDuctRecommendation.velocityFpm).toLocaleString()} FPM
                    </span>
                    <span style={manualDTestStatusStyle}>{mainDuctRecommendation.status}</span>
                  </div>

                  <div style={manualDTestRowsStyle}>
                    {roomDuctRecommendations.map(({ room, roomCfm, ductRecommendation }, index) => (
                      <div key={`manual-d-test-${room.name}-${index}`} style={manualDTestRowStyle}>
                        <span style={manualDTestRoomStyle}>{room.name}</span>
                        <span style={manualDTestMetaStyle}>
                          {Math.round(roomCfm).toLocaleString()} CFM
                        </span>
                        <strong style={manualDTestValueStyle}>
                          {ductRecommendation.diameterInches}&quot; round
                        </strong>
                        <span style={manualDTestMetaStyle}>
                          {Math.round(ductRecommendation.velocityFpm).toLocaleString()} FPM
                        </span>
                        <span style={manualDTestStatusStyle}>{ductRecommendation.status}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="manual-d-print-report" style={manualDReportStyle}>
                  <div style={manualDReportHeaderStyle}>
                    <div>
                      <p style={manualDReportEyebrowStyle}>Printable Report</p>
                      <h3 style={manualDReportTitleStyle}>Manual D Room Airflow</h3>
                    </div>
                    <div style={manualDReportMetaStyle}>
                      Total airflow: {Math.round(totalSystemCfm).toLocaleString()} CFM
                    </div>
                  </div>

                  <div style={manualDTableWrapperStyle}>
                    <table className="manual-d-report-table" style={manualDTableStyle}>
                      <thead>
                        <tr>
                          <th style={manualDTableHeaderStyle}>Room</th>
                          <th style={manualDTableHeaderStyle}>Sq Ft</th>
                          <th style={manualDTableHeaderStyle}>CFM</th>
                          <th style={manualDTableHeaderStyle}>Round Duct</th>
                          <th style={manualDTableHeaderStyle}>Velocity</th>
                          <th style={manualDTableHeaderStyle}>Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {roomDuctRecommendations.map(({ room, roomCfm, ductRecommendation }, index) => (
                          <tr key={`manual-d-report-${room.name}-${index}`}>
                            <td style={manualDTableCellStyle}>{room.name}</td>
                            <td style={manualDTableCellStyle}>{room.squareFeet.toLocaleString()}</td>
                            <td style={manualDTableCellStyle}>{Math.round(roomCfm).toLocaleString()}</td>
                            <td style={manualDTableCellStyle}>{ductRecommendation.diameterInches}&quot; round</td>
                            <td style={manualDTableCellStyle}>
                              {Math.round(ductRecommendation.velocityFpm).toLocaleString()} FPM
                            </td>
                            <td style={manualDTableCellStyle}>{ductRecommendation.status}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </section>
            </div>

            <div className="panda-bottom-banner" style={bottomBannerStyle}>
              <div style={bannerTextWrapperStyle}>
                <p style={bannerTagStyle}>Three Levels. One Goal.</p>
                <h2 style={bannerTitleStyle}>Good. Better. Best. Help your customer choose the right comfort for their home.</h2>
              </div>
              <div style={planBadgeGridStyle}>
                {[
                  { title: 'Basic Comfort', label: 'GOOD' },
                  { title: 'Better Comfort', label: 'BETTER' },
                  { title: 'Elite Comfort', label: 'ELITE' },
                ].map((plan) => (
                  <div key={plan.title} style={planBadgeStyle}>
                    <p style={planLabelStyle}>{plan.label}</p>
                    <p style={planTitleStyle}>{plan.title}</p>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}

        {activeScreen === "proposal" && (
          <>
            <div className="panda-proposal-header" style={proposalPageHeaderStyle}>
              <button type="button" style={backButtonStyle} onClick={() => setActiveScreen("dashboard")}>
                ← Back
              </button>
              <div style={proposalPageTitleStyle}>Proposal #P-1007</div>
              <div className="panda-proposal-actions" style={proposalPageActionsStyle}>
                <button type="button" style={iconButtonStyle}>
                  Edit
                </button>
                <button type="button" style={iconButtonStyle}>
                  Share
                </button>
              </div>
            </div>
            <div className="panda-proposal-shell" style={proposalShellStyle}>
              <CustomerProposal
                tons={tons}
                homeType={homeType}
                finalPrice={finalPrice}
                basicPrice={basicPrice}
                premiumPrice={premiumPrice}
                elitePrice={elitePrice}
                formatMoney={formatMoney}
              />
            </div>
          </>
        )}

        {activeScreen === "load" && (
          <LoadCalculator />
        )}

        {activeScreen !== "dashboard" && activeScreen !== "proposal" && activeScreen !== "load" && (
          <div style={sectionCardStyle}>
            <div style={sectionHeadingStyle}>Coming Soon</div>
            <p style={dashboardSummaryStyle}>This section is a placeholder for future content. Use Dashboard or Proposals to continue.</p>
          </div>
        )}
      </main>
    </div>
  );
}
/* STYLES */
const titleStyle: React.CSSProperties = {
  fontSize: "34px",
  fontWeight: 800,
  letterSpacing: "-1px",
  margin: 0,
};

const pageSubtitleStyle: React.CSSProperties = {
  margin: "8px 0 0",
  color: "#94a3b8",
  fontSize: "16px",
  maxWidth: "650px",
};


const roomCardStyle: React.CSSProperties = {
  background: "white",
  padding: "18px",
  borderRadius: "22px",
  display: "grid",
  gap: "12px",
  boxShadow: "0 18px 40px rgba(0,0,0,0.08)",
};
const resultsStyle: React.CSSProperties = {
  background: "#111",
  color: "white",
  padding: "24px",
  borderRadius: "26px",
  boxShadow: "0 22px 50px rgba(0,0,0,0.18)",
};

const buttonStyle: React.CSSProperties = {
  padding: "12px 16px",
  borderRadius: "14px",
  border: "1px solid #111",
  background: "#111",
  color: "white",
  cursor: "pointer",
  fontWeight: 800,
};

const containerStyle: React.CSSProperties = {
  padding: "40px 24px",
  display: "grid",
  gap: "24px",
  background: "linear-gradient(180deg, #05060d 0%, #111827 100%)",
  minHeight: "100vh",
  color: "#f8fafc",
  maxWidth: "1200px",
  margin: "0 auto",
};
const inputStyle: React.CSSProperties = {
  padding: "14px",
  borderRadius: "14px",
  border: "1px solid #d1d5db",
  background: "white",
  color: "#111",
  fontSize: "16px",
};
const mainButtonStyle: React.CSSProperties = {
  padding: "16px",
  borderRadius: "16px",
  border: "none",
  background: "#111",
  color: "white",
  fontSize: "18px",
  fontWeight: 600,
  cursor: "pointer",
  transition: "all 0.2s ease",
};
const cardStyle: React.CSSProperties = {
  background: "white",
  padding: "24px",
  borderRadius: "20px",
  boxShadow: "0 10px 30px rgba(0,0,0,0.08)",
};

const appGridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "204px minmax(0, 1fr)",
  gap: "18px",
  minHeight: "100vh",
  background:
    "radial-gradient(circle at 14% 0%, rgba(212,175,55,0.075), transparent 30%), radial-gradient(circle at 88% 8%, rgba(30,64,175,0.11), transparent 34%), linear-gradient(180deg, #02040a 0%, #06101d 46%, #03060d 100%)",
  padding: "18px",
  color: "#f8fafc",
  maxWidth: "1280px",
  margin: "0 auto",
};

const sidebarStyle: React.CSSProperties = {
  background:
    "radial-gradient(circle at 50% 4%, rgba(212,175,55,0.055), transparent 28%), linear-gradient(180deg, rgba(7,12,22,0.96) 0%, rgba(5,10,19,0.94) 52%, rgba(2,5,11,0.98) 100%)",
  border: "1px solid rgba(148,163,184,0.105)",
  backdropFilter: "blur(16px)",
  borderRadius: "28px",
  padding: "16px 14px 18px",
  display: "grid",
  gap: "14px",
  minHeight: "calc(100vh - 36px)",
  boxShadow: "0 34px 84px rgba(0,0,0,0.42), inset 0 1px 0 rgba(255,255,255,0.04)",
  alignContent: "start",
};

const sidebarBrandStyle: React.CSSProperties = {
  display: "grid",
  justifyItems: "center",
  textAlign: "center",
  gap: "15px",
  width: "100%",
  maxWidth: "100%",
  boxSizing: "border-box",
  overflow: "hidden",
  padding: "20px 8px 24px",
  border: "1px solid rgba(212,175,55,0.16)",
  borderBottom: "1px solid rgba(212,175,55,0.2)",
  borderRadius: "24px",
  background:
    "radial-gradient(circle at 50% 36%, rgba(212,175,55,0.24), rgba(212,175,55,0.09) 30%, rgba(30,64,175,0.08) 58%, transparent 84%), radial-gradient(circle at 50% 0%, rgba(255,255,255,0.06), transparent 36%), linear-gradient(180deg, rgba(5,10,19,0.98), rgba(1,4,10,0.99))",
  boxShadow: "inset 0 1px 0 rgba(255,255,255,0.08), inset 0 -24px 44px rgba(0,0,0,0.26), 0 30px 62px rgba(0,0,0,0.36), 0 0 34px rgba(212,175,55,0.07)",
  backdropFilter: "blur(12px)",
};

const sidebarLogoStyle: React.CSSProperties = {
  width: "168px",
  height: "168px",
  maxWidth: "100%",
  borderRadius: "0",
  background: "transparent",
  border: "none",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  fontSize: "26px",
  fontWeight: 800,
  boxShadow: "none",
  overflow: "visible",
  position: "relative",
};

const sidebarLogoImageStyle: React.CSSProperties = {
  width: "100%",
  height: "100%",
  objectFit: "contain",
  objectPosition: "center",
  padding: "0",
  display: "block",
  transform: "scale(1.72)",
  transformOrigin: "center",
  filter: "contrast(1.22) saturate(1.04) brightness(1.06) drop-shadow(0 22px 30px rgba(0,0,0,0.48))",
};

const sidebarNameStyle: React.CSSProperties = {
  margin: 0,
  fontWeight: 850,
  letterSpacing: "0.03em",
  fontSize: "16px",
  lineHeight: 1.18,
  color: "#d4af37",
  textShadow: "0 10px 24px rgba(0,0,0,0.34)",
  transition: "all 0.25s cubic-bezier(0.4, 0, 0.2, 1)",
};

const sidebarSubtitleStyle: React.CSSProperties = {
  margin: "9px 0 0",
  color: "#7f8da3",
  fontSize: "8.5px",
  fontWeight: 650,
  letterSpacing: "0.035em",
  lineHeight: 1.4,
};

const sidebarRoleStyle: React.CSSProperties = {
  margin: 0,
  color: "#94a3b8",
  fontSize: "13px",
};

const navStyle: React.CSSProperties = {
  display: "grid",
  gap: "8px",
};

const navItemStyle: React.CSSProperties = {
  padding: "8px 11px",
  borderRadius: "14px",
  display: "flex",
  alignItems: "center",
  justifyContent: "flex-start",
  fontWeight: 650,
  cursor: "pointer",
  fontSize: "14px",
  transition: "all 0.2s ease",
  border: "1px solid rgba(148,163,184,0.085)",
  background: "transparent",
  color: "#94a3b8",
  touchAction: "manipulation",
  WebkitTapHighlightColor: "transparent",
};

const navIconStyle: React.CSSProperties = {
  display: "inline-flex",
  width: "28px",
  height: "28px",
  alignItems: "center",
  justifyContent: "center",
  marginRight: "8px",
  borderRadius: "9px",
  background: "rgba(212,175,55,0.055)",
  color: "#d4af37",
  border: "1px solid rgba(212,175,55,0.09)",
  boxShadow: "inset 0 1px 0 rgba(255,255,255,0.045), 0 8px 16px rgba(0,0,0,0.14)",
  transition: "all 0.25s cubic-bezier(0.4, 0, 0.2, 1)",
};

const metricIconStyle: React.CSSProperties = {
  width: "46px",
  height: "46px",
  borderRadius: "13px",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  background: "linear-gradient(145deg, rgba(212,175,55,0.13), rgba(8,13,24,0.76))",
  color: "#d4af37",
  border: "1px solid rgba(212,175,55,0.13)",
  boxShadow: "inset 0 1px 0 rgba(255,255,255,0.055), 0 12px 24px rgba(0,0,0,0.18)",
  transition: "all 0.25s cubic-bezier(0.4, 0, 0.2, 1)",
  fontSize: "18px",
};

const sidebarFooterStyle: React.CSSProperties = {
  display: "grid",
  gap: "6px",
  paddingTop: "14px",
  borderTop: "1px solid rgba(148,163,184,0.08)",
};

const technicianProfileStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "8px",
  padding: "10px",
  background: "rgba(8,13,24,0.62)",
  borderRadius: "16px",
  border: "1px solid rgba(148,163,184,0.1)",
};

const technicianAvatarStyle: React.CSSProperties = {
  width: "28px",
  height: "28px",
  borderRadius: "50%",
  background: "linear-gradient(145deg, rgba(212,175,55,0.18), rgba(37,99,235,0.1))",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  color: "#d4af37",
  border: "1px solid rgba(212,175,55,0.22)",
  boxShadow: "0 8px 18px rgba(0,0,0,0.2), 0 0 12px rgba(212,175,55,0.1)",
  transition: "all 0.25s cubic-bezier(0.4, 0, 0.2, 1)",
  fontSize: "12px",
  fontWeight: 800,
  overflow: "hidden",
  position: "relative",
};

const technicianLogoImageStyle: React.CSSProperties = {
  width: "100%",
  height: "100%",
  objectFit: "contain",
  padding: "0",
  display: "block",
  transform: "scale(1.5)",
  filter: "contrast(1.12) saturate(1.02)",
};

const technicianNameStyle: React.CSSProperties = {
  margin: 0,
  fontWeight: 800,
  fontSize: "13px",
  color: "#f8fafc",
};

const technicianRoleStyle: React.CSSProperties = {
  margin: 0,
  color: "#94a3b8",
  fontSize: "11px",
};

const footerStatusStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "6px",
  color: "#94a3b8",
  fontSize: "11px",
  fontWeight: 700,
  letterSpacing: "0.1em",
};

const syncDotStyle: React.CSSProperties = {
  width: "6px",
  height: "6px",
  borderRadius: "50%",
  background: "#10b981",
  boxShadow: "0 0 6px rgba(16, 185, 129, 0.5)",
};

const footerSyncStyle: React.CSSProperties = {
  color: "#d4af37",
  border: "1px solid rgba(212,175,55,0.12)",
  boxShadow: "0 8px 18px rgba(0,0,0,0.14)",
  transition: "all 0.25s cubic-bezier(0.4, 0, 0.2, 1)",
  fontWeight: 800,
  fontSize: "11px",
};

const footerVersionStyle: React.CSSProperties = {
  color: "#64748b",
  fontSize: "11px",
};

const mainStyle: React.CSSProperties = {
  display: "grid",
  gap: "18px",
};

const proposalPageHeaderStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: "18px",
  padding: "24px 26px",
  background: "linear-gradient(180deg, rgba(8,14,26,0.98), rgba(5,10,19,0.95))",
  borderRadius: "24px 24px 0 0",
  border: "1px solid rgba(148,163,184,0.105)",
};

const backButtonStyle: React.CSSProperties = {
  padding: "12px 18px",
  borderRadius: "9999px",
  border: "1px solid rgba(212,175,55,0.24)",
  background: "rgba(255,255,255,0.06)",
  color: "#f8fafc",
  fontWeight: 700,
  cursor: "pointer",
};

const proposalPageTitleStyle: React.CSSProperties = {
  color: "#f8fafc",
  fontSize: "18px",
  fontWeight: 800,
};

const proposalPageActionsStyle: React.CSSProperties = {
  display: "flex",
  gap: "12px",
};

const iconButtonStyle: React.CSSProperties = {
  padding: "12px 18px",
  borderRadius: "9999px",
  border: "1px solid rgba(212,175,55,0.24)",
  background: "rgba(255,255,255,0.06)",
  color: "#f8fafc",
  cursor: "pointer",
  fontWeight: 700,
  transition: "all 0.2s ease",
};

const metricCardStyle: React.CSSProperties = {
  background: "linear-gradient(180deg, rgba(10,16,29,0.88), rgba(5,10,19,0.94))",
  border: "1px solid rgba(148,163,184,0.105)",
  borderRadius: "22px",
  padding: "18px",
  minHeight: "100px",
  boxShadow: "0 24px 56px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.04)",
  display: "grid",
  gap: "10px",
};

const metricLabelStyle: React.CSSProperties = {
  margin: 0,
  color: "#94a3b8",
  fontSize: "12px",
  fontWeight: 700,
  textTransform: "uppercase",
  letterSpacing: "0.12em",
};

const metricValueStyle: React.CSSProperties = {
  margin: "14px 0 0",
  fontSize: "26px",
  fontWeight: 800,
  color: "#f8fafc",
};

const sectionHeadingStyle: React.CSSProperties = {
  margin: 0,
  fontSize: "12px",
  fontWeight: 800,
  letterSpacing: "0.18em",
  color: "#d4af37",
  textTransform: "uppercase",
};

const jobCardStyle: React.CSSProperties = {
  display: "grid",
  gap: "6px",
  padding: "16px",
  borderRadius: "18px",
  background: "linear-gradient(180deg, rgba(8,14,26,0.88), rgba(5,10,19,0.9))",
  border: "1px solid rgba(148,163,184,0.095)",
};

const jobTitleStyle: React.CSSProperties = {
  margin: 0,
  fontWeight: 800,
};

const jobSubtitleStyle: React.CSSProperties = {
  margin: 0,
  color: "#94a3b8",
  fontSize: "13px",
};

const jobMetaStyle: React.CSSProperties = {
  margin: 0,
  color: "#94a3b8",
  fontSize: "13px",
};

const jobStatusStyle: React.CSSProperties = {
  marginTop: "8px",
  color: "#d4af37",
  border: "1px solid rgba(212,175,55,0.12)",
  boxShadow: "0 8px 18px rgba(0,0,0,0.14)",
  transition: "all 0.25s cubic-bezier(0.4, 0, 0.2, 1)",
  fontWeight: 800,
  fontSize: "12px",
};

const metricGridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
  gap: "10px",
};

const contentSplitStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "1.2fr 0.8fr",
  gap: "24px",
};

const dashboardGridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "1.4fr 1.15fr 0.85fr",
  gap: "14px",
  alignItems: "start",
};

const recentJobsStyle: React.CSSProperties = {
  display: "grid",
  gap: "10px",
  marginTop: "12px",
};

const quickActionsButtonGridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(2, minmax(220px, 1fr))",
  gap: "9px",
  marginTop: "12px",
};

const quickActionButtonStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "52px 1fr",
  gap: "12px",
  alignItems: "flex-start",
  width: "100%",
  minHeight: "100px",
  borderRadius: "16px",
  padding: "16px",
  border: "1px solid rgba(148,163,184,0.09)",
  background: "linear-gradient(180deg, rgba(8,14,26,0.72), rgba(5,10,19,0.78))",
  color: "#f8fafc",
  textAlign: "left",
  cursor: "pointer",
  transition: "all 0.25s cubic-bezier(0.4, 0, 0.2, 1)",
  touchAction: "manipulation",
  WebkitTapHighlightColor: "transparent",
};

const quickActionTitleStyle: React.CSSProperties = {
  margin: 0,
  fontSize: "15px",
  fontWeight: 800,
  color: "#f8fafc",
};

const quickActionDescStyle: React.CSSProperties = {
  margin: "4px 0 0",
  color: "#94a3b8",
  fontSize: "13px",
  lineHeight: 1.45,
};

const leftPanelStyle: React.CSSProperties = {
  display: "grid",
  gap: "24px",
};

const quickActionsStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
  gap: "14px",
};

const rightPanelStyle: React.CSSProperties = {
  display: "grid",
  gap: "20px",
};

const miniProposalStyle: React.CSSProperties = {
  display: "grid",
  gap: "16px",
};

const miniCustomerInfoStyle: React.CSSProperties = {
  display: "grid",
  gap: "4px",
};

const miniCustomerNameStyle: React.CSSProperties = {
  margin: 0,
  fontWeight: 800,
  fontSize: "18px",
  color: "#f8fafc",
};

const miniProposalNumberStyle: React.CSSProperties = {
  margin: 0,
  color: "#d4af37",
  border: "1px solid rgba(212,175,55,0.12)",
  boxShadow: "0 8px 18px rgba(0,0,0,0.14)",
  transition: "all 0.25s cubic-bezier(0.4, 0, 0.2, 1)",
  fontSize: "13px",
  fontWeight: 700,
};

const miniHomeTypeStyle: React.CSSProperties = {
  margin: 0,
  color: "#94a3b8",
  fontSize: "12px",
};

const miniOptionsGridStyle: React.CSSProperties = {
  display: "grid",
  gap: "10px",
};

const miniOptionCardStyle: React.CSSProperties = {
  background: "rgba(6,11,21,0.72)",
  border: "1px solid rgba(148,163,184,0.09)",
  borderRadius: "14px",
  padding: "12px",
  display: "grid",
  gap: "4px",
};

const miniOptionTierStyle: React.CSSProperties = {
  margin: 0,
  color: "#94a3b8",
  fontSize: "11px",
  fontWeight: 700,
  textTransform: "uppercase",
  letterSpacing: "0.1em",
};

const miniOptionTitleStyle: React.CSSProperties = {
  margin: 0,
  fontWeight: 800,
  fontSize: "14px",
  color: "#f8fafc",
};

const miniOptionPriceStyle: React.CSSProperties = {
  margin: 0,
  fontWeight: 800,
  fontSize: "18px",
  color: "#d4af37",
  border: "1px solid rgba(212,175,55,0.12)",
  boxShadow: "0 8px 18px rgba(0,0,0,0.14)",
  transition: "all 0.25s cubic-bezier(0.4, 0, 0.2, 1)",
};

const miniViewButtonStyle: React.CSSProperties = {
  padding: "10px 16px",
  borderRadius: "20px",
  background: "rgba(212,175,55,0.08)",
  color: "#d4af37",
  border: "1px solid rgba(212,175,55,0.18)",
  boxShadow: "0 12px 24px rgba(0,0,0,0.16)",
  fontWeight: 700,
  fontSize: "13px",
  cursor: "pointer",
  transition: "all 0.2s ease",
  touchAction: "manipulation",
  WebkitTapHighlightColor: "transparent",
};

const roomDuctHeaderStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "flex-start",
  justifyContent: "space-between",
  gap: "14px",
};

const roomDuctSubtextStyle: React.CSSProperties = {
  margin: "8px 0 0",
  color: "#94a3b8",
  fontSize: "13px",
  lineHeight: 1.5,
};

const roomAddButtonStyle: React.CSSProperties = {
  minHeight: "42px",
  padding: "10px 14px",
  borderRadius: "999px",
  border: "1px solid rgba(212,175,55,0.2)",
  background: "rgba(212,175,55,0.08)",
  color: "#d4af37",
  fontSize: "13px",
  fontWeight: 800,
  cursor: "pointer",
  whiteSpace: "nowrap",
  touchAction: "manipulation",
};

const mainDuctRecommendationStyle: React.CSSProperties = {
  display: "grid",
  gap: "12px",
  padding: "16px",
  borderRadius: "16px",
  background:
    "linear-gradient(135deg, rgba(212,175,55,0.12), rgba(15,23,42,0.82))",
  border: "1px solid rgba(212,175,55,0.2)",
  boxShadow: "inset 0 1px 0 rgba(255,255,255,0.05)",
};

const mainDuctHeaderStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "flex-start",
  justifyContent: "space-between",
  gap: "14px",
};

const mainDuctEyebrowStyle: React.CSSProperties = {
  margin: 0,
  color: "#d4af37",
  fontSize: "11px",
  fontWeight: 850,
  letterSpacing: "0.12em",
  textTransform: "uppercase",
};

const mainDuctTitleStyle: React.CSSProperties = {
  margin: "5px 0 0",
  color: "#f8fafc",
  fontSize: "18px",
  fontWeight: 850,
};

const mainDuctSizeStyle: React.CSSProperties = {
  color: "#f8fafc",
  fontSize: "34px",
  fontWeight: 950,
  lineHeight: 1,
};

const mainDuctMetricsStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
  gap: "8px",
};

const mainDuctMetricStyle: React.CSSProperties = {
  display: "grid",
  gap: "4px",
  padding: "10px",
  borderRadius: "12px",
  background: "rgba(2,6,23,0.42)",
  border: "1px solid rgba(148,163,184,0.08)",
};

const mainDuctMetricLabelStyle: React.CSSProperties = {
  color: "#cbd5e1",
  fontSize: "11px",
  fontWeight: 800,
  textTransform: "uppercase",
  letterSpacing: "0.08em",
};

const mainDuctMetricValueStyle: React.CSSProperties = {
  color: "#f8fafc",
  fontSize: "16px",
  lineHeight: 1.2,
};

const mainDuctMessageStyle: React.CSSProperties = {
  margin: 0,
  padding: "10px 12px",
  borderRadius: "12px",
  background: "rgba(15,23,42,0.58)",
  border: "1px solid rgba(148,163,184,0.12)",
  fontSize: "12px",
  fontWeight: 750,
  lineHeight: 1.5,
};

const manualDCalculatedOutputsStyle: React.CSSProperties = {
  display: "grid",
  gap: "14px",
  padding: "16px",
  borderRadius: "16px",
  background: "rgba(6,11,21,0.72)",
  border: "1px solid rgba(148,163,184,0.12)",
};

const manualDCalculatedHeaderStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "flex-start",
  justifyContent: "space-between",
  gap: "14px",
  flexWrap: "wrap",
};

const manualDCalculatedEyebrowStyle: React.CSSProperties = {
  margin: 0,
  color: "#d4af37",
  fontSize: "11px",
  fontWeight: 850,
  letterSpacing: "0.12em",
  textTransform: "uppercase",
};

const manualDCalculatedTitleStyle: React.CSSProperties = {
  margin: "5px 0 0",
  color: "#f8fafc",
  fontSize: "18px",
  fontWeight: 850,
};

const manualDCalculatedMetaStyle: React.CSSProperties = {
  color: "#cbd5e1",
  fontSize: "12px",
  fontWeight: 800,
};

const manualDCalculatedGridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
  gap: "10px",
};

const manualDCalculatedItemStyle: React.CSSProperties = {
  display: "grid",
  gap: "5px",
  padding: "12px",
  borderRadius: "12px",
  background: "rgba(15,23,42,0.64)",
  border: "1px solid rgba(148,163,184,0.08)",
};

const manualDCalculatedLabelStyle: React.CSSProperties = {
  color: "#94a3b8",
  fontSize: "11px",
  fontWeight: 800,
  textTransform: "uppercase",
  letterSpacing: "0.08em",
};

const manualDCalculatedValueStyle: React.CSSProperties = {
  color: "#f8fafc",
  fontSize: "16px",
  lineHeight: 1.2,
};

const manualDCalculatedNoteStyle: React.CSSProperties = {
  color: "#cbd5e1",
  fontSize: "12px",
  fontWeight: 700,
  lineHeight: 1.35,
};

const manualDWarningGridStyle: React.CSSProperties = {
  display: "grid",
  gap: "8px",
};

const manualDWarningStyle: React.CSSProperties = {
  margin: 0,
  padding: "10px 12px",
  borderRadius: "12px",
  background: "rgba(15,23,42,0.48)",
  border: "1px solid rgba(148,163,184,0.1)",
  color: "#e5e7eb",
  fontSize: "12px",
  fontWeight: 700,
  lineHeight: 1.45,
};

const manualDPrintButtonStyle: React.CSSProperties = {
  minHeight: "46px",
  padding: "12px 16px",
  borderRadius: "999px",
  border: "1px solid rgba(212,175,55,0.22)",
  background: "linear-gradient(90deg, rgba(212,175,55,0.22), rgba(212,175,55,0.1))",
  color: "#f8fafc",
  fontSize: "14px",
  fontWeight: 900,
  cursor: "pointer",
  touchAction: "manipulation",
};

const roomDuctGridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
  gap: "12px",
};

const roomDuctCardStyle: React.CSSProperties = {
  display: "grid",
  gap: "12px",
  padding: "14px",
  borderRadius: "16px",
  background: "rgba(6,11,21,0.72)",
  border: "1px solid rgba(148,163,184,0.1)",
  minWidth: 0,
};

const roomInputGridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "minmax(0, 1.4fr) minmax(84px, 0.6fr)",
  gap: "8px",
};

const roomInputStyle: React.CSSProperties = {
  width: "100%",
  minHeight: "42px",
  borderRadius: "12px",
  border: "1px solid rgba(148,163,184,0.22)",
  background: "rgba(2,6,23,0.7)",
  color: "#f8fafc",
  padding: "10px 12px",
  fontSize: "14px",
  fontWeight: 700,
  outline: "none",
  boxSizing: "border-box",
};

const roomDuctResultGridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
  gap: "8px",
};

const roomDuctMetricStyle: React.CSSProperties = {
  display: "grid",
  gap: "4px",
  padding: "10px",
  borderRadius: "12px",
  background: "rgba(15,23,42,0.74)",
  border: "1px solid rgba(148,163,184,0.08)",
};

const roomDuctLabelStyle: React.CSSProperties = {
  color: "#94a3b8",
  fontSize: "11px",
  fontWeight: 800,
  textTransform: "uppercase",
  letterSpacing: "0.08em",
};

const roomDuctValueStyle: React.CSSProperties = {
  color: "#f8fafc",
  fontSize: "15px",
  lineHeight: 1.2,
};

const roomDuctMessageStyle: React.CSSProperties = {
  margin: 0,
  padding: "10px 12px",
  borderRadius: "12px",
  background: "rgba(15,23,42,0.58)",
  border: "1px solid rgba(148,163,184,0.12)",
  fontSize: "12px",
  fontWeight: 700,
  lineHeight: 1.5,
};

const manualDTestPanelStyle: React.CSSProperties = {
  display: "grid",
  gap: "10px",
  padding: "14px",
  borderRadius: "16px",
  background: "rgba(2,6,23,0.48)",
  border: "1px solid rgba(148,163,184,0.12)",
};

const manualDTestPanelHeaderStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "baseline",
  justifyContent: "space-between",
  gap: "12px",
  flexWrap: "wrap",
};

const manualDTestPanelEyebrowStyle: React.CSSProperties = {
  margin: 0,
  color: "#d4af37",
  fontSize: "11px",
  fontWeight: 850,
  letterSpacing: "0.1em",
  textTransform: "uppercase",
};

const manualDTestPanelTitleStyle: React.CSSProperties = {
  color: "#f8fafc",
  fontSize: "13px",
};

const manualDTestSummaryStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "1.2fr 1fr 1fr 0.8fr",
  gap: "8px",
  alignItems: "center",
  padding: "10px",
  borderRadius: "12px",
  background: "rgba(212,175,55,0.08)",
  border: "1px solid rgba(212,175,55,0.16)",
};

const manualDTestRowsStyle: React.CSSProperties = {
  display: "grid",
  gap: "6px",
};

const manualDTestRowStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "1.2fr 1fr 1fr 1fr 0.8fr",
  gap: "8px",
  alignItems: "center",
  padding: "9px 10px",
  borderRadius: "10px",
  background: "rgba(15,23,42,0.58)",
  border: "1px solid rgba(148,163,184,0.08)",
};

const manualDTestLabelStyle: React.CSSProperties = {
  color: "#cbd5e1",
  fontSize: "12px",
  fontWeight: 800,
};

const manualDTestRoomStyle: React.CSSProperties = {
  color: "#f8fafc",
  fontSize: "12px",
  fontWeight: 800,
};

const manualDTestValueStyle: React.CSSProperties = {
  color: "#f8fafc",
  fontSize: "12px",
  fontWeight: 850,
};

const manualDTestMetaStyle: React.CSSProperties = {
  color: "#cbd5e1",
  fontSize: "12px",
  fontWeight: 700,
};

const manualDTestStatusStyle: React.CSSProperties = {
  color: "#bbf7d0",
  fontSize: "12px",
  fontWeight: 850,
  textTransform: "capitalize",
};

const manualDReportStyle: React.CSSProperties = {
  display: "grid",
  gap: "14px",
  marginTop: "4px",
  padding: "16px",
  borderRadius: "16px",
  background: "rgba(255,255,255,0.04)",
  border: "1px solid rgba(148,163,184,0.14)",
  boxShadow: "inset 0 1px 0 rgba(255,255,255,0.04)",
};

const manualDReportHeaderStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "flex-start",
  justifyContent: "space-between",
  gap: "14px",
};

const manualDReportEyebrowStyle: React.CSSProperties = {
  margin: 0,
  color: "#d4af37",
  fontSize: "11px",
  fontWeight: 850,
  letterSpacing: "0.14em",
  textTransform: "uppercase",
};

const manualDReportTitleStyle: React.CSSProperties = {
  margin: "5px 0 0",
  color: "#f8fafc",
  fontSize: "18px",
  fontWeight: 850,
};

const manualDReportMetaStyle: React.CSSProperties = {
  color: "#cbd5e1",
  fontSize: "13px",
  fontWeight: 750,
  whiteSpace: "nowrap",
};

const manualDTableWrapperStyle: React.CSSProperties = {
  overflowX: "auto",
  WebkitOverflowScrolling: "touch",
};

const manualDTableStyle: React.CSSProperties = {
  width: "100%",
  minWidth: "640px",
  borderCollapse: "collapse",
  color: "#f8fafc",
  fontSize: "13px",
};

const manualDTableHeaderStyle: React.CSSProperties = {
  padding: "10px 8px",
  color: "#94a3b8",
  fontSize: "11px",
  fontWeight: 850,
  letterSpacing: "0.08em",
  textAlign: "left",
  textTransform: "uppercase",
  borderBottom: "1px solid rgba(148,163,184,0.18)",
};

const manualDTableCellStyle: React.CSSProperties = {
  padding: "11px 8px",
  color: "#e5e7eb",
  fontWeight: 650,
  borderBottom: "1px solid rgba(148,163,184,0.1)",
};

const manualDPrintOnlyReportStyle: React.CSSProperties = {
  display: "none",
  fontFamily: "Arial, Helvetica, sans-serif",
  color: "#111827",
  background: "#ffffff",
};

const manualDPrintHeaderStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "flex-start",
  gap: "24px",
  paddingBottom: "18px",
  marginBottom: "18px",
  borderBottom: "2px solid #111827",
};

const manualDPrintBrandStyle: React.CSSProperties = {
  margin: 0,
  color: "#7c5f13",
  fontSize: "12px",
  fontWeight: 900,
  letterSpacing: "0.12em",
  textTransform: "uppercase",
};

const manualDPrintTitleStyle: React.CSSProperties = {
  margin: "6px 0 0",
  color: "#111827",
  fontSize: "26px",
  fontWeight: 900,
  lineHeight: 1.1,
};

const manualDPrintBadgeStyle: React.CSSProperties = {
  padding: "8px 10px",
  border: "1px solid #111827",
  borderRadius: "4px",
  color: "#111827",
  fontSize: "11px",
  fontWeight: 800,
  textTransform: "uppercase",
  letterSpacing: "0.08em",
  whiteSpace: "nowrap",
};

const manualDPrintSummaryGridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
  gap: "10px",
  marginBottom: "18px",
};

const manualDPrintSummaryCardStyle: React.CSSProperties = {
  padding: "10px 12px",
  border: "1px solid #d1d5db",
  borderRadius: "6px",
  background: "#ffffff",
};

const manualDPrintLabelStyle: React.CSSProperties = {
  margin: 0,
  color: "#4b5563",
  fontSize: "10px",
  fontWeight: 900,
  letterSpacing: "0.08em",
  textTransform: "uppercase",
};

const manualDPrintValueStyle: React.CSSProperties = {
  margin: "5px 0 0",
  color: "#111827",
  fontSize: "15px",
  fontWeight: 850,
};

const manualDPrintMutedStyle: React.CSSProperties = {
  margin: "4px 0 0",
  color: "#4b5563",
  fontSize: "11px",
  fontWeight: 650,
};

const manualDPrintWarningsStyle: React.CSSProperties = {
  display: "grid",
  gap: "6px",
  marginBottom: "18px",
};

const manualDPrintWarningStyle: React.CSSProperties = {
  margin: 0,
  padding: "7px 9px",
  border: "1px solid #d1d5db",
  borderRadius: "4px",
  color: "#111827",
  fontSize: "10.5px",
  fontWeight: 650,
  lineHeight: 1.35,
};

const manualDPrintTableStyle: React.CSSProperties = {
  width: "100%",
  borderCollapse: "collapse",
  color: "#111827",
  fontSize: "10.5px",
};

const manualDPrintTableHeaderStyle: React.CSSProperties = {
  padding: "7px 6px",
  borderTop: "1px solid #111827",
  borderBottom: "2px solid #111827",
  color: "#111827",
  fontSize: "9px",
  fontWeight: 900,
  textAlign: "left",
  textTransform: "uppercase",
  letterSpacing: "0.04em",
};

const manualDPrintTableCellStyle: React.CSSProperties = {
  padding: "8px 6px",
  borderBottom: "1px solid #d1d5db",
  color: "#111827",
  fontWeight: 650,
  verticalAlign: "top",
};

const manualDPrintMessageCellStyle: React.CSSProperties = {
  ...manualDPrintTableCellStyle,
  width: "28%",
  lineHeight: 1.35,
};

const sectionCardStyle: React.CSSProperties = {
  background: "linear-gradient(180deg, rgba(8,14,26,0.9), rgba(4,9,17,0.94))",
  border: "1px solid rgba(148,163,184,0.105)",
  borderRadius: "23px",
  padding: "20px",
  display: "grid",
  gap: "16px",
  boxShadow: "0 28px 64px rgba(0,0,0,0.32), inset 0 1px 0 rgba(255,255,255,0.04)",
};

const actionCardStyle: React.CSSProperties = {
  padding: "18px",
  borderRadius: "22px",
  background: "linear-gradient(180deg, rgba(8,14,26,0.9), rgba(4,9,17,0.94))",
  border: "1px solid rgba(148,163,184,0.105)",
  boxShadow: "0 26px 58px rgba(0,0,0,0.3)",
  color: "#f8fafc",
  display: "grid",
  gap: "14px",
};

const actionCardHeaderStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "12px",
};

const actionIconStyle: React.CSSProperties = {
  width: "46px",
  height: "46px",
  borderRadius: "14px",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  background: "linear-gradient(145deg, rgba(212,175,55,0.13), rgba(8,13,24,0.78))",
  color: "#d4af37",
  border: "1px solid rgba(212,175,55,0.13)",
  boxShadow: "inset 0 1px 0 rgba(255,255,255,0.06), 0 12px 24px rgba(0,0,0,0.18)",
  transition: "all 0.25s cubic-bezier(0.4, 0, 0.2, 1)",
  fontSize: "18px",
};

const actionTitleStyle: React.CSSProperties = {
  margin: 0,
  fontWeight: 800,
  fontSize: "16px",
};

const actionDescStyle: React.CSSProperties = {
  margin: "0",
  color: "#94a3b8",
  fontSize: "13px",
  lineHeight: 1.6,
};

const mainHeaderStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: "18px",
  flexWrap: "wrap",
  padding: "22px 24px",
  borderRadius: "23px",
  background:
    "radial-gradient(circle at 84% 10%, rgba(30,64,175,0.075), transparent 36%), linear-gradient(180deg, rgba(8,14,26,0.9), rgba(4,9,17,0.94))",
  border: "1px solid rgba(148,163,184,0.105)",
  boxShadow: "0 28px 64px rgba(0,0,0,0.32), inset 0 1px 0 rgba(255,255,255,0.04)",
};

const welcomeStyle: React.CSSProperties = {
  margin: 0,
  color: "#94a3b8",
  fontSize: "12px",
  fontWeight: 700,
  letterSpacing: "0.12em",
  textTransform: "uppercase",
};

const mainTitleStyle: React.CSSProperties = {
  margin: "5px 0 0",
  fontSize: "31px",
  fontWeight: 700,
  letterSpacing: "-0.015em",
  lineHeight: 1,
};

const mainSubtitleStyle: React.CSSProperties = {
  margin: "8px 0 0",
  color: "#94a3b8",
  fontSize: "14px",
  lineHeight: 1.4,
};

const bellStyle: React.CSSProperties = {
  width: "46px",
  height: "46px",
  borderRadius: "14px",
  background: "rgba(6,11,21,0.7)",
  border: "1px solid rgba(148,163,184,0.105)",
  color: "#f8fafc",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  fontSize: "18px",
  cursor: "pointer",
  position: "relative",
};

const notificationDotStyle: React.CSSProperties = {
  position: "absolute",
  top: "6px",
  right: "6px",
  width: "18px",
  height: "18px",
  borderRadius: "9999px",
  background: "#d4af37",
  color: "#0f172a",
  fontSize: "11px",
  fontWeight: 800,
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
};

const zipRowStyle: React.CSSProperties = {
  marginTop: "15px",
  display: "flex",
  flexWrap: "wrap",
  alignItems: "center",
  gap: "12px",
};

const zipLabelStyle: React.CSSProperties = {
  fontSize: "14px",
  color: "#94a3b8",
  minWidth: "88px",
};

const zipInputStyle: React.CSSProperties = {
  width: "96px",
  padding: "10px 12px",
  borderRadius: "12px",
  border: "1px solid rgba(148,163,184,0.18)",
  background: "rgba(4,9,17,0.86)",
  color: "#f8fafc",
  fontWeight: 700,
};

const zipBadgeStyle: React.CSSProperties = {
  padding: "8px 12px",
  borderRadius: "9999px",
  background: "rgba(148,163,184,0.085)",
  color: "#94a3b8",
  fontSize: "13px",
  fontWeight: 700,
};

const dashboardSummaryStyle: React.CSSProperties = {
  margin: 0,
  color: "#94a3b8",
  fontSize: "16px",
  lineHeight: 1.7,
};

const proposalShellStyle: React.CSSProperties = {
  borderRadius: "24px",
  overflow: "hidden",
  background: "rgba(5, 10, 19, 1)",
  border: "1px solid rgba(148,163,184,0.105)",
  padding: "0",
  boxShadow: "0 32px 66px rgba(0,0,0,0.32)",
};

const bannerTextWrapperStyle: React.CSSProperties = {
  display: "grid",
  gap: "10px",
};

const bannerTagStyle: React.CSSProperties = {
  margin: 0,
  color: "#d4af37",
  border: "1px solid rgba(212,175,55,0.12)",
  boxShadow: "0 8px 18px rgba(0,0,0,0.14)",
  transition: "all 0.25s cubic-bezier(0.4, 0, 0.2, 1)",
  fontWeight: 800,
  letterSpacing: "0.16em",
  textTransform: "uppercase",
};

const bannerTitleStyle: React.CSSProperties = {
  margin: 0,
  fontSize: "26px",
  fontWeight: 740,
  lineHeight: 1.18,
  color: "#f8fafc",
};

const bottomBannerStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "1.2fr 0.8fr",
  gap: "20px",
  padding: "24px",
  background:
    "radial-gradient(circle at 12% 12%, rgba(212,175,55,0.055), transparent 34%), linear-gradient(180deg, rgba(8,14,26,0.9), rgba(4,9,17,0.94))",
  border: "1px solid rgba(148,163,184,0.105)",
  borderRadius: "23px",
  boxShadow: "0 28px 64px rgba(0,0,0,0.32), inset 0 1px 0 rgba(255,255,255,0.04)",
};

const planBadgeGridStyle: React.CSSProperties = {
  display: "grid",
  gap: "14px",
};

const planBadgeStyle: React.CSSProperties = {
  background: "rgba(6,11,21,0.72)",
  borderRadius: "18px",
  padding: "22px",
  border: "1px solid rgba(148,163,184,0.09)",
};

const planLabelStyle: React.CSSProperties = {
  margin: 0,
  color: "#d4af37",
  border: "1px solid rgba(212,175,55,0.12)",
  boxShadow: "0 8px 18px rgba(0,0,0,0.14)",
  transition: "all 0.25s cubic-bezier(0.4, 0, 0.2, 1)",
  fontSize: "12px",
  letterSpacing: "0.18em",
  textTransform: "uppercase",
};

const planTitleStyle: React.CSSProperties = {
  margin: "14px 0 0",
  fontWeight: 800,
  fontSize: "18px",
  color: "#f8fafc",
};
