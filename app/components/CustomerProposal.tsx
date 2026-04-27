"use client";

import { useState } from "react";

export default function CustomerProposal({
  tons,
  homeType,
  finalPrice,
  basicPrice,
  premiumPrice,
  elitePrice,
  formatMoney,
}: {
  tons: number;
  homeType: string;
  finalPrice: number;
  basicPrice: number;
  premiumPrice: number;
  elitePrice: number;
  formatMoney: (value: number) => string;
}) {
  const [selectedOption, setSelectedOption] = useState<any | null>(null);
  const [proposalConfirmed, setProposalConfirmed] = useState(false);

  const [customerName, setCustomerName] = useState("");
  const [jobAddress, setJobAddress] = useState("");
  const [phone, setPhone] = useState("");
  const [systemType, setSystemType] = useState("");


  let recommendedName = "Better Comfort";

if (tons <= 2) recommendedName = "Basic Comfort";
else if (tons <= 3) recommendedName = "Better Comfort";
else recommendedName = "Elite Comfort";

  const options = [
  {
    name: "Basic Comfort",
    price: formatMoney(basicPrice),
   
    features: [
      "Properly sized system",
      "Standard efficiency equipment",
      "Professional installation",
    ],
  },
  {
    name: "Better Comfort",
    price: formatMoney(premiumPrice),
   
    features: [
      "Properly sized system",
      "High efficiency equipment",
      "Enhanced airflow balance",
      "Professional installation",
    ],
  },
  {
    name: "Elite Comfort",
    price: formatMoney(elitePrice),
   
    features: [
      "Properly sized system",
      "Premium high-efficiency system",
      "Advanced airflow design",
      "Maximum comfort performance",
      "Priority installation",
    ],
  },
];
const activePrice =
  selectedOption?.name === "Basic Comfort"
    ? basicPrice
    : selectedOption?.name === "Elite Comfort"
    ? elitePrice
    : premiumPrice;

  const getRecommendationReason = () => {
    if (homeType === "new") {
      return "Tight home + inverter system means better comfort and efficiency at lower capacity.";
    }

    if (homeType === "modern") {
      return "Balanced sizing for comfort, efficiency, and peak performance.";
    }

    return "Extra capacity helps handle heat loss and peak demand in older homes.";
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <>
      <style>{printStyles}</style>

      <div style={proposalBoxStyle} className="no-print">
        <div>
          <p style={smallLabelStyle}>Panda Heating & Cooling</p>
          <h2 style={titleStyle}>HVAC Proposal</h2>
          <p style={{ fontWeight: 700 }}>
            Recommended System: {tons} Ton System
          </p>
          <p style={subTextStyle}>
            Clear system options built around comfort, efficiency, and long-term reliability.
          </p>
        </div>

        <div style={infoGridStyle}>
          <input style={inputStyle} placeholder="Customer name" value={customerName} onChange={(e) => setCustomerName(e.target.value)} />
          <input style={inputStyle} placeholder="Job address" value={jobAddress} onChange={(e) => setJobAddress(e.target.value)} />
          <input style={inputStyle} placeholder="Phone number" value={phone} onChange={(e) => setPhone(e.target.value)} />
          <input style={inputStyle} placeholder="System type" value={systemType} onChange={(e) => setSystemType(e.target.value)} />
        </div>

        <div
  style={{
    display: "grid",
    gridTemplateColumns: "repeat(3, 1fr)",
    gap: "16px",
    marginTop: "16px",
  }}
>
  {options.map((option) => (
    <div
      key={option.name}
      onClick={() => {
        setSelectedOption(option);
        setProposalConfirmed(false);
      }}
      style={{
  ...optionCardStyle,

  border:
    selectedOption?.name === option.name
      ? "2px solid #d4af37"
      : selectedOption?.name === option.name
      ? "2px solid #c89b3c"
      : "1px solid #e5e5e5",

  background:
    selectedOption?.name === option.name
      ? "linear-gradient(180deg, #0f0f0f 0%, #1c1c1c 100%)"
      : selectedOption?.name === option.name
      ? "linear-gradient(180deg, #fff7e6 0%, #ffffff 100%)"
      : "linear-gradient(180deg, #ffffff 0%, #f8fafc 100%)",

  color:
    selectedOption?.name === option.name ? "white" : "#111",

  boxShadow:
  selectedOption?.name === option.name
    ? "0 0 20px rgba(250,204,21,0.35)"
    : option.name === "Better Confort"
    ? "0 0 10px rgba(250,204,21,0.15)"
    : "none",

  transform:
    selectedOption?.name === option.name
      ? "scale(1.06)"
      : selectedOption?.name === option.name
      ? "scale(1.02)"
      : "scale(1)",

  transition: "all 0.35s cubic-bezier(0.4, 0, 0.2, 1)",
  cursor: "pointer",
}}
    >
      <h3 style={optionTitleStyle}>{option.name}</h3>

{option.name === "Better Comfort" && (
  <div
    style={{
      marginTop: "6px",
      display: "inline-block",
      padding: "4px 10px",
      borderRadius: "999px",
      background: "linear-gradient(90deg, #facc15, #eab308)",
      color: "#111",
      fontSize: "12px",
      fontWeight: "600"
    }}
  >
    ⭐ Most Popular
  </div>
)}

      {option.name === recommendedName && (
        <p style={{ margin: 0, fontSize: "12px", color: "#666" }}>
          Recommended
        </p>
      )}

      {option.name === recommendedName && (
        <p style={{ margin: 0, fontSize: "12px", color: "#666" }}>
          {getRecommendationReason()}
        </p>
      )}

<div
  style={{
    ...priceStyle,
    transition: "all 0.3s ease",
    transform:
      selectedOption?.name === option.name ? "scale(1.05)" : "scale(1)",
  }}
>
  {selectedOption?.name === option.name
    ? formatMoney(activePrice)
    : option.price}
</div>

<p
  style={{
    color: "#94a3b8",
    fontSize: "14px",
    marginTop: "8px",
  }}
>
  Estimated System Investment
</p>

<div
  style={{
    marginTop: "16px",
    padding: "18px",
    borderRadius: "18px",
    background:
      "linear-gradient(135deg, rgba(250,204,21,0.10), rgba(255,255,255,0.03))",
    border: "1px solid rgba(250,204,21,0.22)",
    boxShadow: "0 14px 35px rgba(0,0,0,0.18)",
  }}
>
  <p
    style={{
      margin: 0,
      fontSize: "13px",
      color: "#cbd5e1",
      lineHeight: "1.6",
    }}
  >
    This investment reflects a properly sized system designed for long-term
    performance, efficiency, and reliability. Pricing includes equipment,
    professional installation, and adjustments based on your home's layout
    and installation difficulty. Our goal is to ensure the system runs
    correctly the first time — avoiding airflow issues, inefficiency, and
    premature failure.
  </p>
</div>
<div
  style={{
    marginTop: "12px",
    display: "grid",
    gap: "6px",
    fontSize: "12px",
    color: "#94a3b8",
  }}
>
  {option.features?.map((feature: string, index: number) => (
    <div key={index}>✔ {feature}</div>
  ))}
</div>
{selectedOption?.name === option.name && (
  <p style={{ color: "#d4af37", marginTop: "8px", fontSize: "12px" }}>
    ✔ Selected Package
  </p>
)}
      <button
        type="button"
        style={selectButtonStyle}
        onClick={(e) => {
          e.stopPropagation();
          setSelectedOption(option);
          setProposalConfirmed(false);
        }}
      >
        Select {option.name}
      </button>
    </div>
  ))}
</div>

        {selectedOption && (
          <div style={selectedBoxStyle}>
            <p style={{ margin: 0, fontSize: "14px", opacity: 0.75 }}>
              Selected Package
            </p>

            <h2 style={{ margin: 0, fontSize: "30px" }}>
              {selectedOption.name}
            </h2>

            <p style={{ margin: 0, fontSize: "16px", opacity: 0.8 }}>
              System Size: {tons} Ton
            </p>

            <h1 style={{ margin: 0, fontSize: "38px" }}>
              {selectedOption.price}
            </h1>

            <button
              type="button"
              onClick={() => setProposalConfirmed(true)}
              style={confirmButtonStyle}
            >
              Confirm Proposal
            </button>

            {proposalConfirmed && (
              <div style={{ marginTop: "10px", fontWeight: 800 }}>
                <p>✅ Proposal confirmed — ready for PDF</p>
                <p>Customer: {customerName}</p>
                <p>Address: {jobAddress}</p>
                <p>Phone: {phone}</p>
                <p>System: {systemType}</p>
              </div>
            )}
          </div>
        )}

        <textarea style={notesStyle} placeholder="Add proposal notes here..." />

        <button
          type="button"
         style={{
  ...mainButtonStyle,
            opacity: proposalConfirmed ? 1 : 0.5,
            cursor: proposalConfirmed ? "pointer" : "not-allowed",
          }}
          onClick={() => {
            if (!proposalConfirmed) return;
            handlePrint();
          }}
        >
          Generate Proposal (PDF)
        </button>
      </div>

      <div className="print-only" style={{ ...printProposalStyle, pointerEvents: "none" }}>
        <h1 style={printTitleStyle}>Panda Heating & Cooling</h1>
        <h2>HVAC System Proposal</h2>

        <hr />

        <p><strong>Customer:</strong> {customerName}</p>
        <p><strong>Address:</strong> {jobAddress}</p>
        <p><strong>Phone:</strong> {phone}</p>
        <p><strong>System:</strong> {systemType}</p>

        <hr />

        <p><strong>Selected Package:</strong> {selectedOption?.name}</p>
        <p><strong>System Size:</strong> {tons} Ton</p>
        <p><strong>Price:</strong> {selectedOption?.price}</p>

        <hr />

        <p>{getRecommendationReason()}</p>

        <div style={{ marginTop: "50px" }}>
          <p>Customer Signature: ______________________________</p>
          <p>Date: ____________________</p>
        </div>
      </div>
    </>
  );
}

const printStyles = `
@media print {
  body {
    background: white !important;
  }

  .no-print {
    display: none !important;
  }

  .print-only {
    display: block !important;
  }

  @page {
    size: letter;
    margin: 0.5in;
  }
}

@media screen {
  .print-only {
    display: none !important;
  }
}
`;

const proposalBoxStyle: React.CSSProperties = {
  background: "white",
  borderRadius: "24px",
  padding: "24px",
  display: "grid",
  gap: "22px",
  boxShadow: "0 20px 50px rgba(0,0,0,0.08)",
};

const smallLabelStyle: React.CSSProperties = {
  fontSize: "13px",
  fontWeight: 700,
  color: "#777",
  margin: 0,
};

const titleStyle: React.CSSProperties = {
  fontSize: "30px",
  fontWeight: 900,
  margin: "4px 0",
  color: "#111",
};

const subTextStyle: React.CSSProperties = {
  fontSize: "15px",
  color: "#666",
  margin: 0,
};

const infoGridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
  gap: "12px",
};

const inputStyle: React.CSSProperties = {
  padding: "14px",
  borderRadius: "14px",
  border: "1px solid #ddd",
  fontSize: "15px",
  color: "#111",
  background: "white",
};

const optionGridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
  gap: "18px",
};

const optionCardStyle: React.CSSProperties = {
  background: "linear-gradient(180deg, #ffffff 0%, #f8fafc 100%)",
  padding: "22px",
  borderRadius: "20px",
  display: "grid",
  gap: "14px",
  boxShadow: "0 15px 40px rgba(0,0,0,0.08)",
  transition: "all 0.25s ease",
};

const optionTitleStyle: React.CSSProperties = {
  fontSize: "22px",
  fontWeight: 900,
  margin: 0,
  color: "#111",
};

const priceStyle: React.CSSProperties = {
  fontSize: "28px",
  fontWeight: 900,
  margin: "6px 0",
};

const optionTextStyle: React.CSSProperties = {
  fontSize: "13px",
  color: "#666",
  lineHeight: 1.5,
};

const selectButtonStyle: React.CSSProperties = {
  padding: "14px",
  borderRadius: "16px",
  border: "none",
  background: "#111",
  color: "white",
  fontWeight: 900,
  cursor: "pointer",
  boxShadow: "0 10px 24px rgba(0,0,0,0.18)",
};

const selectedBoxStyle: React.CSSProperties = {
  marginTop: "20px",
  padding: "22px",
  borderRadius: "18px",
  background: "#111",
  color: "white",
  display: "grid",
  gap: "10px",
};

const confirmButtonStyle: React.CSSProperties = {
  marginTop: "10px",
  padding: "14px",
  borderRadius: "14px",
  border: "none",
  background: "white",
  color: "#111",
  fontWeight: 900,
  cursor: "pointer",
};

const notesStyle: React.CSSProperties = {
  minHeight: "120px",
  padding: "16px",
  borderRadius: "16px",
  border: "1px solid #ddd",
  fontSize: "15px",
  resize: "vertical",
};

const mainButtonStyle: React.CSSProperties = {
  padding: "16px",
  borderRadius: "999px",
  border: "none",
  background: "linear-gradient(135deg, #111 0%, #2b2b2b 100%)",
  color: "white",
  fontWeight: 900,
  cursor: "pointer",
  boxShadow: "0 12px 28px rgba(0,0,0,0.22)",
  transition: "all 0.2s ease",
};


const printProposalStyle: React.CSSProperties = {
  fontFamily: "Arial, sans-serif",
  color: "#111",
  padding: "20px",
  fontSize: "14px",
  lineHeight: 1.6,
};

const printTitleStyle: React.CSSProperties = {
  fontSize: "28px",
  marginBottom: "4px",
};