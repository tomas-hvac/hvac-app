const defaultSettings = {
  businessName: "Panda's Heating & Cooling",
  tagline: "Comfort made easy",
  plan1Name: "Essential Air Plan",
  plan1Price: "$12 / month",
  plan2Name: "Comfort Air Plan",
  plan2Price: "$22 / month",
  plan3Name: "Pure Air Plan",
  plan3Price: "$39 / month"
};

function getSettings() {
  const saved = localStorage.getItem("pandaAdminSettings");
  return saved ? JSON.parse(saved) : defaultSettings;
}

function applySettings() {
  const settings = getSettings();
  document.getElementById("businessName").textContent = settings.businessName;
  document.getElementById("tagline").textContent = settings.tagline;
  document.getElementById("plan1Name").textContent = settings.plan1Name;
  document.getElementById("plan1Price").textContent = settings.plan1Price;
  document.getElementById("plan2Name").textContent = settings.plan2Name;
  document.getElementById("plan2Price").textContent = settings.plan2Price;
  document.getElementById("plan3Name").textContent = settings.plan3Name;
  document.getElementById("plan3Price").textContent = settings.plan3Price;
}

function calculateEstimate() {
  const homeSize = document.getElementById("homeSize").value;
  const systemType = document.getElementById("systemType").value;
  const ductwork = document.getElementById("ductwork").value;

  let low = 5500;
  let high = 7600;

  if (homeSize === "medium") { low += 1300; high += 1900; }
  if (homeSize === "large") { low += 2800; high += 3600; }
  if (systemType === "full") { low += 1500; high += 2200; }
  if (ductwork === "yes") { low += 1000; high += 1700; }

  document.getElementById("estimateOutput").textContent =
    `$${low.toLocaleString()} – $${high.toLocaleString()}`;
}

function calculateCoolingLoad() {
  const sqft = Number(document.getElementById("coolSqft").value);
  const insulation = document.getElementById("coolInsulation").value;
  const windows = document.getElementById("coolWindows").value;

  if (!sqft) {
    document.getElementById("coolingResult").textContent = "Enter square footage";
    return;
  }

  let btuPerSqft = 20;
  if (insulation === "tight") btuPerSqft -= 2;
  if (insulation === "poor") btuPerSqft += 4;
  if (windows === "medium") btuPerSqft += 2;
  if (windows === "high") btuPerSqft += 5;

  const totalBTU = Math.round(sqft * btuPerSqft);
  const tons = (totalBTU / 12000).toFixed(2);

  document.getElementById("coolingResult").textContent =
    `${totalBTU.toLocaleString()} BTU/hr • ${tons} tons`;
}

function calculateHeatingLoad() {
  const sqft = Number(document.getElementById("heatSqft").value);
  const insulation = document.getElementById("heatInsulation").value;
  const climate = document.getElementById("heatClimate").value;

  if (!sqft) {
    document.getElementById("heatingResult").textContent = "Enter square footage";
    return;
  }

  let btuPerSqft = 30;
  if (insulation === "tight") btuPerSqft -= 4;
  if (insulation === "poor") btuPerSqft += 6;
  if (climate === "moderate") btuPerSqft += 5;
  if (climate === "cold") btuPerSqft += 10;

  const totalBTU = Math.round(sqft * btuPerSqft);

  document.getElementById("heatingResult").textContent =
    `${totalBTU.toLocaleString()} BTU/hr`;
}

function sendLead() {
  const name = document.getElementById("leadName").value.trim();
  const phone = document.getElementById("leadPhone").value.trim();
  const email = document.getElementById("leadEmail").value.trim();
  const notes = document.getElementById("leadNotes").value.trim();

  const subject = encodeURIComponent("New Panda HVAC Request");
  const body = encodeURIComponent(
    `Name: ${name}\nPhone: ${phone}\nEmail: ${email}\nNotes: ${notes}`
  );

  window.location.href = `mailto:theahvacguy@gmail.com?subject=${subject}&body=${body}`;
}

applySettings();
calculateEstimate();