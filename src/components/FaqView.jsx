import { useLang } from "../contexts/LangContext.jsx";
import { RatingTierLegend } from "./RatingTierLegend.jsx";

/** FAQ content; optional string overrides from `settings` / bootstrap (read-only). */
export function FaqView({ faqOverrides = {} }) {
  const { t, lang } = useLang();
  const isZh = lang === "zh";
  const bl = "2px solid rgba(255,255,255,0.1)";
  const bst = { display: "block", paddingLeft: 8, borderLeft: bl };
  const b4 = { display: "block", marginBottom: 4 };
  const items = [
    {
      q: t.faqQ1,
      a: isZh ? (
        <span>
          <em>給我的金融圈朋友們，這也叫 FACC</em>
          <br />
          <br />
          一個受金融界 WACC 啟發的加權美食評分系統。考慮因素：
          <br />
          <br />
          <span style={bst}>
            <span style={b4}>口味 (T) = 0-10 分</span>
            <span style={b4}>費用 (C) = 美元</span>
            <span style={b4}>份量 (P) = 一人份數量</span>
            <span style={b4}>CP值 (B) = C / P</span>
            <span style={{ display: "block" }}>回訪意願 (R) = 0-3 顆星</span>
          </span>
        </span>
      ) : (
        <span>
          <em>to my finance girlies and bros, the FACC</em>
          <br />
          <br />
          A weighted food rating system inspired by WACC in finance. Factors in:
          <br />
          <br />
          <span style={bst}>
            <span style={b4}>Taste (T) = rated 0-10</span>
            <span style={b4}>Cost (C) = in dollars</span>
            <span style={b4}>Portions (P) = meals fed per person</span>
            <span style={b4}>Bang-per-Buck (B) = C / P</span>
            <span style={{ display: "block" }}>Repeatability (R) = 0-3 stars</span>
          </span>
        </span>
      ),
    },
    {
      q: t.faqQ2,
      a: isZh ? (
        <span>
          <span style={{ display: "block", marginBottom: 6 }}>
            基礎分 = (口味權重 x T) - (CP值權重 x C/P/20) - (等待權重 x W)
          </span>
          <span style={{ display: "block", marginBottom: 6 }}>W 為對數等待懲罰（見下方）。</span>
          <span style={{ display: "block", marginBottom: 6 }}>最終 BITE = 基礎分 + |基礎分| x R 乘數</span>
          <span style={{ display: "block", marginBottom: 6 }}>
            畫面上顯示的 0–10 分 = 上述最終 BITE ÷「在你目前權重下理論最佳」（口味 10、無 CP/等待扣減、3 顆星）× 10，再限制在 0–10。
          </span>
          <span style={{ display: "block", marginBottom: 4, color: "#888780", fontSize: 12 }}>
            此「比例分」的等級區間比直接口味分寬鬆（否則實際用餐幾乎都擠在「好吃」以下）：
          </span>
          <RatingTierLegend normalized />
        </span>
      ) : (
        <span>
          <span style={{ display: "block", marginBottom: 6 }}>
            Base = (wt x T) - (wb x C/P/20) - (ww x W)
          </span>
          <span style={{ display: "block", marginBottom: 6 }}>W is the log-scaled wait penalty (see below).</span>
          <span style={{ display: "block", marginBottom: 6 }}>
            Final raw BITE = Base + |Base| x R multiplier.
          </span>
          <span style={{ display: "block", marginBottom: 6 }}>
            The number you see (0–10) is that raw score divided by the best possible raw score for your current weights (taste 10, no buck or wait drag, 3 stars),
            times 10, clamped to 0–10.
          </span>
          <span style={{ display: "block", marginBottom: 4, color: "#888780", fontSize: 12 }}>
            Tier labels for that ratio score use wider numeric bands than raw taste (otherwise real visits cluster at “good”). Café lines use the same ratio bands:
          </span>
          <RatingTierLegend normalized />
        </span>
      ),
    },
    {
      q: t.faqQ3,
      a: isZh ? (
        <span>
          W = min(10, ln(等待+1) / ln(121) x 10)
          <br />
          <br />
          對數換算，早期等待分鐘懲罰最重。上限 120 分鐘。
          <br />
          <br />
          <span style={bst}>
            {[
              ["0 分鐘", "0.0"],
              ["5 分鐘", "3.5"],
              ["15 分鐘", "5.8"],
              ["30 分鐘", "7.2"],
              ["60 分鐘", "8.6"],
              ["120 分鐘", "10.0（上限）"],
            ].map(([a, b]) => (
              <span key={a} style={b4}>
                {a} = {b}
              </span>
            ))}
          </span>
        </span>
      ) : (
        <span>
          W = min(10, ln(wait+1) / ln(121) x 10)
          <br />
          <br />
          Log-scaled so early minutes hurt most. Capped at 120 min.
          <br />
          <br />
          <span style={bst}>
            {[
              ["0 min", "0.0"],
              ["5 min", "3.5"],
              ["15 min", "5.8"],
              ["30 min", "7.2"],
              ["60 min", "8.6"],
              ["120 min", "10.0 (cap)"],
            ].map(([a, b]) => (
              <span key={a} style={b4}>
                {a} = {b}
              </span>
            ))}
          </span>
        </span>
      ),
    },
    {
      q: t.faqQ4,
      a: isZh ? (
        <span>
          <span style={{ display: "block", marginBottom: 6 }}>口味為 0～10 分。</span>
          <RatingTierLegend />
        </span>
      ) : (
        <span>
          <span style={{ display: "block", marginBottom: 6 }}>Taste is rated 0–10.</span>
          <RatingTierLegend />
        </span>
      ),
    },
    {
      q: t.faqQ5,
      a: isZh
        ? "費用除以份量，再除以 20 做標準化。每份費用越低，分數越高。"
        : "Cost divided by Portions, divided by 20 to normalize. A lower cost per portion improves your score.",
    },
    {
      q: t.faqQ6,
      a: isZh ? (
        <span>
          米其林風格 0-3 顆星評分。BITE = 基礎分 + |基礎分| x 乘數。
          <br />
          <br />
          <span style={bst}>
            <span style={b4}>3 顆星 - 一定要再去：+0.4x</span>
            <span style={b4}>2 顆星 - 會特地去：+0.2x</span>
            <span style={b4}>1 顆星 - 有機會再說：0x</span>
            <span style={{ display: "block" }}>0 顆星 - 不會再去：-0.3x</span>
          </span>
        </span>
      ) : (
        <span>
          Michelin-style 0-3 star rating. BITE = Base + |Base| x multiplier.
          <br />
          <br />
          <span style={bst}>
            <span style={b4}>3 stars - Must return: +0.4x</span>
            <span style={b4}>2 stars - Would seek out: +0.2x</span>
            <span style={b4}>1 star - If occasion calls: 0x</span>
            <span style={{ display: "block" }}>0 stars - Would not return: -0.3x</span>
          </span>
        </span>
      ),
    },
    {
      q: t.faqQ7,
      a: isZh ? (
        <span>
          咖啡廳公式為固定加權（約 70% 口味、30% CP 值；$5.25/品項為中性），再除以 1.593。畫面上同樣顯示 0–10：你的分數 ÷ 該公式下理論最佳（口味
          10、最佳情況）× 10。「我的品味」→「飲品」的滑桿用於個人化敘述，與此固定公式並行。
          <br />
          <br />
          <span style={bst}>
            <span style={b4}>基礎分 = 0.7 × 口味 − 0.3 × (費用/品項/5.25)</span>
            <span style={b4}>等待懲罰 ≤ |基礎分| 的 10%</span>
            <span style={{ display: "block" }}>
              最終 = (基礎分 − 等待懲罰) + |…| × R 乘數，再 ÷ 1.593
            </span>
          </span>
        </span>
      ) : (
        <span>
          Cafés use a fixed blend in code (~70% taste, 30% bang per buck; $5.25/item neutral), then a divisor of 1.593. The score you see is still 0–10: your raw café score ÷ the
          theoretical best under that formula × 10, clamped. Sliders under My Taste → Drinks personalize the copy around your priorities alongside this fixed formula.
          <br />
          <br />
          <span style={bst}>
            <span style={b4}>Base = 0.7 × Taste − 0.3 × (Cost / Items / 5.25)</span>
            <span style={b4}>Wait penalty ≤ 10% of |Base|</span>
            <span style={{ display: "block" }}>Final raw = (Base − wait penalty) + |…| × R multiplier, then ÷ 1.593</span>
          </span>
        </span>
      ),
    },
  ];
  return (
    <div>
      {items.map(({ q, a }, i) => {
        const key = String(q);
        const displayA = faqOverrides[i] !== undefined ? faqOverrides[i] : a;
        return (
          <div key={key} style={{ borderBottom: "0.5px solid rgba(255,255,255,0.1)", padding: "14px 0" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 6 }}>
              <div style={{ fontWeight: 500, fontSize: 14, color: "#F0997B", flex: 1 }}>{q}</div>
            </div>
            <div style={{ fontSize: 13, color: "#888780", lineHeight: 1.7 }}>
              {typeof displayA === "string"
                ? displayA.split("\n").map((line, li) => {
                    if (!line.trim()) return <div key={li} style={{ height: 8 }} />;
                    if (line.startsWith("  ") || line.startsWith("\t"))
                      return (
                        <div key={li} style={{ paddingLeft: 10, borderLeft: "2px solid rgba(255,255,255,0.12)", marginBottom: 4, color: "#888780" }}>
                          {line.trimStart()}
                        </div>
                      );
                    return (
                      <div key={li} style={{ marginBottom: 4 }}>
                        {line}
                      </div>
                    );
                  })
                : displayA}
            </div>
          </div>
        );
      })}
    </div>
  );
}
