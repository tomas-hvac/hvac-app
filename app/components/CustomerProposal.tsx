"use client";

import { useEffect, useMemo, useRef, useState } from "react";

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

type SavedProposalSnapshot = {
  customerName: string;
  jobAddress: string;
  phone: string;
  systemType: string;
  selectedOptionName: ProposalOption["name"] | null;
  proposalConfirmed: boolean;
};

const CURRENT_PROPOSAL_STORAGE_KEY = "panda-hvac-current-proposal";

export default function CustomerProposal({
  tons,
  homeType,
  basicPrice,
  premiumPrice,
  elitePrice,
  formatMoney,
}: Props) {
  const hasLoadedSavedProposal = useRef(false);
  const [selectedOption, setSelectedOption] = useState<ProposalOption | null>(null);
  const [proposalConfirmed, setProposalConfirmed] = useState(false);

  const [customerName, setCustomerName] = useState("");
  const [jobAddress, setJobAddress] = useState("");
  const [phone, setPhone] = useState("");
  const [systemType, setSystemType] = useState("");

  const recommendedName =
    tons <= 2 ? "Basic Comfort" : tons <= 3 ? "Better Comfort" : "Elite Comfort";

  const options: ProposalOption[] = useMemo(
    () => [
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
    ],
    [basicPrice, elitePrice, premiumPrice]
  );

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

  useEffect(() => {
    const proposalJson = window.localStorage.getItem(CURRENT_PROPOSAL_STORAGE_KEY);
    if (!proposalJson) {
      hasLoadedSavedProposal.current = true;
      return;
    }

    try {
      const savedProposal = JSON.parse(proposalJson) as SavedProposalSnapshot;
      setCustomerName(savedProposal.customerName || "");
      setJobAddress(savedProposal.jobAddress || "");
      setPhone(savedProposal.phone || "");
      setSystemType(savedProposal.systemType || "");
      setProposalConfirmed(Boolean(savedProposal.proposalConfirmed));
      setSelectedOption(
        options.find((option) => option.name === savedProposal.selectedOptionName) ?? null
      );
    } catch {
      window.localStorage.removeItem(CURRENT_PROPOSAL_STORAGE_KEY);
    } finally {
      hasLoadedSavedProposal.current = true;
    }
  }, [options]);

  useEffect(() => {
    if (!hasLoadedSavedProposal.current) return;

    const proposalSnapshot: SavedProposalSnapshot = {
      customerName,
      jobAddress,
      phone,
      systemType,
      selectedOptionName: selectedOption?.name ?? null,
      proposalConfirmed,
    };

    window.localStorage.setItem(CURRENT_PROPOSAL_STORAGE_KEY, JSON.stringify(proposalSnapshot));
  }, [customerName, jobAddress, phone, proposalConfirmed, selectedOption, systemType]);

  const handlePointerSelect = (option: ProposalOption) => (event: React.PointerEvent<HTMLButtonElement>) => {
    if (event.pointerType === "mouse") return;
    event.preventDefault();
    handleSelect(option);
  };

  const handleConfirmProposal = () => {
    setProposalConfirmed(true);
  };

  const handlePointerConfirm = (event: React.PointerEvent<HTMLButtonElement>) => {
    if (event.pointerType === "mouse") return;
    event.preventDefault();
    handleConfirmProposal();
  };

  const handleGeneratePdf = () => {
    if (!proposalConfirmed) return;
    window.print();
  };

  const handlePointerGeneratePdf = (event: React.PointerEvent<HTMLButtonElement>) => {
    if (event.pointerType === "mouse") return;
    event.preventDefault();
    handleGeneratePdf();
  };

  return (
    <>
      <style>{printStyles}</style>

      <div style={proposalBoxStyle} className="no-print customer-proposal-box">
        <p style={smallLabelStyle}>Panda Heating & Cooling</p>
        <h2 style={titleStyle}>HVAC Proposal</h2>

        <p
          style={recommendedSystemStyle}
        >
          Recommended System: {tons} Ton System
        </p>

        <p style={subTextStyle}>
          Clear system options built around comfort, efficiency, and long-term reliability.
        </p>

        <div className="customer-proposal-info-grid" style={infoGridStyle}>
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

        <div className="customer-proposal-cards-grid" style={cardsGridStyle}>
          {options.map((option) => {
            const isSelected = selectedOption?.name === option.name;
            const monthlyPrice = Math.round(option.priceValue / 60);
            const upgradeMonthly =
              option.name === "Better Comfort"
                ? Math.round((premiumPrice - basicPrice) / 60)
                : option.name === "Elite Comfort"
                ? Math.round((elitePrice - premiumPrice) / 60)
                : 0;
            const cardTextColor = isSelected ? "#f8fafc" : "#0f172a";
            const cardMutedColor = isSelected ? "#cbd5e1" : "#475569";
            const cardSubtleColor = isSelected ? "#d1d5db" : "#64748b";
            const cardAccentColor = isSelected ? "#fde68a" : "#047857";
            const cardPanelStyle: React.CSSProperties = {
              ...investmentBoxStyle,
              background: isSelected
                ? "rgba(255, 255, 255, 0.08)"
                : investmentBoxStyle.background,
              border: isSelected
                ? "1px solid rgba(250,204,21,0.28)"
                : investmentBoxStyle.border,
              color: isSelected ? "#f8fafc" : investmentBoxStyle.color,
            };

            return (
              <button
                type="button"
                key={option.name}
                className="customer-proposal-option-card"
                onClick={() => handleSelect(option)}
                onTouchEnd={(e) => {
                  e.preventDefault();
                  handleSelect(option);
                }}
                onPointerUp={handlePointerSelect(option)}
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
                  transform: isSelected ? "translateY(-2px)" : "translateY(0)",
                }}
              >
                <h3 style={{ ...optionTitleStyle, color: cardTextColor }}>{option.name}</h3>

                {option.name === "Better Comfort" && (
                  <div style={popularBadgeStyle}>Most Popular</div>
                )}

                {option.name === recommendedName && (
                  <div style={recommendedBadgeStyle}>Recommended</div>
                )}

                <div style={{ ...priceStyle, color: cardTextColor }}>{formatMoney(option.priceValue)}</div>

                <p style={{ ...monthlyStyle, color: cardAccentColor }}>
                  ${monthlyPrice.toLocaleString()}/mo with financing
                </p>

                <p style={{ ...finePrintStyle, color: cardSubtleColor }}>
                  Estimated based on 60 months financing. Subject to credit approval.
                </p>

                {option.name !== "Basic Comfort" && (
                  <p style={{ ...upgradeStyle, color: cardAccentColor }}>
                    Only +${upgradeMonthly.toLocaleString()}/mo to upgrade
                  </p>
                )}

                <p style={{ ...investmentLabelStyle, color: cardMutedColor }}>
                  Estimated System Investment
                </p>

                <div style={cardPanelStyle}>
                  This investment reflects a properly sized system designed for long-term
                  performance, efficiency, and reliability.
                </div>

                <div style={{ ...featuresStyle, color: cardTextColor }}>
                  {option.features.map((feature) => (
                    <div key={feature}>- {feature}</div>
                  ))}
                </div>

                {isSelected && (
                  <p style={selectedTextStyle}>Selected Package</p>
                )}

                <div
                  style={selectButtonStyle}
                >
                  Select {option.name}
                </div>
              </button>
            );
          })}
        </div>

        {selectedOption && (
          <div style={selectedBoxStyle}>
            <p style={selectedSummaryLabelStyle}>
              Selected Package
            </p>

            <h2 style={selectedSummaryTitleStyle}>
              {selectedOption.name}
            </h2>

            <p style={selectedSummaryMetaStyle}>
              System Size: {tons} Ton
            </p>

            <h1 style={selectedSummaryPriceStyle}>
              {formatMoney(selectedOption.priceValue)}
            </h1>

            <button
              type="button"
              onClick={handleConfirmProposal}
              onTouchEnd={(e) => {
                e.preventDefault();
                handleConfirmProposal();
              }}
              onPointerUp={handlePointerConfirm}
              style={confirmButtonStyle}
            >
              Confirm Proposal
            </button>

            {proposalConfirmed && (
              <div style={confirmedDetailsStyle}>
                <p>Proposal confirmed - ready for PDF</p>
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
          onClick={handleGeneratePdf}
          onTouchEnd={(e) => {
            e.preventDefault();
            handleGeneratePdf();
          }}
          onPointerUp={handlePointerGeneratePdf}
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

.customer-proposal-box,
.customer-proposal-box *,
.customer-proposal-option-card {
  box-sizing: border-box;
  max-width: 100%;
}

.customer-proposal-box {
  overflow-x: hidden;
}

.customer-proposal-box input::placeholder,
.customer-proposal-box textarea::placeholder {
  color: #64748b;
  opacity: 1;
}

.customer-proposal-option-card {
  min-width: 0;
  overflow-wrap: anywhere;
}

@media (max-width: 980px) {
  .customer-proposal-cards-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
  }
}

@media (max-width: 760px) {
  .customer-proposal-box {
    padding: 18px !important;
    border-radius: 22px !important;
    gap: 18px !important;
  }

  .customer-proposal-info-grid,
  .customer-proposal-cards-grid {
    grid-template-columns: minmax(0, 1fr) !important;
    gap: 14px !important;
  }

  .customer-proposal-box input,
  .customer-proposal-box button,
  .customer-proposal-box textarea,
  .customer-proposal-option-card {
    min-height: 48px;
    pointer-events: auto !important;
    position: relative !important;
    z-index: 1 !important;
    touch-action: manipulation;
  }

  .customer-proposal-option-card {
    padding: 18px !important;
    transform: none !important;
  }
}

@media (max-width: 420px) {
  .customer-proposal-box {
    padding: 14px !important;
  }
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
  borderRadius: "28px",
  background: "linear-gradient(180deg, #ffffff 0%, #f6f7fb 100%)",
  border: "1px solid #cbd5e1",
  boxShadow: "0 25px 60px rgba(15, 23, 42, 0.10)",
  display: "grid",
  gap: "20px",
  width: "100%",
  maxWidth: "100%",
  overflow: "hidden",
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
  color: "#0f172a",
  letterSpacing: 0,
  lineHeight: 1.08,
};

const recommendedSystemStyle: React.CSSProperties = {
  margin: 0,
  padding: "14px 16px",
  borderRadius: "16px",
  border: "1px solid rgba(212, 175, 55, 0.34)",
  background: "linear-gradient(135deg, rgba(212,175,55,0.16), rgba(255,255,255,0.88))",
  color: "#0f172a",
  fontSize: "17px",
  fontWeight: 900,
  lineHeight: 1.4,
};

const subTextStyle: React.CSSProperties = {
  margin: 0,
  color: "#334155",
  fontSize: "16px",
  fontWeight: 650,
  lineHeight: 1.65,
};

const infoGridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
  gap: "14px",
  marginTop: "8px",
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  minHeight: "52px",
  padding: "16px 18px",
  borderRadius: "16px",
  border: "1px solid #94a3b8",
  background: "#ffffff",
  color: "#0f172a",
  fontSize: "16px",
  fontWeight: 750,
  outline: "none",
  transition: "all 0.2s ease",
  boxSizing: "border-box",
  boxShadow: "inset 0 1px 0 rgba(15, 23, 42, 0.04)",
};

const cardsGridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
  gap: "18px",
  marginTop: "10px",
  alignItems: "stretch",
  width: "100%",
};

const optionCardStyle: React.CSSProperties = {
  padding: "20px",
  minHeight: "100%",
  borderRadius: "22px",
  cursor: "pointer",
  transition: "all 0.25s ease",
  background: "#ffffff",
  display: "flex",
  flexDirection: "column",
  justifyContent: "space-between",
  boxShadow: "0 14px 30px rgba(15, 23, 42, 0.08)",
  textAlign: "left",
  font: "inherit",
  touchAction: "manipulation",
  WebkitTapHighlightColor: "transparent",
  width: "100%",
  overflow: "hidden",
};

const optionTitleStyle: React.CSSProperties = {
  margin: 0,
  fontSize: "21px",
  fontWeight: 900,
  lineHeight: 1.2,
};

const popularBadgeStyle: React.CSSProperties = {
  marginTop: "8px",
  display: "inline-block",
  padding: "7px 12px",
  borderRadius: "999px",
  background: "linear-gradient(90deg, #facc15, #eab308)",
  color: "#111",
  fontSize: "12px",
  fontWeight: 800,
};

const recommendedBadgeStyle: React.CSSProperties = {
  marginTop: "8px",
  display: "inline-block",
  padding: "7px 12px",
  borderRadius: "999px",
  background: "#111827",
  color: "#facc15",
  fontSize: "12px",
  fontWeight: 800,
};

const priceStyle: React.CSSProperties = {
  marginTop: "14px",
  fontSize: "34px",
  fontWeight: 950,
  letterSpacing: 0,
  lineHeight: 1.1,
  overflowWrap: "anywhere",
};

const monthlyStyle: React.CSSProperties = {
  fontSize: "15px",
  color: "#00c853",
  fontWeight: 900,
  margin: "6px 0",
  lineHeight: 1.45,
};

const finePrintStyle: React.CSSProperties = {
  fontSize: "13px",
  color: "#64748b",
  lineHeight: 1.55,
  margin: "4px 0 0",
};

const upgradeStyle: React.CSSProperties = {
  fontSize: "14px",
  color: "#ffd54f",
  fontWeight: 900,
  lineHeight: 1.45,
};

const investmentLabelStyle: React.CSSProperties = {
  color: "#475569",
  fontSize: "14px",
  margin: "14px 0 0",
  fontWeight: 850,
};

const investmentBoxStyle: React.CSSProperties = {
  marginTop: "10px",
  padding: "16px",
  borderRadius: "16px",
  background: "linear-gradient(135deg, rgba(250,204,21,0.10), rgba(255,255,255,0.9))",
  border: "1px solid rgba(250,204,21,0.22)",
  fontSize: "14px",
  color: "#1f2937",
  lineHeight: 1.6,
};

const featuresStyle: React.CSSProperties = {
  marginTop: "14px",
  display: "grid",
  gap: "10px",
  fontSize: "14px",
  color: "#1f2937",
  fontWeight: 700,
  lineHeight: 1.45,
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
  minHeight: "48px",
  padding: "14px 16px",
  borderRadius: "999px",
  border: "none",
  background: "linear-gradient(90deg, #111827, #000000)",
  color: "white",
  fontWeight: 900,
  cursor: "pointer",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  textAlign: "center",
  lineHeight: 1.25,
};

const selectedBoxStyle: React.CSSProperties = {
  marginTop: "22px",
  padding: "24px",
  borderRadius: "22px",
  background: "linear-gradient(135deg, #111827, #000000)",
  color: "white",
  display: "grid",
  gap: "10px",
  boxShadow: "0 18px 38px rgba(15, 23, 42, 0.24)",
};

const selectedSummaryLabelStyle: React.CSSProperties = {
  margin: 0,
  color: "#d1d5db",
  fontSize: "14px",
  fontWeight: 850,
  lineHeight: 1.35,
};

const selectedSummaryTitleStyle: React.CSSProperties = {
  margin: 0,
  color: "#ffffff",
  fontSize: "30px",
  fontWeight: 950,
  lineHeight: 1.18,
  overflowWrap: "anywhere",
};

const selectedSummaryMetaStyle: React.CSSProperties = {
  margin: 0,
  color: "#e5e7eb",
  fontSize: "16px",
  fontWeight: 750,
  lineHeight: 1.45,
};

const selectedSummaryPriceStyle: React.CSSProperties = {
  margin: 0,
  color: "#ffffff",
  fontSize: "38px",
  fontWeight: 950,
  letterSpacing: 0,
  lineHeight: 1.05,
  overflowWrap: "anywhere",
};

const confirmButtonStyle: React.CSSProperties = {
  marginTop: "12px",
  minHeight: "52px",
  padding: "15px 20px",
  borderRadius: "999px",
  border: "none",
  background: "linear-gradient(90deg, #facc15, #d4af37)",
  color: "#111",
  fontWeight: 950,
  fontSize: "16px",
  cursor: "pointer",
  touchAction: "manipulation",
  WebkitTapHighlightColor: "transparent",
  lineHeight: 1.25,
};

const confirmedDetailsStyle: React.CSSProperties = {
  marginTop: "10px",
  padding: "14px 16px",
  borderRadius: "16px",
  background: "rgba(255, 255, 255, 0.08)",
  border: "1px solid rgba(250, 204, 21, 0.18)",
  color: "#f8fafc",
  fontSize: "14px",
  fontWeight: 800,
  lineHeight: 1.5,
  overflowWrap: "anywhere",
};

const notesStyle: React.CSSProperties = {
  width: "100%",
  minHeight: "116px",
  marginTop: "18px",
  padding: "16px 18px",
  borderRadius: "16px",
  border: "1px solid #94a3b8",
  background: "#ffffff",
  color: "#0f172a",
  fontSize: "16px",
  fontWeight: 650,
  lineHeight: 1.55,
  boxSizing: "border-box",
  outline: "none",
  resize: "vertical",
};

const mainButtonStyle: React.CSSProperties = {
  width: "100%",
  marginTop: "16px",
  minHeight: "54px",
  padding: "16px 20px",
  borderRadius: "999px",
  border: "none",
  background: "linear-gradient(90deg, #111827, #000000)",
  color: "white",
  fontWeight: 950,
  fontSize: "16px",
  lineHeight: 1.25,
  touchAction: "manipulation",
  WebkitTapHighlightColor: "transparent",
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
