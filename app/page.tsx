"use client";

import { useState } from "react";
import CustomerProposal from "./components/CustomerProposal";

export default function HVACAppPage() {
  // STATES
  const [squareFeet, setSquareFeet] = useState(2200);
  const [ceilingHeight, setCeilingHeight] = useState(8);
  const [homeType, setHomeType] = useState("modern");

  const [rooms, setRooms] = useState<any[]>([
    { name: "Living Room", squareFeet: 420 },
    { name: "Kitchen", squareFeet: 220 },
  ]);

  // ROOM FUNCTIONS
  function updateRoom(index: number, field: string, value: string | number) {
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
const regionMultiplier = 1.08; // Oregon market adjustment
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
  return (
    <div style={containerStyle}>
      <h1 style={titleStyle}>HVAC Load Calculator</h1>

      {/* INPUTS */}
      <input
        style={inputStyle}
        value={squareFeet}
        onChange={(e) => setSquareFeet(Number(e.target.value))}
        placeholder="Square Feet"
      />

      <input
        style={inputStyle}
        value={ceilingHeight}
        onChange={(e) => setCeilingHeight(Number(e.target.value))}
        placeholder="Ceiling Height"
      />

      {/* SMART SIZING BUTTONS */}
     <div style={{ display: "flex", gap: "10px" }}>
  <button
    style={{
      ...buttonStyle,
      background: homeType === "new" ? "#111" : "white",
      color: homeType === "new" ? "white" : "#111",
    }}
    onClick={() => setHomeType("new")}
  >
    New / Tight
  </button>

  <button
    style={{
      ...buttonStyle,
      background: homeType === "modern" ? "#111" : "white",
      color: homeType === "modern" ? "white" : "#111",
    }}
    onClick={() => setHomeType("modern")}
  >
    Modern
  </button>

  <button
    style={{
      ...buttonStyle,
      background: homeType === "old" ? "#111" : "white",
      color: homeType === "old" ? "white" : "#111",
    }}
    onClick={() => setHomeType("old")}
  >
    Older / Leaky
  </button>
</div>

      {/* ROOMS */}
      {rooms.map((room, index) => (
        <div key={index} style={roomCardStyle}>
          <input
            style={inputStyle}
            value={room.name}
            onChange={(e) => updateRoom(index, "name", e.target.value)}
          />

          <input
            style={inputStyle}
            value={room.squareFeet}
            onChange={(e) =>
              updateRoom(index, "squareFeet", Number(e.target.value))
            }
          />
        </div>
      ))}

      <button style={mainButtonStyle} onClick={addRoom}>
        + Add Room
      </button>

      {/* RESULTS */}
      <div
  style={{
  ...resultsStyle,
  transform: "scale(1)",
}}
  onMouseLeave={(e) => {
    e.currentTarget.style.transform = "scale(1)";
  }}
>
        <p style={{ fontSize: "14px", margin: 0 }}>
          Recommended System Size
        </p>

        <h2 style={{ margin: 0 }}>
          <p style={{ margin: 0, fontSize: "14px", color: "#666" }}>
  Recommended: {homeType === "new"
    ? `${tonsLow} Ton (Inverter optimized)`
    : homeType === "modern"
    ? `${tons} Ton`
    : `${tonsHigh} Ton (for safety margin)`}
</p>
  {tonsLow} – {tonsHigh} Ton System
</h2>
      </div>

  <div>
  <CustomerProposal
  tons={tons}
  homeType={homeType}
  finalPrice={finalPrice}
  basicPrice={basicPrice}
  premiumPrice={premiumPrice}
  elitePrice={elitePrice}
  formatMoney={formatMoney}
/>
    <div>
  <h1
    style={{
      fontSize: "42px",
      fontWeight: 700,
      marginTop: "14px",
      color: "#facc15",
      textShadow: "0 0 20px rgba(250,204,21,0.4)",
    }}
  >
    {formatMoney(finalPrice)}
  </h1>

  <p
    style={{
      color: "#94a3b8",
      fontSize: "14px",
      letterSpacing: "1px",
      marginTop: "4px",
    }}
  >
    Estimated System Investment
  </p>
</div>

  <div>
    <p>Equipment: {formatMoney(equipmentDisplayCost)}</p>
<p>Labor: {formatMoney(laborCost)}</p>
<p>Ductwork: {formatMoney(realDuctworkCost)}</p>
<p>Adjusted Cost: {formatMoney(adjustedTotal)}</p>

    <div
  style={{
    marginTop: "28px",
    padding: "24px",
    borderRadius: "22px",
    background: "linear-gradient(135deg, rgba(250,204,21,0.15), rgba(250,204,21,0.05))",
    border: "1px solid rgba(250,204,21,0.25)",
    backdropFilter: "blur(8px)",
    boxShadow: "0 10px 30px rgba(0,0,0,0.4)",
  }}
></div>

    <p
  style={{
    color: "#94a3b8",
    fontSize: "14px",
    letterSpacing: "1px",
    marginTop: "4px",
  }}
>
  Estimated System Investment
</p>
  </div>
</div>

</div>
);
}
/* STYLES */
const titleStyle: React.CSSProperties = {
  fontSize: "34px",
  fontWeight: 900,
  letterSpacing: "-1px",
  margin: 0,
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
  background: "#f8fafc",
  minHeight: "100vh",
  color: "#111",
  maxWidth: "1100px",
  margin: "0 auto",
};
const inputStyle: React.CSSProperties = {
  padding: "14px",
  borderRadius: "14px",
  border: "1px solid #d1d5db",
  background: "white",
  color: "#111",
  fontSize: "15px",
};
const mainButtonStyle: React.CSSProperties = {
  padding: "16px",
  borderRadius: "16px",
  border: "none",
  background: "#111",
  color: "white",
  fontSize: "16px",
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