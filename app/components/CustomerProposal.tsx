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

type ProposalPrintMode = "proposal" | "combined";

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

function printProposalMode(mode: ProposalPrintMode) {
  document.body.dataset.printMode = mode;

  const clearPrintMode = () => {
    delete document.body.dataset.printMode;
    window.removeEventListener("afterprint", clearPrintMode);
  };

  window.addEventListener("afterprint", clearPrintMode, { once: true });
  window.print();
  window.setTimeout(clearPrintMode, 1000);
}

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
    printProposalMode("proposal");
  };

  const handleGenerateCombinedReport = () => {
    if (!proposalConfirmed || homeType !== "new") return;
    printProposalMode("combined");
  };

  const handlePointerGeneratePdf = (event: React.PointerEvent<HTMLButtonElement>) => {
    if (event.pointerType === "mouse") return;
    event.preventDefault();
    handleGeneratePdf();
  };

  const handlePointerGenerateCombinedReport = (event: React.PointerEvent<HTMLButtonElement>) => {
    if (event.pointerType === "mouse") return;
    event.preventDefault();
    handleGenerateCombinedReport();
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
            const tierLabel =
              option.name === "Basic Comfort"
                ? "Silver"
                : option.name === "Better Comfort"
                ? "Gold"
                : "Elite";
            const packageVisual =
              option.name === "Basic Comfort"
                ? {
                    background: "linear-gradient(180deg, #ffffff 0%, #eef2f7 100%)",
                    border: "#b8c2cf",
                    text: "#0f172a",
                    muted: "#475569",
                    subtle: "#64748b",
                    accent: "#64748b",
                    shield: "linear-gradient(180deg, #ffffff 0%, #cbd5e1 100%)",
                    shieldText: "#334155",
                    panel: "linear-gradient(135deg, rgba(203,213,225,0.22), rgba(255,255,255,0.92))",
                    button: "linear-gradient(90deg, #475569, #1e293b)",
                    buttonColor: "#ffffff",
                  }
                : option.name === "Better Comfort"
                ? {
                    background: "linear-gradient(180deg, #ffffff 0%, #fff7d6 100%)",
                    border: "#d4af37",
                    text: "#0f172a",
                    muted: "#5f4b12",
                    subtle: "#745a12",
                    accent: "#a16207",
                    shield: "linear-gradient(180deg, #fff7c2 0%, #d4af37 100%)",
                    shieldText: "#111827",
                    panel: "linear-gradient(135deg, rgba(212,175,55,0.20), rgba(255,255,255,0.92))",
                    button: "linear-gradient(90deg, #d4af37, #a16207)",
                    buttonColor: "#111827",
                  }
                : {
                    background: "linear-gradient(180deg, #0b1220 0%, #111827 100%)",
                    border: "#d4af37",
                    text: "#f8fafc",
                    muted: "#cbd5e1",
                    subtle: "#d1d5db",
                    accent: "#fde68a",
                    shield: "linear-gradient(180deg, #f8e7a1 0%, #d4af37 48%, #111827 100%)",
                    shieldText: "#ffffff",
                    panel: "rgba(255, 255, 255, 0.08)",
                    button: "linear-gradient(90deg, #facc15, #d4af37)",
                    buttonColor: "#111827",
                  };
            const monthlyPrice = Math.round(option.priceValue / 60);
            const upgradeMonthly =
              option.name === "Better Comfort"
                ? Math.round((premiumPrice - basicPrice) / 60)
                : option.name === "Elite Comfort"
                ? Math.round((elitePrice - premiumPrice) / 60)
                : 0;
            const cardTextColor = packageVisual.text;
            const cardMutedColor = packageVisual.muted;
            const cardSubtleColor = packageVisual.subtle;
            const cardAccentColor = packageVisual.accent;
            const cardPanelStyle: React.CSSProperties = {
              ...investmentBoxStyle,
              background: packageVisual.panel,
              border: isSelected
                ? `1px solid ${packageVisual.border}`
                : "1px solid rgba(15, 23, 42, 0.08)",
              color: cardTextColor,
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
                  border: isSelected ? `2px solid ${packageVisual.border}` : `1px solid ${packageVisual.border}`,
                  background: packageVisual.background,
                  color: cardTextColor,
                  boxShadow: isSelected
                    ? "0 24px 52px rgba(15, 23, 42, 0.24), 0 0 0 4px rgba(212,175,55,0.12)"
                    : "0 16px 36px rgba(15, 23, 42, 0.10)",
                  transform: isSelected ? "translateY(-2px)" : "translateY(0)",
                }}
              >
                <div
                  style={{
                    ...packageShieldStyle,
                    background: packageVisual.shield,
                    borderColor: packageVisual.border,
                  }}
                >
                  <span style={{ ...packageShieldTextStyle, color: packageVisual.shieldText }}>
                    {tierLabel}
                  </span>
                </div>

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

                <div
                  style={{
                    ...homeownerConfidenceStyle,
                    borderColor: isSelected ? "rgba(212,175,55,0.35)" : "rgba(15,23,42,0.10)",
                    background: isSelected ? "rgba(255,255,255,0.07)" : "rgba(255,255,255,0.62)",
                  }}
                >
                  <p style={{ ...homeownerConfidenceTitleStyle, color: cardMutedColor }}>
                    Homeowner Confidence
                  </p>
                  <div style={{ ...homeownerConfidenceGridStyle, color: cardTextColor }}>
                    <span>Properly sized system</span>
                    <span>Airflow-balanced design</span>
                    <span>Comfort-focused installation</span>
                    <span>Long-term efficiency focus</span>
                  </div>
                </div>

                {isSelected && (
                  <p style={selectedTextStyle}>Selected Package</p>
                )}

                <div
                  style={{
                    ...selectButtonStyle,
                    background: packageVisual.button,
                    color: packageVisual.buttonColor,
                    border: `1px solid ${packageVisual.border}`,
                  }}
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

        {homeType === "new" && (
          <button
            type="button"
            style={{
              ...mainButtonStyle,
              opacity: proposalConfirmed ? 1 : 0.5,
              cursor: proposalConfirmed ? "pointer" : "not-allowed",
              background: "linear-gradient(90deg, #0f172a, #d4af37)",
            }}
            onClick={handleGenerateCombinedReport}
            onTouchEnd={(e) => {
              e.preventDefault();
              handleGenerateCombinedReport();
            }}
            onPointerUp={handlePointerGenerateCombinedReport}
          >
            Combined Report
          </button>
        )}
      </div>

      <div className="print-only panda-proposal-print-only" style={printProposalStyle}>
        <header style={printHeaderStyle}>
          <div>
            <p style={printBrandLabelStyle}>Panda Heating & Cooling</p>
            <h1 style={printTitleStyle}>HVAC System Proposal</h1>
            <p style={printSubtitleStyle}>Premium comfort options prepared for your home.</p>
          </div>
          <div style={printSystemBadgeStyle}>
            <p style={printBadgeLabelStyle}>Recommended System</p>
            <p style={printBadgeValueStyle}>{tons} Ton</p>
          </div>
        </header>

        <section style={printSectionStyle}>
          <p style={printSectionTitleStyle}>Customer & Project</p>
          <div style={printInfoGridStyle}>
            <div style={printInfoItemStyle}>
              <p style={printInfoLabelStyle}>Customer</p>
              <p style={printInfoValueStyle}>{customerName || "Not provided"}</p>
            </div>
            <div style={printInfoItemStyle}>
              <p style={printInfoLabelStyle}>Phone</p>
              <p style={printInfoValueStyle}>{phone || "Not provided"}</p>
            </div>
            <div style={printInfoItemStyle}>
              <p style={printInfoLabelStyle}>Address</p>
              <p style={printInfoValueStyle}>{jobAddress || "Not provided"}</p>
            </div>
            <div style={printInfoItemStyle}>
              <p style={printInfoLabelStyle}>System Type</p>
              <p style={printInfoValueStyle}>{systemType || "Not provided"}</p>
            </div>
          </div>
        </section>

        <section style={printSelectedSectionStyle}>
          <div>
            <p style={printSectionTitleStyle}>Selected Package</p>
            <h2 style={printSelectedTitleStyle}>{selectedOption?.name || "Package not selected"}</h2>
            <p style={printSelectedMetaStyle}>System Size: {tons} Ton</p>
          </div>
          <div style={printSelectedPriceStyle}>
            {selectedOption ? formatMoney(selectedOption.priceValue) : ""}
          </div>
        </section>

        <section style={printSectionStyle}>
          <p style={printSectionTitleStyle}>Good / Better / Elite Options</p>
          <table className="panda-print-options-table" style={printOptionsTableStyle}>
            <thead>
              <tr>
                <th style={printTableHeaderStyle}>Tier</th>
                <th style={printTableHeaderStyle}>Package</th>
                <th style={printTableHeaderStyle}>Investment</th>
                <th style={printTableHeaderStyle}>Included Highlights</th>
              </tr>
            </thead>
            <tbody>
              {options.map((option) => {
                const tierLabel =
                  option.name === "Basic Comfort"
                    ? "Good"
                    : option.name === "Better Comfort"
                    ? "Better"
                    : "Elite";
                const isSelected = selectedOption?.name === option.name;

                return (
                  <tr key={`print-${option.name}`} style={isSelected ? printSelectedRowStyle : undefined}>
                    <td style={printTableCellStyle}>{tierLabel}</td>
                    <td style={printTableCellStyle}>
                      {option.name}
                      {isSelected ? " - Selected" : ""}
                    </td>
                    <td style={printTableCellStyle}>{formatMoney(option.priceValue)}</td>
                    <td style={printTableCellStyle}>{option.features.join(", ")}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </section>

        <section style={printSectionStyle}>
          <p style={printSectionTitleStyle}>Recommendation Notes</p>
          <p style={printBodyTextStyle}>{getRecommendationReason()}</p>
        </section>

        <section style={printSignatureGridStyle}>
          <div style={printSignatureLineStyle}>
            <p style={printSignatureLabelStyle}>Customer Signature</p>
          </div>
          <div style={printSignatureLineStyle}>
            <p style={printSignatureLabelStyle}>Date</p>
          </div>
          <div style={printSignatureLineStyle}>
            <p style={printSignatureLabelStyle}>Panda Heating & Cooling Representative</p>
          </div>
          <div style={printSignatureLineStyle}>
            <p style={printSignatureLabelStyle}>Date</p>
          </div>
        </section>
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
  @page {
    margin: 0.45in;
  }

  body {
    background: white !important;
  }

  body * {
    visibility: hidden !important;
  }

  .panda-app-shell,
  .panda-app-main,
  .panda-proposal-shell {
    display: block !important;
    visibility: visible !important;
    width: 100% !important;
    max-width: none !important;
    min-height: 0 !important;
    overflow: visible !important;
    padding: 0 !important;
    margin: 0 !important;
    background: #ffffff !important;
    color: #111827 !important;
  }

  .no-print {
    display: none !important;
  }

  .print-only {
    display: block !important;
  }

  body[data-print-mode="proposal"] .panda-proposal-print-only,
  body[data-print-mode="proposal"] .panda-proposal-print-only *,
  body[data-print-mode="combined"] .panda-proposal-print-only,
  body[data-print-mode="combined"] .panda-proposal-print-only *,
  body[data-print-mode="combined"] .manual-d-print-only-report,
  body[data-print-mode="combined"] .manual-d-print-only-report *,
  body[data-print-mode="combined"] .manual-d-print-report-only,
  body[data-print-mode="combined"] .manual-d-print-report-only * {
    visibility: visible !important;
  }

  .panda-proposal-print-only {
    position: absolute !important;
    inset: 0 auto auto 0 !important;
    width: 100% !important;
  }

  body[data-print-mode="proposal"] .manual-d-panel-root,
  body[data-print-mode="proposal"] .manual-d-print-report-only,
  body[data-print-mode="proposal"] .manual-d-print-only-report,
  .manual-d-screen-panel,
  .load-calculator-page,
  .panda-proposal-header,
  .panda-sidebar,
  .panda-main-header {
    display: none !important;
    visibility: hidden !important;
  }

  .panda-print-options-table {
    page-break-inside: avoid;
  }
}
`;

const proposalBoxStyle: React.CSSProperties = {
  padding: "34px",
  borderRadius: "30px",
  background: "linear-gradient(180deg, #ffffff 0%, #f8fafc 58%, #f1f5f9 100%)",
  border: "1px solid #d7dee8",
  boxShadow: "0 28px 70px rgba(15, 23, 42, 0.12)",
  display: "grid",
  gap: "22px",
  width: "100%",
  maxWidth: "100%",
  overflow: "hidden",
};

const smallLabelStyle: React.CSSProperties = {
  margin: 0,
  fontSize: "12px",
  fontWeight: 900,
  letterSpacing: "0.16em",
  textTransform: "uppercase",
  color: "#d4af37",
};

const titleStyle: React.CSSProperties = {
  margin: "4px 0",
  fontSize: "36px",
  fontWeight: 900,
  color: "#0f172a",
  letterSpacing: 0,
  lineHeight: 1.08,
};

const recommendedSystemStyle: React.CSSProperties = {
  margin: 0,
  padding: "15px 18px",
  borderRadius: "18px",
  border: "1px solid rgba(180, 131, 14, 0.34)",
  background: "linear-gradient(135deg, rgba(212,175,55,0.18), rgba(255,255,255,0.94))",
  color: "#0f172a",
  fontSize: "17px",
  fontWeight: 900,
  lineHeight: 1.4,
};

const subTextStyle: React.CSSProperties = {
  margin: 0,
  color: "#334155",
  fontSize: "16px",
  fontWeight: 700,
  lineHeight: 1.6,
};

const infoGridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
  gap: "15px",
  marginTop: "4px",
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  minHeight: "54px",
  padding: "16px 18px",
  borderRadius: "16px",
  border: "1px solid #7c8da3",
  background: "#ffffff",
  color: "#0f172a",
  fontSize: "16px",
  fontWeight: 750,
  outline: "none",
  transition: "all 0.2s ease",
  boxSizing: "border-box",
  boxShadow: "inset 0 1px 0 rgba(15, 23, 42, 0.04), 0 8px 18px rgba(15, 23, 42, 0.04)",
};

const cardsGridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
  gap: "20px",
  marginTop: "8px",
  alignItems: "stretch",
  width: "100%",
};

const optionCardStyle: React.CSSProperties = {
  padding: "22px",
  minHeight: "100%",
  borderRadius: "24px",
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

const packageShieldStyle: React.CSSProperties = {
  width: "58px",
  height: "66px",
  display: "grid",
  placeItems: "center",
  marginBottom: "14px",
  border: "1px solid",
  clipPath: "polygon(50% 0%, 92% 16%, 86% 72%, 50% 100%, 14% 72%, 8% 16%)",
  boxShadow: "0 12px 22px rgba(15, 23, 42, 0.14)",
};

const packageShieldTextStyle: React.CSSProperties = {
  fontSize: "10px",
  fontWeight: 950,
  letterSpacing: "0.08em",
  textTransform: "uppercase",
};

const optionTitleStyle: React.CSSProperties = {
  margin: 0,
  fontSize: "22px",
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
  marginTop: "16px",
  fontSize: "35px",
  fontWeight: 950,
  letterSpacing: 0,
  lineHeight: 1.1,
  overflowWrap: "anywhere",
};

const monthlyStyle: React.CSSProperties = {
  fontSize: "15px",
  color: "#047857",
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
  padding: "15px 16px",
  borderRadius: "16px",
  background: "linear-gradient(135deg, rgba(250,204,21,0.10), rgba(255,255,255,0.9))",
  border: "1px solid rgba(180,131,14,0.22)",
  fontSize: "14px",
  color: "#1f2937",
  lineHeight: 1.6,
};

const featuresStyle: React.CSSProperties = {
  marginTop: "16px",
  display: "grid",
  gap: "9px",
  fontSize: "14px",
  color: "#1f2937",
  fontWeight: 700,
  lineHeight: 1.45,
};

const homeownerConfidenceStyle: React.CSSProperties = {
  marginTop: "14px",
  padding: "12px",
  borderRadius: "16px",
  border: "1px solid rgba(15,23,42,0.10)",
  display: "grid",
  gap: "9px",
};

const homeownerConfidenceTitleStyle: React.CSSProperties = {
  margin: 0,
  fontSize: "11px",
  fontWeight: 900,
  letterSpacing: "0.1em",
  textTransform: "uppercase",
};

const homeownerConfidenceGridStyle: React.CSSProperties = {
  display: "grid",
  gap: "7px",
  fontSize: "12px",
  fontWeight: 800,
  lineHeight: 1.35,
};

const selectedTextStyle: React.CSSProperties = {
  color: "#d4af37",
  marginTop: "10px",
  fontSize: "13px",
  fontWeight: 900,
};

const selectButtonStyle: React.CSSProperties = {
  width: "100%",
  marginTop: "18px",
  minHeight: "50px",
  padding: "14px 16px",
  borderRadius: "999px",
  border: "none",
  background: "linear-gradient(90deg, #111827, #020617)",
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
  marginTop: "20px",
  padding: "26px",
  borderRadius: "24px",
  background: "linear-gradient(135deg, #0b1220, #111827)",
  color: "white",
  display: "grid",
  gap: "12px",
  boxShadow: "0 22px 48px rgba(15, 23, 42, 0.28)",
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
  minHeight: "118px",
  marginTop: "14px",
  padding: "16px 18px",
  borderRadius: "16px",
  border: "1px solid #7c8da3",
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
  marginTop: "14px",
  minHeight: "56px",
  padding: "16px 20px",
  borderRadius: "999px",
  border: "none",
  background: "linear-gradient(90deg, #111827, #020617)",
  color: "white",
  fontWeight: 950,
  fontSize: "16px",
  lineHeight: 1.25,
  touchAction: "manipulation",
  WebkitTapHighlightColor: "transparent",
};

const printProposalStyle: React.CSSProperties = {
  padding: "0",
  fontFamily: "Arial, sans-serif",
  color: "#111827",
  background: "#ffffff",
};

const printTitleStyle: React.CSSProperties = {
  margin: "7px 0 0",
  fontSize: "29px",
  fontWeight: 900,
  color: "#111827",
  lineHeight: 1.12,
};

const printHeaderStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  gap: "22px",
  alignItems: "flex-start",
  paddingBottom: "18px",
  borderBottom: "3px solid #d4af37",
};

const printBrandLabelStyle: React.CSSProperties = {
  margin: 0,
  color: "#b68a16",
  fontSize: "12px",
  fontWeight: 900,
  letterSpacing: "0.16em",
  textTransform: "uppercase",
};

const printSubtitleStyle: React.CSSProperties = {
  margin: "7px 0 0",
  color: "#475569",
  fontSize: "12.5px",
  lineHeight: 1.5,
};

const printSystemBadgeStyle: React.CSSProperties = {
  minWidth: "160px",
  padding: "13px 14px",
  borderRadius: "12px",
  border: "1px solid #d4af37",
  background: "#fffbeb",
  textAlign: "center",
};

const printBadgeLabelStyle: React.CSSProperties = {
  margin: 0,
  color: "#92400e",
  fontSize: "10px",
  fontWeight: 900,
  letterSpacing: "0.08em",
  textTransform: "uppercase",
};

const printBadgeValueStyle: React.CSSProperties = {
  margin: "6px 0 0",
  color: "#111827",
  fontSize: "22px",
  fontWeight: 900,
};

const printSectionStyle: React.CSSProperties = {
  marginTop: "16px",
  padding: "15px",
  borderRadius: "12px",
  border: "1px solid #e5e7eb",
  background: "#ffffff",
};

const printSelectedSectionStyle: React.CSSProperties = {
  ...printSectionStyle,
  display: "flex",
  justifyContent: "space-between",
  gap: "18px",
  alignItems: "center",
  border: "1px solid #d4af37",
  background: "#fffbeb",
};

const printSectionTitleStyle: React.CSSProperties = {
  margin: "0 0 9px",
  color: "#92400e",
  fontSize: "11px",
  fontWeight: 900,
  letterSpacing: "0.12em",
  textTransform: "uppercase",
};

const printInfoGridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "1fr 1fr",
  gap: "9px",
};

const printInfoItemStyle: React.CSSProperties = {
  padding: "9px 11px",
  borderRadius: "10px",
  background: "#f8fafc",
  border: "1px solid #e2e8f0",
};

const printInfoLabelStyle: React.CSSProperties = {
  margin: 0,
  color: "#64748b",
  fontSize: "10px",
  fontWeight: 900,
  textTransform: "uppercase",
};

const printInfoValueStyle: React.CSSProperties = {
  margin: "5px 0 0",
  color: "#111827",
  fontSize: "12.5px",
  fontWeight: 800,
  lineHeight: 1.4,
};

const printSelectedTitleStyle: React.CSSProperties = {
  margin: 0,
  color: "#111827",
  fontSize: "23px",
  fontWeight: 900,
  lineHeight: 1.18,
};

const printSelectedMetaStyle: React.CSSProperties = {
  margin: "6px 0 0",
  color: "#475569",
  fontSize: "13px",
  fontWeight: 800,
};

const printSelectedPriceStyle: React.CSSProperties = {
  color: "#111827",
  fontSize: "27px",
  fontWeight: 900,
  whiteSpace: "nowrap",
};

const printOptionsTableStyle: React.CSSProperties = {
  width: "100%",
  borderCollapse: "collapse",
  fontSize: "10.75px",
};

const printTableHeaderStyle: React.CSSProperties = {
  padding: "8px 9px",
  borderBottom: "1px solid #cbd5e1",
  background: "#111827",
  color: "#ffffff",
  textAlign: "left",
  fontWeight: 900,
};

const printTableCellStyle: React.CSSProperties = {
  padding: "8px 9px",
  borderBottom: "1px solid #e5e7eb",
  verticalAlign: "top",
  lineHeight: 1.4,
};

const printSelectedRowStyle: React.CSSProperties = {
  background: "#fffbeb",
  fontWeight: 800,
};

const printBodyTextStyle: React.CSSProperties = {
  margin: 0,
  color: "#334155",
  fontSize: "12.75px",
  lineHeight: 1.6,
};

const printSignatureGridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "1fr 0.55fr",
  gap: "32px 22px",
  marginTop: "44px",
};

const printSignatureLineStyle: React.CSSProperties = {
  borderTop: "1px solid #111827",
  paddingTop: "8px",
};

const printSignatureLabelStyle: React.CSSProperties = {
  margin: 0,
  color: "#475569",
  fontSize: "11px",
  fontWeight: 800,
};
