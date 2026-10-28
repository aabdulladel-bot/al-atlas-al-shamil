// الرحلات السردية: خطوات تتقدّم بالتالي، ولكل خطوة حدود سنة وكاميرا وشواهد على الخريطة.
// كل نص تاريخي في الصندوق يأتي من web/data/journeys/{id}.json، وهو مولَّد من السُّنن والادعاءات الموثّقة
// بـ scripts/build_journeys.mjs؛ والجمل فقط مكتوبة في ملف الرحلة.
const journeyBox = document.getElementById("journey-box");
const journeyListEl = document.getElementById("journey-list");
let journeyState = null; // { journey, index }
let journeyToken = 0; // يُبطل أي خطوة متأخرة إن نُقر زر آخر قبل انتهاء التحميل

async function loadJourneyIndex() {
  let list;
  try { list = await getJson("data/journeys/index.json"); } catch (err) { journeyListEl.textContent = `تعذّر تحميل الرحلات: ${err.message}`; return; }
  journeyListEl.replaceChildren(...list.map((j) => {
    const b = document.createElement("button");
    b.type = "button";
    b.dataset.journey = j.id;
    b.setAttribute("aria-pressed", "false");
    b.textContent = j.title;
    b.addEventListener("click", () => startJourney(j.id));
    return b;
  }));
}

async function startJourney(id) {
  let journey;
  try { journey = await getJson(`data/journeys/${id}.json`); } catch (err) { journeyBox.hidden = false; journeyBox.textContent = `تعذّر تحميل الرحلة: ${err.message}`; return; }
  journeyState = { journey, index: 0 };
  for (const b of journeyListEl.querySelectorAll("button")) b.setAttribute("aria-pressed", String(b.dataset.journey === id));
  journeyBox.hidden = false;
  await showJourneyStep();
}

function endJourney() {
  journeyToken++;
  journeyState = null;
  journeyBox.hidden = true;
  if (claimPoints) showClaimPoints(false);
  for (const b of journeyListEl.querySelectorAll("button")) b.setAttribute("aria-pressed", "false");
}

async function showJourneyStep() {
  const token = ++journeyToken;
  const { journey, index } = journeyState;
  const st = journey.steps[index];
  renderJourneyBox(journey, st, index);
  await loadBorders(st.border);
  if (token !== journeyToken) return;
  const ids = st.items.filter((it) => it.id).map((it) => it.id);
  if (ids.length && await ensureClaimPoints()) {
    if (token !== journeyToken) return;
    showClaimPoints(true, ["any", ...ids.map((id) => ["in", `,${id},`, ["get", "claim_ids"]])]);
  } else if (claimPoints) {
    showClaimPoints(false);
  }
  moveJourneyCamera(st.camera);
}

function moveJourneyCamera(cam) {
  if (cam.bbox) {
    map.fitBounds([[cam.bbox[0], cam.bbox[1]], [cam.bbox[2], cam.bbox[3]]], { padding: fitPadding(), maxZoom: 5.5, pitch: 40, duration: 1800 });
  } else if (cam.point) {
    map.flyTo({ center: cam.point, zoom: 4.5, pitch: 40, duration: 1800 });
  } else {
    map.flyTo({ center: [30, 20], zoom: 1.6, pitch: 0, duration: 1800 });
  }
}

function renderJourneyBox(journey, st, index) {
  const total = journey.steps.length;
  const num = (n) => n.toLocaleString("ar");
  journeyBox.innerHTML = `
    <div class="jb-head"><span class="jb-count">${num(index + 1)} من ${num(total)}</span><button type="button" data-act="exit">إنهاء</button></div>
    <h2 class="jb-title">${escapeHtml(st.title)}</h2>
    <p class="jb-frame">${escapeHtml(st.frame)}</p>
    <div class="jb-items">${st.items.map(journeyItemHtml).join("")}</div>
    <div class="jb-nav"><button type="button" data-act="prev"${index === 0 ? " disabled" : ""}>السابق</button><button type="button" data-act="next"${index === total - 1 ? " disabled" : ""}>التالي</button></div>`;
}

function journeyItemHtml(it) {
  if (it.caution) return `<p class="jb-item jb-caution">${escapeHtml(it.caution)}</p>`;
  if (it.scope) return `<p class="jb-item"><strong>${escapeHtml(it.scope)}</strong> · ${escapeHtml(it.verdict)}<br>${escapeHtml(it.text)}</p>`;
  if (it.khaldun) {
    const quotes = it.khaldun.map((k) => `<p><bdi>${escapeHtml(k.quote)}</bdi> <span class="jb-src">${escapeHtml(k.location)}</span></p>`).join("");
    return `<div class="jb-item"><p>${escapeHtml(it.hypothesis)}</p>${quotes}</div>`;
  }
  if (it.statement) {
    return `<div class="jb-item"><p>${escapeHtml(it.statement)}</p><p class="jb-src"><bdi>${escapeHtml(it.attributed_to)}</bdi></p>`
      + `<details class="jb-details"><summary>الاقتباس والتحفظ</summary><p><bdi>${escapeHtml(it.quote)}</bdi></p><p>${escapeHtml(it.hedge)}</p></details></div>`;
  }
  return "";
}

journeyBox.addEventListener("click", (e) => {
  const act = e.target.closest("button")?.dataset.act;
  if (!act || !journeyState) return;
  if (act === "exit") return endJourney();
  const next = journeyState.index + (act === "next" ? 1 : -1);
  if (next < 0 || next >= journeyState.journey.steps.length) return;
  journeyState.index = next;
  showJourneyStep();
});

document.addEventListener("keydown", (e) => {
  if (!journeyState || e.target.closest("input, select, textarea")) return;
  if (e.key === "Escape") return endJourney();
  // اتجاه الصفحة عربي: السهم الأيسر يتقدّم
  if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
  const next = journeyState.index + (e.key === "ArrowLeft" ? 1 : -1);
  if (next < 0 || next >= journeyState.journey.steps.length) return;
  journeyState.index = next;
  showJourneyStep();
});

loadJourneyIndex();
