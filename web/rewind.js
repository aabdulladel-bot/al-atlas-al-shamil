// الشريط المعكوس: من الكيان المفتوح إلى جذوره، حقبة بعد حقبة، عبر سلسلة الكيان (lineage.json).
// في كل حقبة: تُحمَّل حدودها، ويُبرز الكيان، وتطير الكاميرا إلى أرضه، ويُكتب اسمه وسببه. لا نص هنا إلا أسماء الكيانات والحقب.
(() => {
  const rw = { on: false, token: 0, origin: null };
  const box = document.createElement("div");
  box.id = "rewind-box";
  box.hidden = true;
  box.innerHTML = `<span class="rw-year"></span><span class="rw-name"></span><span class="rw-note"></span><button type="button" id="rewind-stop">إيقاف وعودة</button>`;
  document.body.appendChild(box);

  const yearText = (k) => (String(k) === "modern" ? "اليوم" : yearLabel(Number(k)));
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));

  // مستطيل الحدود لمضلع أو متعدد مضلعات (بالإحداثيات الخام)
  function bboxOf(geom) {
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    const walk = (c) => {
      if (typeof c[0] === "number") { x0 = Math.min(x0, c[0]); x1 = Math.max(x1, c[0]); y0 = Math.min(y0, c[1]); y1 = Math.max(y1, c[1]); return; }
      for (const d of c) walk(d);
    };
    walk(geom.coordinates);
    return [[x0, y0], [x1, y1]];
  }

  async function showStep(step, i, total) {
    const data = await loadBorders(step.key);
    if (!rw.on || rw.token !== step.token) return false;
    const f = data?.features.find((x) => x.properties.NAME === step.name);
    map.setFilter("borders-highlight", ["==", ["get", "NAME"], step.name]);
    if (f) map.fitBounds(bboxOf(f.geometry), { padding: fitPadding(), maxZoom: 4.6, pitch: 0, bearing: 0, duration: camMs(2600) });
    box.querySelector(".rw-year").textContent = `${yearText(step.key)} · ${i + 1} من ${total}`;
    box.querySelector(".rw-name").textContent = step.label;
    box.querySelector(".rw-note").textContent = step.note;
    box.hidden = false;
    await wait(camMs(3400));
    return rw.on && rw.token === step.token;
  }

  async function start(key, name, label) {
    if (rw.on) return;
    await ensureLineage();
    const levels = lineageChain(key, name, "prev", "strong", label);
    const steps = [{ key: String(key), name, label, note: "اليوم: هذا الكيان كما يبدو على الخريطة الحالية." }];
    for (const level of levels) {
      const it = level[0];
      if (!it || it.more !== undefined) continue;
      steps.push({ key: String(it.key), name: it.name, label: it.name_ar ?? it.name, note: it.from && it.from !== (it.name_ar ?? it.name) ? `يُعدّ سلفاً لـ«${it.from}» بأرض مشتركة.` : "الكيان نفسه في حقبة أقدم، وأرضه مشتركة مع اليوم." });
    }
    rw.on = true;
    rw.token += 1;
    rw.origin = { key: String(time.key), name: cardEntity?.name ?? name };
    const mine = rw.token;
    // الخطوات مرتبة من اليوم نحو الجذر: كل خطوة أقدم من التي قبلها
    for (let i = 0; i < steps.length; i++) {
      const s = { ...steps[i], token: mine };
      if (!(await showStep(s, i, steps.length))) break;
    }
    if (rw.on && rw.token === mine) {
      box.querySelector(".rw-note").textContent = "هذا أقدم سلف وصلت إليه السلسلة في الخرائط المتجاورة.";
      await wait(2800);
    }
    stop();
  }

  function stop() {
    if (!rw.on) return;
    rw.on = false;
    rw.token += 1;
    box.hidden = true;
    map.setFilter("borders-highlight", ["==", ["get", "NAME"], rw.origin?.name ?? ""]);
    if (rw.origin && String(time.key) !== rw.origin.key) loadBorders(rw.origin.key);
  }

  document.addEventListener("click", (e) => {
    const b = e.target.closest?.("[data-rewind]");
    if (b) { start(b.dataset.rkey, b.dataset.rname, b.dataset.rlabel); return; }
    if (e.target.closest?.("#rewind-stop")) stop();
  });
  window.rewindStop = stop;
})();
