"use client";

import { useState } from "react";
import { Bell, BookOpen, Briefcase, Calculator, Cpu, Crown, DollarSign, FileText, Home, Layers, Mail, Percent, PlusCircle, Settings, Shield, Thermometer, TrendingUp, Users, Zap } from "lucide-react";
import CustomerProposal from "./components/CustomerProposal";
import LoadCalculator from "./components/LoadCalculator";

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

const getOregonZipMultiplier = (zip: string) => {
  const prefix = zip.trim().slice(0, 3);
  if (/^97\d{3}$/.test(zip.trim())) {
    return oregonZipMultiplierMap[prefix] ?? 1.08;
  }

  return 1.08;
};

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
  const [activeSection, setActiveSection] = useState("Dashboard");

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

  return (
    <div style={appGridStyle}>
      <aside style={sidebarStyle}>
        <div style={sidebarBrandStyle}>
          <div style={sidebarLogoStyle}>
            <IconSvg name="PandaLogo" />
          </div>
          <div>
            <p style={sidebarNameStyle}>PANDA HVAC</p>
          </div>
        </div>

        <nav style={navStyle}>
          {[
            { label: 'Dashboard', icon: 'Dashboard' },
            { label: 'Proposals', icon: 'Proposals' },
            { label: 'Jobs', icon: 'Jobs' },
            { label: 'Load Calculator', icon: 'Load Calculator' },
            { label: 'Tech Hub', icon: 'Tech Hub' },
            { label: 'Manuals', icon: 'Manuals' },
            { label: 'Pricing Options', icon: 'Pricing Options' },
            { label: 'Customers', icon: 'Customers' },
            { label: 'Settings', icon: 'Settings' },
          ].map((item) => {
            const isActive = activeSection === item.label;
            return (
              <button
                key={item.label}
                type="button"
                className="sidebar-nav-item"
                title={item.label}
                onClick={() => setActiveSection(item.label as any)}
                style={{
                  ...navItemStyle,
                  background: isActive ? 'rgba(212,175,55,0.12)' : 'transparent',
                  boxShadow: isActive ? '0 4px 12px rgba(212,175,55,0.2)' : 'none',
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
            <div style={technicianAvatarStyle}>
              <IconSvg name="PandaLogo" />
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
          .sidebar-nav-item:hover {
            transform: translateY(-2px);
            background: rgba(212,175,55,0.08);
            border-color: rgba(212,175,55,0.3);
            color: #f8fafc;
            box-shadow: 0 6px 16px rgba(212,175,55,0.15);
          }
          .sidebar-nav-item:hover .nav-icon {
            background: rgba(212,175,55,0.2);
          }
        
          .quick-action-button:hover {
            transform: translateY(-3px);
            background: rgba(255,255,255,0.06);
            border-color: rgba(212,175,55,0.2);
            box-shadow: 0 12px 28px rgba(212,175,55,0.15), 0 0 20px rgba(212,175,55,0.08);
          }
          .quick-action-button:hover .action-icon-el {
            background: linear-gradient(135deg, rgba(212,175,55,0.3), rgba(212,175,55,0.15)) !important;
            transform: scale(1.05);
            box-shadow: 0 6px 16px rgba(212,175,55,0.2) !important;
          }
        `
      }} />

      <main style={mainStyle}>
        <header style={mainHeaderStyle}>
          <div>
            <p style={welcomeStyle}>Welcome back,</p>
            <div style={pageTitleRowStyle}>
              <h1 style={mainTitleStyle}>Panda HVAC</h1>
              <span style={crownStyle}>
                <IconSvg name="Crown" />
              </span>
            </div>
            <p style={mainSubtitleStyle}>Let's build comfort.</p>
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

        {activeSection === "Dashboard" ? (
          <>
            <div style={metricGridStyle}>
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

            <div style={dashboardGridStyle}>
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
                <div style={quickActionsButtonGridStyle}>
                  {[
                    { title: 'New Proposal', description: 'Build a tailored contract', icon: 'New Proposal' },
                    { title: 'Load Calculator', description: 'Run Manual J estimates', icon: 'Load Calculator' },
                    { title: 'Tech Hub', description: 'Field tools and notes', icon: 'Tech Hub' },
                    { title: 'Manuals', description: 'Specs & installation guides', icon: 'Manuals' },
                    { title: 'Pricing Options', description: 'Compare tiered offers', icon: 'Pricing Options' },
                    { title: 'Customers', description: 'Access customer profiles', icon: 'Customers' },
                  ].map((action) => (
                    <button key={action.title} type="button" className="quick-action-button" style={quickActionButtonStyle}>
                      <div className="action-icon-el" style={actionIconStyle}>
                        <IconSvg name={action.icon} />
                      </div>
                      <div>
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
                  <div style={miniOptionsGridStyle}>
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
                  <button type="button" style={miniViewButtonStyle}>
                    View Full Proposal
                  </button>
                </div>
              </section>
            </div>

            <div style={bottomBannerStyle}>
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
        ) : activeSection === "Proposals" ? (
          <>
            <div style={proposalPageHeaderStyle}>
              <button type="button" style={backButtonStyle} onClick={() => setActiveSection('Dashboard')}>
                ← Back
              </button>
              <div style={proposalPageTitleStyle}>Proposal #P-1007</div>
              <div style={proposalPageActionsStyle}>
                <button type="button" style={iconButtonStyle}>
                  Edit
                </button>
                <button type="button" style={iconButtonStyle}>
                  Share
                </button>
              </div>
            </div>
            <div style={proposalShellStyle}>
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
        ) : activeSection === "Load Calculator" ? (
          <LoadCalculator />
        ) : (
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
  gridTemplateColumns: "220px minmax(0, 1fr)",
  gap: "18px",
  minHeight: "100vh",
  background: "radial-gradient(circle at top left, rgba(212,175,55,0.14), transparent 36%), linear-gradient(180deg, #05060d 0%, #0a101f 100%)",
  padding: "18px",
  color: "#f8fafc",
  maxWidth: "1280px",
  margin: "0 auto",
};

const sidebarStyle: React.CSSProperties = {
  background: "linear-gradient(180deg, rgba(255,255,255,0.05), rgba(255,255,255,0.02))",
  border: "1px solid rgba(255,255,255,0.08)",
  backdropFilter: "blur(24px)",
  borderRadius: "34px",
  padding: "20px 16px",
  display: "grid",
  gap: "20px",
  minHeight: "calc(100vh - 36px)",
  boxShadow: "0 32px 80px rgba(0,0,0,0.24)",
};

const sidebarBrandStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "10px",
};

const sidebarLogoStyle: React.CSSProperties = {
  width: "70px",
  height: "70px",
  borderRadius: "20px",
  background: "linear-gradient(135deg, rgba(212,175,55,0.3), rgba(255,255,255,0.1))",
  border: "1px solid rgba(255,255,255,0.15)",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  fontSize: "26px",
  fontWeight: 800,
  boxShadow: "0 8px 24px rgba(212,175,55,0.25)",
};

const sidebarNameStyle: React.CSSProperties = {
  margin: 0,
  fontWeight: 800,
  letterSpacing: "0.14em",
  fontSize: "18px",
  textTransform: "uppercase",
  color: "#d4af37",
  border: "1px solid rgba(212,175,55,0.15)",
  boxShadow: "0 4px 12px rgba(212,175,55,0.1)",
  transition: "all 0.25s cubic-bezier(0.4, 0, 0.2, 1)",
};

const sidebarRoleStyle: React.CSSProperties = {
  margin: 0,
  color: "#94a3b8",
  fontSize: "13px",
};

const navStyle: React.CSSProperties = {
  display: "grid",
  gap: "10px",
};

const navItemStyle: React.CSSProperties = {
  padding: "8px 12px",
  borderRadius: "16px",
  display: "flex",
  alignItems: "center",
  justifyContent: "flex-start",
  fontWeight: 700,
  cursor: "pointer",
  fontSize: "14px",
  transition: "all 0.2s ease",
  border: "1px solid rgba(255,255,255,0.08)",
  background: "transparent",
  color: "#94a3b8",
};

const navIconStyle: React.CSSProperties = {
  display: "inline-flex",
  width: "28px",
  height: "28px",
  alignItems: "center",
  justifyContent: "center",
  marginRight: "8px",
  borderRadius: "10px",
  background: "rgba(212,175,55,0.12)",
  color: "#d4af37",
  border: "1px solid rgba(212,175,55,0.15)",
  boxShadow: "0 4px 12px rgba(212,175,55,0.1)",
  transition: "all 0.25s cubic-bezier(0.4, 0, 0.2, 1)",
};

const metricIconStyle: React.CSSProperties = {
  width: "48px",
  height: "48px",
  borderRadius: "14px",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  background: "rgba(212,175,55,0.18)",
  color: "#d4af37",
  border: "1px solid rgba(212,175,55,0.15)",
  boxShadow: "0 4px 12px rgba(212,175,55,0.1)",
  transition: "all 0.25s cubic-bezier(0.4, 0, 0.2, 1)",
  fontSize: "18px",
};

const sidebarFooterStyle: React.CSSProperties = {
  display: "grid",
  gap: "6px",
  paddingTop: "16px",
  borderTop: "1px solid rgba(255,255,255,0.08)",
};

const technicianProfileStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "8px",
  padding: "10px",
  background: "rgba(255,255,255,0.04)",
  borderRadius: "16px",
  border: "1px solid rgba(212,175,55,0.15)",
};

const technicianAvatarStyle: React.CSSProperties = {
  width: "28px",
  height: "28px",
  borderRadius: "50%",
  background: "rgba(212,175,55,0.18)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  color: "#d4af37",
  border: "1px solid rgba(212,175,55,0.15)",
  boxShadow: "0 4px 12px rgba(212,175,55,0.1)",
  transition: "all 0.25s cubic-bezier(0.4, 0, 0.2, 1)",
  fontSize: "12px",
  fontWeight: 800,
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
  border: "1px solid rgba(212,175,55,0.15)",
  boxShadow: "0 4px 12px rgba(212,175,55,0.1)",
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
  gap: "16px",
};

const proposalPageHeaderStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: "18px",
  padding: "24px 26px",
  background: "rgba(7, 11, 22, 0.96)",
  borderRadius: "30px 30px 0 0",
  border: "1px solid rgba(255,255,255,0.08)",
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
  background: "rgba(255,255,255,0.04)",
  border: "1px solid rgba(255,255,255,0.08)",
  borderRadius: "28px",
  padding: "18px",
  minHeight: "100px",
  boxShadow: "0 30px 70px rgba(0,0,0,0.18)",
  display: "grid",
  gap: "10px",
};

const metricLabelStyle: React.CSSProperties = {
  margin: 0,
  color: "#94a3b8",
  fontSize: "12px",
  fontWeight: 700,
  textTransform: "uppercase",
  letterSpacing: "0.14em",
};

const metricValueStyle: React.CSSProperties = {
  margin: "14px 0 0",
  fontSize: "26px",
  fontWeight: 800,
  color: "#f8fafc",
};

const sectionHeadingStyle: React.CSSProperties = {
  margin: 0,
  fontSize: "14px",
  fontWeight: 800,
  letterSpacing: "0.14em",
  color: "#f8fafc",
  textTransform: "uppercase",
};

const jobCardStyle: React.CSSProperties = {
  display: "grid",
  gap: "6px",
  padding: "16px",
  borderRadius: "24px",
  background: "rgba(15, 23, 42, 0.92)",
  border: "1px solid rgba(255,255,255,0.08)",
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
  border: "1px solid rgba(212,175,55,0.15)",
  boxShadow: "0 4px 12px rgba(212,175,55,0.1)",
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
  gap: "16px",
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
  gap: "10px",
  marginTop: "12px",
};

const quickActionButtonStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "52px 1fr",
  gap: "12px",
  alignItems: "flex-start",
  width: "100%",
  minHeight: "100px",
  borderRadius: "18px",
  padding: "16px",
  border: "1px solid rgba(255,255,255,0.06)",
  background: "rgba(255,255,255,0.02)",
  color: "#f8fafc",
  textAlign: "left",
  cursor: "pointer",
  transition: "all 0.25s cubic-bezier(0.4, 0, 0.2, 1)",
};

const quickActionTitleStyle: React.CSSProperties = {
  margin: 0,
  fontSize: "16px",
  fontWeight: 800,
  color: "#f8fafc",
};

const quickActionDescStyle: React.CSSProperties = {
  margin: "4px 0 0",
  color: "#94a3b8",
  fontSize: "13px",
  lineHeight: 1.55,
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
  border: "1px solid rgba(212,175,55,0.15)",
  boxShadow: "0 4px 12px rgba(212,175,55,0.1)",
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
  background: "rgba(255,255,255,0.04)",
  border: "1px solid rgba(255,255,255,0.08)",
  borderRadius: "16px",
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
  border: "1px solid rgba(212,175,55,0.15)",
  boxShadow: "0 4px 12px rgba(212,175,55,0.1)",
  transition: "all 0.25s cubic-bezier(0.4, 0, 0.2, 1)",
};

const miniViewButtonStyle: React.CSSProperties = {
  padding: "10px 16px",
  borderRadius: "20px",
  border: "1px solid rgba(212,175,55,0.3)",
  background: "rgba(212,175,55,0.1)",
  color: "#d4af37",
  border: "1px solid rgba(212,175,55,0.15)",
  boxShadow: "0 4px 12px rgba(212,175,55,0.1)",
  transition: "all 0.25s cubic-bezier(0.4, 0, 0.2, 1)",
  fontWeight: 700,
  fontSize: "13px",
  cursor: "pointer",
  transition: "all 0.2s ease",
};

const sectionCardStyle: React.CSSProperties = {
  background: "rgba(255,255,255,0.04)",
  border: "1px solid rgba(255,255,255,0.08)",
  borderRadius: "32px",
  padding: "20px",
  display: "grid",
  gap: "16px",
  boxShadow: "0 26px 60px rgba(0,0,0,0.2)",
};

const actionCardStyle: React.CSSProperties = {
  padding: "18px",
  borderRadius: "28px",
  background: "rgba(255,255,255,0.04)",
  border: "1px solid rgba(255,255,255,0.08)",
  boxShadow: "0 22px 56px rgba(0,0,0,0.2)",
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
  width: "48px",
  height: "48px",
  borderRadius: "16px",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  background: "linear-gradient(135deg, rgba(212,175,55,0.2), rgba(212,175,55,0.1))",
  color: "#d4af37",
  border: "1px solid rgba(212,175,55,0.15)",
  boxShadow: "0 4px 12px rgba(212,175,55,0.1)",
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
  alignItems: "flex-start",
  gap: "16px",
  flexWrap: "wrap",
};

const welcomeStyle: React.CSSProperties = {
  margin: 0,
  color: "#94a3b8",
  fontSize: "18px",
};

const mainTitleStyle: React.CSSProperties = {
  margin: "8px 0 0",
  fontSize: "44px",
  fontWeight: 800,
  letterSpacing: "-0.05em",
};

const mainSubtitleStyle: React.CSSProperties = {
  margin: "8px 0 0",
  color: "#94a3b8",
  fontSize: "18px",
};

const bellStyle: React.CSSProperties = {
  width: "48px",
  height: "48px",
  borderRadius: "16px",
  background: "rgba(255,255,255,0.08)",
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

const pageTitleRowStyle: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: "10px",
};

const zipRowStyle: React.CSSProperties = {
  marginTop: "16px",
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
  borderRadius: "14px",
  border: "1px solid rgba(148,163,184,0.24)",
  background: "rgba(15,23,42,0.9)",
  color: "#f8fafc",
  fontWeight: 700,
};

const zipBadgeStyle: React.CSSProperties = {
  padding: "8px 12px",
  borderRadius: "9999px",
  background: "rgba(255,255,255,0.08)",
  color: "#94a3b8",
  fontSize: "13px",
  fontWeight: 700,
};

const crownStyle: React.CSSProperties = {
  fontSize: "22px",
};

const dashboardSummaryStyle: React.CSSProperties = {
  margin: 0,
  color: "#94a3b8",
  fontSize: "16px",
  lineHeight: 1.7,
};

const proposalShellStyle: React.CSSProperties = {
  borderRadius: "32px",
  overflow: "hidden",
  background: "rgba(15, 23, 42, 1)",
  border: "1px solid rgba(255,255,255,0.08)",
  padding: "0",
  boxShadow: "0 35px 60px rgba(0,0,0,0.18)",
};

const bannerTextWrapperStyle: React.CSSProperties = {
  display: "grid",
  gap: "12px",
};

const bannerTagStyle: React.CSSProperties = {
  margin: 0,
  color: "#d4af37",
  border: "1px solid rgba(212,175,55,0.15)",
  boxShadow: "0 4px 12px rgba(212,175,55,0.1)",
  transition: "all 0.25s cubic-bezier(0.4, 0, 0.2, 1)",
  fontWeight: 800,
  letterSpacing: "0.16em",
  textTransform: "uppercase",
};

const bannerTitleStyle: React.CSSProperties = {
  margin: 0,
  fontSize: "28px",
  fontWeight: 800,
  lineHeight: 1.15,
  color: "#111827",
};

const bottomBannerStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "1.2fr 0.8fr",
  gap: "20px",
  padding: "24px",
  background: "rgba(255,255,255,0.04)",
  border: "1px solid rgba(255,255,255,0.08)",
  borderRadius: "32px",
  boxShadow: "0 30px 70px rgba(0,0,0,0.22)",
};

const planBadgeGridStyle: React.CSSProperties = {
  display: "grid",
  gap: "14px",
};

const planBadgeStyle: React.CSSProperties = {
  background: "rgba(255,255,255,0.06)",
  borderRadius: "24px",
  padding: "22px",
  border: "1px solid rgba(255,255,255,0.08)",
};

const planLabelStyle: React.CSSProperties = {
  margin: 0,
  color: "#d4af37",
  border: "1px solid rgba(212,175,55,0.15)",
  boxShadow: "0 4px 12px rgba(212,175,55,0.1)",
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
