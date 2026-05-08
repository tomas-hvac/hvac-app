"use client";

import { useEffect, useMemo, useState } from "react";
import { Calculator, Home, Thermometer, Wind, Layers, Users, Droplet, Sparkles, SunMedium } from "lucide-react";
import { calculateManualJLoad, ManualJInputs } from "../lib/manualJCalculations";

type Option = { label: string; value: string };

type InputFieldProps = {
  icon: React.ReactNode;
  title: string;
  description: string;
  children: React.ReactNode;
};

const InputField = ({ icon, title, description, children }: InputFieldProps) => (
  <div style={inputFieldStyle}>
    <div style={inputFieldHeaderStyle}>
      <div style={inputFieldIconStyle}>{icon}</div>
      <div>
        <p style={inputFieldTitleStyle}>{title}</p>
        <p style={inputFieldDescriptionStyle}>{description}</p>
      </div>
    </div>
    {children}
  </div>
);

export default function LoadCalculator() {
  const [squareFeet, setSquareFeet] = useState("2200");
  const [ceilingHeight, setCeilingHeight] = useState("9");
  const [insulationQuality, setInsulationQuality] = useState("Average");
  const [windowCount, setWindowCount] = useState("15");
  const [windowEfficiency, setWindowEfficiency] = useState("Standard");
  const [climateZone, setClimateZone] = useState("Zone 4");
  const [numberOfRooms, setNumberOfRooms] = useState("6");
  const [homeAge, setHomeAge] = useState("Modern");
  const [ductLocation, setDuctLocation] = useState("Attic");
  const [occupancy, setOccupancy] = useState("3 People");
  const [isCalculating, setIsCalculating] = useState(false);
  const [animateResults, setAnimateResults] = useState(false);

  const options = {
    insulation: [
      { label: "Poor", value: "Poor" },
      { label: "Average", value: "Average" },
      { label: "Good", value: "Good" },
      { label: "Excellent", value: "Excellent" },
    ],
    windowEfficiency: [
      { label: "Drafty", value: "Drafty" },
      { label: "Standard", value: "Standard" },
      { label: "Low-E", value: "Low-E" },
      { label: "Passive", value: "Passive" },
    ],
    climateZones: [
      { label: "Zone 1", value: "Zone 1" },
      { label: "Zone 2", value: "Zone 2" },
      { label: "Zone 3", value: "Zone 3" },
      { label: "Zone 4", value: "Zone 4" },
      { label: "Zone 5", value: "Zone 5" },
    ],
    homeAge: [
      { label: "New", value: "New" },
      { label: "Modern", value: "Modern" },
      { label: "Old", value: "Old" },
    ],
    ductLocation: [
      { label: "Attic", value: "Attic" },
      { label: "Crawl Space", value: "Crawl Space" },
      { label: "Conditioned", value: "Conditioned" },
    ],
    occupancy: [
      { label: "1-2 People", value: "1-2 People" },
      { label: "3 People", value: "3 People" },
      { label: "4-5 People", value: "4-5 People" },
      { label: "6+ People", value: "6+ People" },
    ],
  };

  const result = useMemo(() => {
    const inputs: ManualJInputs = {
      squareFeet: Math.max(0, parseInt(squareFeet, 10) || 0),
      ceilingHeight: Math.max(6, parseInt(ceilingHeight, 10) || 6),
      insulationQuality,
      windowCount: Math.max(0, parseInt(windowCount, 10) || 0),
      windowEfficiency,
      climateZone,
      numberOfRooms: Math.max(1, parseInt(numberOfRooms, 10) || 1),
      homeAge,
      ductLocation,
      occupancy,
    };

    return calculateManualJLoad(inputs);
  }, [squareFeet, ceilingHeight, insulationQuality, windowCount, windowEfficiency, climateZone, numberOfRooms, homeAge, ductLocation, occupancy]);

  const [displayedResult, setDisplayedResult] = useState(result);

  const snapshotSummary = useMemo(() => {
    const sqft = Math.max(0, parseInt(squareFeet, 10) || 0);
    const windows = Math.max(0, parseInt(windowCount, 10) || 0);
    const rooms = Math.max(1, parseInt(numberOfRooms, 10) || 1);
    const [minTon, maxTon] = result.recommendedTonnage
  .split("–")
  .map((value) => parseFloat(value.replace(/[^\d.]/g, "")) || 0);

const averageTonnage = (minTon + maxTon) / 2;

    const recommendationTone = averageTonnage >= 4.0
      ? "High"
      : averageTonnage <= 2.2
      ? "Conservative"
      : "Balanced";

    const sizePhrase = sqft >= 3000
      ? "large conditioned area"
      : sqft >= 2000
      ? "mid-size home"
      : "smaller footprint";

    const insulationPhrase = insulationQuality === "Excellent"
      ? "Excellent insulation keeps demand down"
      : insulationQuality === "Good"
      ? "Good insulation helps control load"
      : insulationQuality === "Average"
      ? "Average insulation keeps demand moderate"
      : "Poor insulation increases load";

    const windowPhrase = windowEfficiency === "Drafty"
      ? "Drafty windows increase heat transfer"
      : windowEfficiency === "Standard"
      ? "Standard glazing adds moderate load"
      : `High-performance ${windowEfficiency.toLowerCase()} windows help reduce gain`;

    const countPhrase = windows > 12
      ? "window count raises demand"
      : "window count is controlled";

    const ductPhrase = ductLocation === "Conditioned"
      ? "Conditioned ducts reduce distribution losses"
      : `Verify ${ductLocation.toLowerCase()} ducts to avoid additional system loss`;

    const loadPhrase = recommendationTone === "High"
      ? `High recommendation for a ${homeAge.toLowerCase()} home with ${sizePhrase}`
      : recommendationTone === "Conservative"
      ? `Conservative recommendation for a ${homeAge.toLowerCase()} home with ${sizePhrase}`
      : `Balanced recommendation for a ${homeAge.toLowerCase()} home with ${sizePhrase}`;

    return `${loadPhrase}. ${insulationPhrase}, ${countPhrase}, and ${sqft > 2200 ? "square footage increases demand" : "square footage keeps the load moderate"}. ${ductPhrase}. ${result.confidenceExplanation}`;
  }, [squareFeet, windowCount, numberOfRooms, insulationQuality, windowEfficiency, ductLocation, homeAge, result]);

  useEffect(() => {
    setDisplayedResult(result);
  }, [result]);

  const handleCalculate = () => {
    setIsCalculating(true);
    setAnimateResults(false);
    window.setTimeout(() => {
      setDisplayedResult(result);
      setIsCalculating(false);
      setAnimateResults(true);
      window.setTimeout(() => setAnimateResults(false), 500);
    }, 520);
  };

  return (
    <div style={calcPageStyle}>
      <div style={calcHeaderStyle}>
        <div style={calcTitleWrapperStyle}>
          <div style={calcIconStyle}>
            <Calculator size={20} strokeWidth={1.8} />
          </div>
          <div>
            <p style={calcEyebrowStyle}>Load Calculation</p>
            <h2 style={calcTitleStyle}>HVAC Manual J workflow</h2>
            <p style={calcSubtitleStyle}>Enter project details and get a premium load estimate for every job.</p>
          </div>
        </div>
        <button type="button" className="calc-action-button" style={calcActionButtonStyle} onClick={handleCalculate}>
          {isCalculating ? "Calculating..." : "Calculate Load"}
        </button>
      </div>

      <style dangerouslySetInnerHTML={{
        __html: `
          .load-input, .load-select {
            transition: border-color 0.25s ease, box-shadow 0.25s ease, background 0.25s ease;
          }

          .load-input:focus,
          .load-select:focus {
            outline: none;
            border-color: rgba(212,175,55,0.5);
            box-shadow: 0 0 0 4px rgba(212,175,55,0.12);
            background: rgba(255,255,255,0.06);
          }

          .calc-action-button {
            transition: transform 0.25s ease, box-shadow 0.25s ease, background 0.25s ease;
          }

          .calc-action-button:hover {
            transform: translateY(-2px);
            box-shadow: 0 18px 35px rgba(212,175,55,0.18);
            background: rgba(212,175,55,0.2);
          }

          .result-card {
            transition: transform 0.3s ease, opacity 0.35s ease, box-shadow 0.3s ease;
            opacity: 0.92;
            transform: translateY(0px);
          }

          .result-card-active {
            opacity: 1;
            transform: translateY(-3px);
            box-shadow: 0 24px 60px rgba(0,0,0,0.22);
          }

          .result-card-loading {
            position: relative;
            overflow: hidden;
          }

          .result-card-loading::after {
            content: "";
            position: absolute;
            inset: 0;
            background: linear-gradient(110deg, rgba(255,255,255,0.03) 0%, rgba(255,255,255,0.08) 50%, rgba(255,255,255,0.03) 100%);
            animation: shimmer 1.1s ease-in-out infinite;
          }

          @keyframes shimmer {
            0% { transform: translateX(-100%); }
            100% { transform: translateX(100%); }
          }
        `
      }} />
      <div style={calcGridStyle}>
        <div style={leftColumnStyle}>
          <div style={sectionPanelStyle}>
            <div style={sectionPanelHeaderStyle}>
              <div style={sectionPanelIconStyle}>
                <Home size={18} strokeWidth={1.8} />
              </div>
              <div>
                <p style={sectionPanelTitleStyle}>Project Details</p>
                <p style={sectionPanelDescriptionStyle}>Basic building inputs for load sizing.</p>
              </div>
            </div>

            <div style={inputGridStyle}>
              <InputField
                icon={<Thermometer size={18} strokeWidth={1.8} />}
                title="Square Footage"
                description="Total heated area"
              >
                <input
                  className="load-input"
                  type="number"
                  value={squareFeet}
                  onChange={(e) => setSquareFeet(e.target.value)}
                  style={inputControlStyle}
                />
              </InputField>

              <InputField
                icon={<Wind size={18} strokeWidth={1.8} />}
                title="Ceiling Height"
                description="Average ceiling height"
              >
                <input
                  className="load-input"
                  type="number"
                  step="0.5"
                  value={ceilingHeight}
                  onChange={(e) => setCeilingHeight(e.target.value)}
                  style={inputControlStyle}
                />
              </InputField>

              <InputField
                icon={<Layers size={18} strokeWidth={1.8} />}
                title="Number of Rooms"
                description="Total conditioned rooms"
              >
                <input
                  className="load-input"
                  type="number"
                  value={numberOfRooms}
                  onChange={(e) => setNumberOfRooms(e.target.value)}
                  style={inputControlStyle}
                />
              </InputField>

              <InputField
                icon={<SunMedium size={18} strokeWidth={1.8} />}
                title="Home Age"
                description="Construction era"
              >
                <select className="load-select" value={homeAge} onChange={(e) => setHomeAge(e.target.value)} style={selectControlStyle}>
                  {options.homeAge.map((option) => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </select>
              </InputField>
            </div>
          </div>

          <div style={sectionPanelStyle}>
            <div style={sectionPanelHeaderStyle}>
              <div style={sectionPanelIconStyle}>
                <Droplet size={18} strokeWidth={1.8} />
              </div>
              <div>
                <p style={sectionPanelTitleStyle}>Thermal Envelope</p>
                <p style={sectionPanelDescriptionStyle}>Insulation, windows and climate inputs.</p>
              </div>
            </div>

            <div style={inputGridStyle}>
              <InputField
                icon={<Layers size={18} strokeWidth={1.8} />}
                title="Insulation Quality"
                description="Thermal resistance"
              >
                <select className="load-select" value={insulationQuality} onChange={(e) => setInsulationQuality(e.target.value)} style={selectControlStyle}>
                  {options.insulation.map((option) => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </select>
              </InputField>

              <InputField
                icon={<Home size={18} strokeWidth={1.8} />}
                title="Window Count"
                description="Total glazed openings"
              >
                <input
                  className="load-input"
                  type="number"
                  value={windowCount}
                  onChange={(e) => setWindowCount(e.target.value)}
                  style={inputControlStyle}
                />
              </InputField>

              <InputField
                icon={<Sparkles size={18} strokeWidth={1.8} />}
                title="Window Efficiency"
                description="Frame and glazing quality"
              >
                <select className="load-select" value={windowEfficiency} onChange={(e) => setWindowEfficiency(e.target.value)} style={selectControlStyle}>
                  {options.windowEfficiency.map((option) => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </select>
              </InputField>

              <InputField
                icon={<SunMedium size={18} strokeWidth={1.8} />}
                title="Climate Zone"
                description="Regional heating/cooling demand"
              >
                <select className="load-select" value={climateZone} onChange={(e) => setClimateZone(e.target.value)} style={selectControlStyle}>
                  {options.climateZones.map((option) => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </select>
              </InputField>
            </div>
          </div>

          <div style={sectionPanelStyle}>
            <div style={sectionPanelHeaderStyle}>
              <div style={sectionPanelIconStyle}>
                <Users size={18} strokeWidth={1.8} />
              </div>
              <div>
                <p style={sectionPanelTitleStyle}>Operating Conditions</p>
                <p style={sectionPanelDescriptionStyle}>Occupancy and duct strategy.</p>
              </div>
            </div>

            <div style={inputGridStyle}>
              <InputField
                icon={<Wind size={18} strokeWidth={1.8} />}
                title="Duct Location"
                description="Where ducts are installed"
              >
                <select className="load-select" value={ductLocation} onChange={(e) => setDuctLocation(e.target.value)} style={selectControlStyle}>
                  {options.ductLocation.map((option) => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </select>
              </InputField>

              <InputField
                icon={<Users size={18} strokeWidth={1.8} />}
                title="Occupancy"
                description="Average house occupancy"
              >
                <select className="load-select" value={occupancy} onChange={(e) => setOccupancy(e.target.value)} style={selectControlStyle}>
                  {options.occupancy.map((option) => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </select>
              </InputField>
            </div>
          </div>
        </div>

        <div style={rightColumnStyle}>
          <div style={resultHeaderCardStyle}>
            <div>
              <p style={resultHeaderLabelStyle}>Estimate Snapshot</p>
              <h3 style={resultHeaderTitleStyle}>Instant recommendations</h3>
             <p style={resultHeaderTextStyle}>
  Review the load estimate and refine inputs as needed for each job.
</p>

<p style={resultSummaryStyle}>
  {snapshotSummary}
</p>
            </div>
            <div style={resultScoreBadgeStyle}>Premium</div>
          </div>

          <div style={resultGridStyle}>
            {[
              {
                icon: <Calculator size={18} strokeWidth={1.8} />,
                label: "Estimated BTU Load",
                value: isCalculating ? "Loading..." : displayedResult.estimatedBTU.toLocaleString(),
              },
              {
                icon: <Thermometer size={18} strokeWidth={1.8} />,
                label: "Recommended Tonnage",
                value: isCalculating ? "Loading..." : displayedResult.recommendedTonnage,
              },
              {
                icon: <Wind size={18} strokeWidth={1.8} />,
                label: "Airflow Range",
                value: isCalculating ? "Loading..." : displayedResult.airflow,
              },
              {
                icon: <Sparkles size={18} strokeWidth={1.8} />,
                label: "Confidence Score",
                value: isCalculating ? "Loading..." : displayedResult.confidence,
                detail: isCalculating ? "" : displayedResult.confidenceExplanation,
              },
              {
                icon: <SunMedium size={18} strokeWidth={1.8} />,
                label: "Why this system size",
                value: isCalculating ? "Loading..." : "See summary below",
                detail: isCalculating ? "" : displayedResult.whyText,
              },
            ].map((card) => (
              <div
                key={card.label}
                className={`result-card ${animateResults ? "result-card-active" : ""} ${isCalculating ? "result-card-loading" : ""}`}
                style={resultCardStyle}
              >
                <div style={resultCardIconStyle}>{card.icon}</div>
                <p style={resultCardLabelStyle}>{card.label}</p>
                <p style={resultCardValueStyle}>{card.value}</p>
                {card.detail ? <p style={resultCardDetailStyle}>{card.detail}</p> : null}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

const calcPageStyle: React.CSSProperties = {
  display: "grid",
  gap: "24px",
};

const calcHeaderStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: "20px",
  padding: "26px 28px",
  background: "rgba(15, 23, 42, 0.96)",
  borderRadius: "28px",
  border: "1px solid rgba(255,255,255,0.08)",
  boxShadow: "0 24px 60px rgba(0,0,0,0.22)",
};

const calcTitleWrapperStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "16px",
};

const calcIconStyle: React.CSSProperties = {
  width: "50px",
  height: "50px",
  borderRadius: "18px",
  display: "grid",
  placeItems: "center",
  background: "rgba(212,175,55,0.12)",
  border: "1px solid rgba(212,175,55,0.2)",
  color: "#d4af37",
};

const calcEyebrowStyle: React.CSSProperties = {
  margin: 0,
  color: "#d4af37",
  fontSize: "12px",
  letterSpacing: "0.2em",
  textTransform: "uppercase",
  fontWeight: 900,
};

const calcTitleStyle: React.CSSProperties = {
  margin: "8px 0 0",
  fontSize: "24px",
  fontWeight: 900,
  color: "#f8fafc",
};

const calcSubtitleStyle: React.CSSProperties = {
  margin: "8px 0 0",
  color: "#cbd5e1",
  fontSize: "14px",
  maxWidth: "560px",
};

const calcActionButtonStyle: React.CSSProperties = {
  padding: "14px 22px",
  borderRadius: "18px",
  border: "1px solid rgba(212,175,55,0.28)",
  background: "rgba(212,175,55,0.16)",
  color: "#f8fafc",
  fontWeight: 900,
  cursor: "pointer",
  transition: "all 0.2s ease",
};

const calcGridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "1.35fr 0.85fr",
  gap: "24px",
};

const leftColumnStyle: React.CSSProperties = {
  display: "grid",
  gap: "20px",
};

const rightColumnStyle: React.CSSProperties = {
  display: "grid",
  gap: "20px",
};

const sectionPanelStyle: React.CSSProperties = {
  background: "rgba(15, 23, 42, 0.94)",
  border: "1px solid rgba(255,255,255,0.08)",
  borderRadius: "28px",
  padding: "22px",
  boxShadow: "0 28px 70px rgba(0,0,0,0.22)",
  display: "grid",
  gap: "18px",
};

const sectionPanelHeaderStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "14px",
};

const sectionPanelIconStyle: React.CSSProperties = {
  width: "42px",
  height: "42px",
  borderRadius: "16px",
  display: "grid",
  placeItems: "center",
  background: "rgba(212,175,55,0.14)",
  color: "#d4af37",
};

const sectionPanelTitleStyle: React.CSSProperties = {
  margin: 0,
  fontSize: "15px",
  fontWeight: 900,
  color: "#f8fafc",
};

const sectionPanelDescriptionStyle: React.CSSProperties = {
  margin: "6px 0 0",
  color: "#94a3b8",
  fontSize: "13px",
};

const inputGridStyle: React.CSSProperties = {
  display: "grid",
  gap: "14px",
};

const inputFieldStyle: React.CSSProperties = {
  display: "grid",
  gap: "10px",
  padding: "16px",
  borderRadius: "22px",
  background: "rgba(255,255,255,0.03)",
  border: "1px solid rgba(255,255,255,0.08)",
};

const inputFieldHeaderStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "12px",
};

const inputFieldIconStyle: React.CSSProperties = {
  width: "34px",
  height: "34px",
  borderRadius: "14px",
  display: "grid",
  placeItems: "center",
  background: "rgba(212,175,55,0.14)",
  color: "#d4af37",
};

const inputFieldTitleStyle: React.CSSProperties = {
  margin: 0,
  fontWeight: 900,
  fontSize: "14px",
  color: "#f8fafc",
};

const inputFieldDescriptionStyle: React.CSSProperties = {
  margin: 0,
  fontSize: "12px",
  color: "#94a3b8",
};

const inputControlStyle: React.CSSProperties = {
  width: "100%",
  padding: "12px 14px",
  borderRadius: "14px",
  border: "1px solid rgba(255,255,255,0.12)",
  background: "rgba(10, 13, 24, 0.96)",
  color: "#f8fafc",
  fontSize: "14px",
};

const selectControlStyle: React.CSSProperties = {
  ...inputControlStyle,
  appearance: "none",
};

const resultHeaderCardStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "flex-start",
  gap: "16px",
  padding: "22px",
  borderRadius: "28px",
  background: "rgba(15, 23, 42, 0.94)",
  border: "1px solid rgba(255,255,255,0.08)",
  boxShadow: "0 28px 70px rgba(0,0,0,0.22)",
};

const resultHeaderLabelStyle: React.CSSProperties = {
  margin: 0,
  color: "#d4af37",
  fontSize: "12px",
  letterSpacing: "0.18em",
  textTransform: "uppercase",
  fontWeight: 900,
};

const resultHeaderTitleStyle: React.CSSProperties = {
  margin: "8px 0 0",
  fontSize: "20px",
  fontWeight: 900,
  color: "#f8fafc",
};

const resultHeaderTextStyle: React.CSSProperties = {
  margin: "10px 0 0",
  color: "#cbd5e1",
  fontSize: "13px",
  maxWidth: "420px",
};

const resultSummaryStyle: React.CSSProperties = {
  margin: "12px 0 0",
  color: "#cbd5e1",
  fontSize: "13px",
  lineHeight: 1.6,
  maxWidth: "420px",
};

const resultScoreBadgeStyle: React.CSSProperties = {
  marginTop: "4px",
  padding: "10px 16px",
  borderRadius: "999px",
  background: "rgba(212,175,55,0.12)",
  color: "#d4af37",
  fontWeight: 900,
  fontSize: "12px",
};

const resultGridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "1fr",
  gap: "16px",
};

const resultCardStyle: React.CSSProperties = {
  padding: "22px",
  borderRadius: "24px",
  background: "rgba(10, 13, 24, 0.96)",
  border: "1px solid rgba(255,255,255,0.08)",
  boxShadow: "0 20px 50px rgba(0,0,0,0.22)",
  display: "grid",
  gap: "10px",
};

const resultCardIconStyle: React.CSSProperties = {
  width: "40px",
  height: "40px",
  borderRadius: "14px",
  display: "grid",
  placeItems: "center",
  background: "rgba(212,175,55,0.14)",
  color: "#d4af37",
};

const resultCardLabelStyle: React.CSSProperties = {
  margin: 0,
  color: "#94a3b8",
  fontSize: "13px",
  fontWeight: 800,
  textTransform: "uppercase",
  letterSpacing: "0.12em",
};

const resultCardValueStyle: React.CSSProperties = {
  margin: 0,
  color: "#f8fafc",
  fontSize: "26px",
  fontWeight: 900,
};

const resultCardDetailStyle: React.CSSProperties = {
  margin: "10px 0 0",
  color: "#cbd5e1",
  fontSize: "13px",
  lineHeight: 1.5,
};
