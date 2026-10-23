"""اختبار كمي لبعض السنن ببيانات Seshat (Equinox 2020، ترخيص CC BY-NC-SA).

الاستعمال: python3 -I analysis/seshat_sunan.py <ملف Equinox xlsx> <مجلد المخرجات>

ثلاثة اختبارات:
  أ. أعمار الدول: هل "الدولة في الغالب لا تعدو أعمار ثلاثة أجيال" (نحو 120 سنة)؟
  ب. التجارة ومراكزها: هل ترتبط الأسواق والموانئ والطرق بكبر المدينة الكبرى، بعد ضبط الزمن؟
  ج. الصنائع والعمران: هل يرتبط حجم المدينة الكبرى بمؤشر المعلومات والأدب العلمي، بعد ضبط الزمن؟
النتائج ارتباطية، لا سببية. البذرة ثابتة ليكون التحليل قابلاً للإعادة.
"""
import json, re, sys
import numpy as np
import pandas as pd

XLSX, OUT = sys.argv[1], sys.argv[2]
rng = np.random.default_rng(7)
N_BOOT = N_PERM = 5000
GEN_YEARS = 120  # ثلاثة أجيال × 40 سنة، كما في نص المقدمة

pol = pd.read_excel(XLSX, sheet_name="Polities", engine="openpyxl").dropna(how="all", axis=1).dropna(subset=["PolID"])
pol = pol.drop_duplicates("PolID").copy()
ts = pd.read_excel(XLSX, sheet_name="TSDat123", engine="openpyxl")
imp = pd.read_excel(XLSX, sheet_name="ImpSCDat", engine="openpyxl")

def boot_ci(values, stat, n=N_BOOT):
    values = np.asarray(values)
    stats = [stat(rng.choice(values, size=len(values), replace=True)) for _ in range(n)]
    return [round(float(np.percentile(stats, 2.5)), 3), round(float(np.percentile(stats, 97.5)), 3)]

def spearman(a, b):
    ra, rb = pd.Series(a).rank().to_numpy(), pd.Series(b).rank().to_numpy()
    return float(np.corrcoef(ra, rb)[0, 1])

# ---------- أ. أعمار الدول ----------
adm = ts[ts.AdmLev > 0].groupby("PolID").AdmLev.max()
pol["adm_max"] = pol.PolID.map(adm)
pol["dur"] = pol.End - pol.Start + 1
states = pol[pol.adm_max >= 3].copy()

def summarize(durations, label):
    d = np.asarray(durations, dtype=float)
    share = lambda x: float(np.mean(x <= GEN_YEARS))
    return {
        "label": label, "n": int(len(d)),
        "median_years": float(np.median(d)), "iqr_years": [float(np.percentile(d, 25)), float(np.percentile(d, 75))],
        "share_le_120": round(share(d), 3), "share_le_120_ci95": boot_ci(d, share),
    }

def merge_phases(df):
    # يدمج المراحل المرقّمة للكيان نفسه (مثل "Abbasid Caliphate I" و"II") إذا تتابعت بفارق 50 سنة فأقل.
    df = df.assign(base=df.PolName.str.replace(r"\s+(?:[IVX]+|\d+)$", "", regex=True).str.strip()).sort_values("Start")
    merged = []
    for base, g in df.groupby("base"):
        cur = None
        for _, r in g.iterrows():
            if cur and r.Start - cur["End"] <= 50:
                cur["End"] = max(cur["End"], r.End); cur["parts"] += 1
            else:
                if cur: merged.append(cur)
                cur = {"name": base, "Start": r.Start, "End": r.End, "region": r["World Region"], "parts": 1}
        merged.append(cur)
    m = pd.DataFrame(merged)
    m["dur"] = m.End - m.Start + 1
    return m

merged = merge_phases(states)
islamic = lambda df, region_col: df[(df.Start >= 650) & (df[region_col].isin(["SouthwestAsia", "Africa", "CentralEurasia", "SouthAsia"]))]
test_a = {
    "hypothesis": "الدولة في الغالب لا تعدو أعمار ثلاثة أجيال (120 سنة)",
    "state_definition": "كيان له ثلاثة مستويات إدارية فأكثر في أي وقت (AdmLev ≥ 3)",
    "all_states_raw": summarize(states.dur, "كل الدول، مراحل Seshat كما هي"),
    "all_states_merged": summarize(merged.dur, "كل الدول، بعد دمج المراحل المرقّمة"),
    "islamic_world_raw": summarize(islamic(states, "World Region").dur, "العالم الإسلامي تقريباً (بعد 650م، غرب آسيا وأفريقيا وآسيا الوسطى وجنوبها)"),
    "islamic_world_merged": summarize(islamic(merged, "region").dur, "العالم الإسلامي تقريباً، بعد دمج المراحل"),
    "merged_phase_groups": int((merged.parts > 1).sum()),
    "longest_merged": merged.sort_values("dur").tail(5)[["name", "Start", "End", "dur"]].to_dict("records"),
    "shortest_merged": merged.sort_values("dur").head(5)[["name", "Start", "End", "dur"]].to_dict("records"),
}

# ---------- بيانات على مستوى الكيان للاختبارين ب وج ----------
def presence(series):
    s = series[series >= 0]
    if s.empty: return np.nan
    mx = s.max()
    return 1.0 if mx >= 0.9 else (0.0 if mx <= 0.1 else np.nan)

per = imp.groupby("PolID").agg(cap=("Cap", "mean"), info=("Info", "mean"), mid=("Time", "mean"))
for v in ["Market", "Port", "Road", "SciLit"]:
    per[v] = ts.groupby("PolID")[v].apply(presence)
per["bin"] = (per.mid // 1000) * 1000  # حقبة من ألف سنة لضبط الزمن

def stratified_presence_test(var):
    d = per.dropna(subset=[var, "cap"])
    d = d[d.groupby("bin")[var].transform(lambda x: x.nunique() == 2)]  # حقب فيها الحالتان فقط
    def stat(df):
        diffs, w = [], []
        for _, g in df.groupby("bin"):
            diffs.append(g[g[var] == 1].cap.mean() - g[g[var] == 0].cap.mean()); w.append(len(g))
        return float(np.average(diffs, weights=w))
    obs = stat(d)
    count = 0
    for _ in range(N_PERM):
        p = d.copy()
        p[var] = p.groupby("bin")[var].transform(lambda x: rng.permutation(x.to_numpy()))
        if stat(p) >= obs: count += 1
    return {
        "variable": var, "n_polities": int(len(d)), "n_present": int((d[var] == 1).sum()), "n_absent": int((d[var] == 0).sum()),
        "diff_log10_cap_within_millennium": round(obs, 3), "ratio_largest_city": round(10 ** obs, 2),
        "p_one_sided_permutation": round((count + 1) / (N_PERM + 1), 4),
    }

test_b = {
    "hypothesis": "تتركز التجارة في المراكز الكبرى: الأسواق والموانئ والطرق تقترن بمدن أكبر",
    "measure": "الفرق في لوغاريتم سكان أكبر مدينة (Cap من ImpSCDat) بين وجود المتغير وغيابه، داخل كل ألفية، مع اختبار تبديل داخل الألفيات",
    "results": [stratified_presence_test(v) for v in ["Market", "Port", "Road"]],
}

def within_bin_spearman(x, y, min_n=15):
    d = per.dropna(subset=[x, y])
    rhos = []
    for b, g in d.groupby("bin"):
        if len(g) >= min_n and g[x].nunique() > 1 and g[y].nunique() > 1:
            rhos.append({"bin_start": int(b), "n": int(len(g)), "rho": round(spearman(g[x], g[y]), 3)})
    overall = spearman(d[x], d[y])
    idx = np.arange(len(d))
    ci = boot_ci(idx, lambda s: spearman(d[x].to_numpy()[s], d[y].to_numpy()[s]), n=2000)
    return {"overall_rho": round(overall, 3), "overall_ci95": ci, "n": int(len(d)), "within_millennium": rhos,
            "median_within_rho": round(float(np.median([r["rho"] for r in rhos])), 3) if rhos else None}

test_c = {
    "hypothesis": "الصنائع والعلوم تكمل بكمال العمران الحضري",
    "cap_vs_info": within_bin_spearman("cap", "info"),
    "scilit_presence": stratified_presence_test("SciLit"),
}

# ---------- اختبار أصرم: ضبط حجم سكان الكيان والحقبة معاً ----------
per["pop"] = imp.groupby("PolID").Pop.mean()

def ols_controlled(y, x, n_boot=2000):
    # y = a + b*x + c*pop + تأثيرات ثابتة للألفية؛ نعيد b مع فترة ثقة bootstrap.
    d = per.dropna(subset=[y, x, "pop"]).copy()
    def fit(df):
        bins = pd.get_dummies(df["bin"], prefix="b", drop_first=True, dtype=float)
        X = np.column_stack([np.ones(len(df)), df[x].to_numpy(float), df["pop"].to_numpy(float), bins.to_numpy()])
        coef, *_ = np.linalg.lstsq(X, df[y].to_numpy(float), rcond=None)
        return float(coef[1])
    b = fit(d)
    boots = [fit(d.iloc[rng.integers(0, len(d), len(d))]) for _ in range(n_boot)]
    return {"y": y, "x": x, "n": int(len(d)), "coef": round(b, 3),
            "ci95": [round(float(np.percentile(boots, 2.5)), 3), round(float(np.percentile(boots, 97.5)), 3)]}

test_b["controlled_for_population"] = {
    "measure": "معامل المتغير في انحدار لوغاريتم أكبر مدينة على المتغير + لوغاريتم سكان الكيان + تأثيرات الألفية",
    "results": [ols_controlled("cap", v) for v in ["Market", "Port", "Road"]],
}
test_c["controlled_for_population"] = {
    "measure": "معامل حجم المدينة في انحدار مؤشر المعلومات على لوغاريتم أكبر مدينة + لوغاريتم سكان الكيان + تأثيرات الألفية",
    "results": [ols_controlled("info", "cap")],
}

res = {
    "_source": "Seshat Equinox 2020 (Equinox_on_GitHub_June9_2022.xlsx)، ترخيص CC BY-NC-SA",
    "_note": "نتائج ارتباطية من بيانات مُرمَّزة ومُستكمَلة إحصائياً (imputed)، لا تثبت سببية. الكيان في Seshat ليس دائماً دولة بمعنى ابن خلدون.",
    "seed": 7, "test_a_dynasty_age": test_a, "test_b_trade_centers": test_b, "test_c_crafts_urbanism": test_c,
}
with open(f"{OUT}/seshat_results.json", "w", encoding="utf-8") as f:
    json.dump(res, f, ensure_ascii=False, indent=2, default=float)
print(json.dumps(res, ensure_ascii=False, indent=1, default=float))
