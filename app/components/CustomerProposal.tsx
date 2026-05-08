"use client";

import { useState } from "react";

type Props = {
  tons: number;
  homeType: string;
  finalPrice: number;
  basicPrice: number;
  premiumPrice: number;
  elitePrice: number;
  formatMoney: (value: number) => string;
};

type ProposalOption = {
  name: "Basic Comfort" | "Better Comfort" | "Elite Comfort";
  priceValue: number;
  features: string[];
};

export default function CustomerProposal({
  tons,
  homeType,
  basicPrice,
  premiumPrice,
  elitePrice,
  formatMoney,
}: Props) {
  const [selectedOption, setSelectedOption] = useState<ProposalOption | null>(null);
  const [proposalConfirmed, setProposalConfirmed] = useState(false);

  const [customerName, setCustomerName] = useState("");
  const [jobAddress, setJobAddress] = useState("");
  const [phone, setPhone] = useState("");
  const [systemType, setSystemType] = useState("");

  const recommendedName =
    tons <= 2 ? "Basic Comfort" : tons <= 3 ? "Better Comfort" : "Elite Comfort";

  const options: ProposalOption[] = [
    {
      name: "Basic Comfort",
      priceValue: basicPrice,
      features: [
        "Properly sized system",
        "Standard efficiency equipment",
        "Professional installation",
      ],
    },
    {
      name: "Better Comfort",
      priceValue: premiumPrice,
      features: [
        "Properly sized system",
        "High efficiency equipment",
        "Enhanced airflow balance",
        "Professional installation",
      ],
    },
    {
      name: "Elite Comfort",
      priceValue: elitePrice,
      features: [
        "Properly sized system",
        "Premium high-efficiency system",
        "Advanced airflow design",
        "Maximum comfort performance",
        "Priority installation",
      ],
    },
  ];

  const getRecommendationReason = () => {
    if (homeType === "new") {
      return "Tight home + inverter system means better comfort and efficiency at lower capacity.";
    }

    if (homeType === "modern") {
      return "Balanced sizing for comfort, efficiency, and peak performance.";
    }

    return "Extra capacity helps handle heat loss and peak demand in older homes.";
  };

  const handleSelect = (option: ProposalOption) => {
    setSelectedOption(option);
    setProposalConfirmed(false);
  };

  return (
    <>
      <style>{printStyles}</style>

      <div style={proposalBoxStyle} className="no-print">
        <p style={smallLabelStyle}>Panda Heating & Cooling</p>
        <h2 style={titleStyle}>HVAC Proposal</h2>

        <p style={{ fontWeight: 800 }}>
          Recommended System: {tons} Ton System
        </p>

        <p style={subTextStyle}>
          Clear system options built around comfort, efficiency, and long-term reliability.
        </p>

        <div style={infoGridStyle}>
          <input
            style={inputStyle}
            placeholder="Customer name"
            value={customerName}
            onChange={(e) => setCustomerName(e.target.value)}
          />

          <input
            style={inputStyle}
            placeholder="Job address"
            value={jobAddress}
            onChange={(e) => setJobAddress(e.target.value)}
          />

          <input
            style={inputStyle}
            placeholder="Phone number"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
          />

          <input
            style={inputStyle}
            placeholder="System type"
            value={systemType}
            onChange={(e) => setSystemType(e.target.value)}
          />
        </div>

        <div style={cardsGridStyle}>
          {options.map((option) => {
            const isSelected = selectedOption?.name === option.name;
            const monthlyPrice = Math.round(option.priceValue / 60);
            const upgradeMonthly =
              option.name === "Better Comfort"
                ? Math.round((premiumPrice - basicPrice) / 60)
                : option.name === "Elite Comfort"
                ? Math.round((elitePrice - premiumPrice) / 60)
                : 0;

            return (
              <div
                key={option.name}
                onClick={() => handleSelect(option)}
                style={{
                  ...optionCardStyle,
                  border: isSelected ? "2px solid #d4af37" : "1px solid #e5e7eb",
                  background: isSelected
                    ? "linear-gradient(180deg, #0f0f0f 0%, #1c1c1c 100%)"
                    : "linear-gradient(180deg, #ffffff 0%, #f8fafc 100%)",
                  color: isSelected ? "white" : "#111827",
                  boxShadow: isSelected
                    ? "0 0 24px rgba(250, 204, 21, 0.35)"
                    : "0 14px 30px rgba(15, 23, 42, 0.08)",
                  transform: isSelected ? "scale(1.04)" : "scale(1)",
                }}
              >
                <h3 style={optionTitleStyle}>{option.name}</h3>

                {option.name === "Better Comfort" && (
                  <div style={popularBadgeStyle}>⭐ Most Popular</div>
                )}

                {option.name === recommendedName && (
                  <div style={recommendedBadgeStyle}>Recommended</div>
                )}

                <div style={priceStyle}>{formatMoney(option.priceValue)}</div>

                <p style={monthlyStyle}>
                  ${monthlyPrice.toLocaleString()}/mo with financing
                </p>

                <p style={finePrintStyle}>
                  Estimated based on 60 months financing. Subject to credit approval.
                </p>

                {option.name !== "Basic Comfort" && (
                  <p style={upgradeStyle}>
                    Only +${upgradeMonthly.toLocaleString()}/mo to upgrade
                  </p>
                )}

                <p style={investmentLabelStyle}>Estimated System Investment</p>

                <div style={investmentBoxStyle}>
                  This investment reflects a properly sized system designed for long-term
                  performance, efficiency, and reliability.
                </div>

                <div style={featuresStyle}>
                  {option.features.map((feature) => (
                    <div key={feature}>✔ {feature}</div>
                  ))}
                </div>

                {isSelected && (
                  <p style={selectedTextStyle}>✔ Selected Package</p>
                )}

                <button
                  type="button"
                  style={selectButtonStyle}
                  onClick={(e) => {
                    e.stopPropagation();
                    handleSelect(option);
                  }}
                >
                  Select {option.name}
                </button>
              </div>
            );
          })}
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
              {formatMoney(selectedOption.priceValue)}
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
            window.print();
          }}
        >
          Generate Proposal PDF
        </button>
      </div>

      <div className="print-only" style={printProposalStyle}>
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
        <p><strong>Price:</strong> {selectedOption ? formatMoney(selectedOption.priceValue) : ""}</p>

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
.print-only {
  display: none;
}

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
}
`;

const proposalBoxStyle: React.CSSProperties = {
  padding: "32px",
  borderRadius: "32px",
  background: "linear-gradient(180deg, #ffffff 0%, #f8fafc 100%)",
  border: "1px solid #e2e8f0",
  boxShadow: "0 25px 60px rgba(15, 23, 42, 0.10)",
  display: "grid",
  gap: "22px",
};

const smallLabelStyle: React.CSSProperties = {
  margin: 0,
  fontSize: "13px",
  fontWeight: 900,
  letterSpacing: "0.14em",
  textTransform: "uppercase",
  color: "#d4af37",
};

const titleStyle: React.CSSProperties = {
  margin: "6px 0",
  fontSize: "34px",
  fontWeight: 900,
};

const subTextStyle: React.CSSProperties = {
  color: "#64748b",
  fontSize: "15px",
};

const infoGridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(2, 1fr)",
  gap: "12px",
  marginTop: "18px",
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "16px 18px",
  borderRadius: "16px",
  border: "1px solid #dbe1e8",
  background: "#ffffff",
  fontSize: "15px",
  fontWeight: 500,
  outline: "none",
  transition: "all 0.2s ease",
  boxSizing: "border-box",
};

const cardsGridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(3, 1fr)",
  gap: "18px",
  marginTop: "20px",
  alignItems: "stretch",
};

const optionCardStyle: React.CSSProperties = {
  padding: "18px",
  minHeight: "auto",
  borderRadius: "24px",
  cursor: "pointer",
  transition: "all 0.25s ease",
  background: "#ffffff",
  display: "flex",
  flexDirection: "column",
  justifyContent: "space-between",
  boxShadow: "0 14px 30px rgba(15, 23, 42, 0.08)",
};

const optionTitleStyle: React.CSSProperties = {
  margin: 0,
  fontSize: "20px",
  fontWeight: 900,
};

const popularBadgeStyle: React.CSSProperties = {
  marginTop: "8px",
  display: "inline-block",
  padding: "5px 12px",
  borderRadius: "999px",
  background: "linear-gradient(90deg, #facc15, #eab308)",
  color: "#111",
  fontSize: "12px",
  fontWeight: 800,
};

const recommendedBadgeStyle: React.CSSProperties = {
  marginTop: "8px",
  display: "inline-block",
  padding: "5px 12px",
  borderRadius: "999px",
  background: "#111827",
  color: "#facc15",
  fontSize: "12px",
  fontWeight: 800,
};

const priceStyle: React.CSSProperties = {
  marginTop: "14px",
  fontSize: "36px",
  fontWeight: 950,
  letterSpacing: "-1px",
};

const monthlyStyle: React.CSSProperties = {
  fontSize: "14px",
  color: "#00c853",
  fontWeight: 800,
  margin: "6px 0",
};

const finePrintStyle: React.CSSProperties = {
  fontSize: "12px",
  color: "#94a3b8",
  lineHeight: 1.4,
};

const upgradeStyle: React.CSSProperties = {
  fontSize: "13px",
  color: "#ffd54f",
  fontWeight: 800,
};

const investmentLabelStyle: React.CSSProperties = {
  color: "#94a3b8",
  fontSize: "14px",
  marginTop: "14px",
};

const investmentBoxStyle: React.CSSProperties = {
  marginTop: "10px",
  padding: "16px",
  borderRadius: "18px",
  background: "linear-gradient(135deg, rgba(250,204,21,0.10), rgba(255,255,255,0.9))",
  border: "1px solid rgba(250,204,21,0.22)",
  fontSize: "13px",
  color: "#334155",
  lineHeight: 1.6,
};

const featuresStyle: React.CSSProperties = {
  marginTop: "14px",
  display: "grid",
  gap: "8px",
  fontSize: "13px",
  color: "#334155",
  fontWeight: 500,
};

const selectedTextStyle: React.CSSProperties = {
  color: "#d4af37",
  marginTop: "10px",
  fontSize: "13px",
  fontWeight: 900,
};

const selectButtonStyle: React.CSSProperties = {
  width: "100%",
  marginTop: "16px",
  padding: "12px",
  borderRadius: "999px",
  border: "none",
  background: "linear-gradient(90deg, #111827, #000000)",
  color: "white",
  fontWeight: 900,
  cursor: "pointer",
};

const selectedBoxStyle: React.CSSProperties = {
  marginTop: "22px",
  padding: "24px",
  borderRadius: "24px",
  background: "linear-gradient(135deg, #111827, #000000)",
  color: "white",
  display: "grid",
  gap: "8px",
};

const confirmButtonStyle: React.CSSProperties = {
  marginTop: "12px",
  padding: "14px 18px",
  borderRadius: "999px",
  border: "none",
  background: "linear-gradient(90deg, #facc15, #d4af37)",
  color: "#111",
  fontWeight: 950,
  cursor: "pointer",
};

const notesStyle: React.CSSProperties = {
  width: "100%",
  minHeight: "100px",
  marginTop: "18px",
  padding: "16px",
  borderRadius: "18px",
  border: "1px solid #d1d5db",
  fontSize: "14px",
};

const mainButtonStyle: React.CSSProperties = {
  width: "100%",
  marginTop: "16px",
  padding: "16px",
  borderRadius: "999px",
  border: "none",
  background: "linear-gradient(90deg, #111827, #000000)",
  color: "white",
  fontWeight: 950,
  fontSize: "15px",
};

const printProposalStyle: React.CSSProperties = {
  padding: "40px",
  fontFamily: "Arial, sans-serif",
  color: "#111",
};

const printTitleStyle: React.CSSProperties = {
  fontSize: "32px",
  fontWeight: 900,
};