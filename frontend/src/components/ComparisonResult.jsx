import React from "react";

/**
 * Two-column comparison result table + strengths/weaknesses panels.
 * Works with generate metadata or applied Studio fields.
 */
export default function ComparisonResult({ data }) {
  if (!data) return null;

  const meta = data.metadata || {};
  const rows = Array.isArray(data.comparison_rows)
    ? data.comparison_rows
    : Array.isArray(meta.comparison_rows)
      ? meta.comparison_rows
      : [];

  const itemA = data.item_a || meta.item_a || "Item A";
  const itemB = data.item_b || meta.item_b || "Item B";
  const labelA = String(itemA).length > 48 ? `${String(itemA).slice(0, 48)}…` : itemA;
  const labelB = String(itemB).length > 48 ? `${String(itemB).slice(0, 48)}…` : itemB;

  const strengthsA = data.strengths_a || meta.strengths_a || "";
  const strengthsB = data.strengths_b || meta.strengths_b || "";
  const weaknessesA = data.weaknesses_a || meta.weaknesses_a || "";
  const weaknessesB = data.weaknesses_b || meta.weaknesses_b || "";
  const bestForA = data.best_for_a || meta.best_for_a || "";
  const bestForB = data.best_for_b || meta.best_for_b || "";
  const winner = data.winner || meta.winner || "";

  if (!rows.length && !strengthsA && !strengthsB && !winner) {
    return null;
  }

  return (
    <div className="compare-result">
      {rows.length > 0 && (
        <div className="compare-table-wrap">
          <table className="compare-table">
            <thead>
              <tr>
                <th>Criterion</th>
                <th>
                  <span className="compare-badge">A</span>
                  {labelA}
                </th>
                <th>
                  <span className="compare-badge">B</span>
                  {labelB}
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, index) => (
                <tr key={`${row.criterion || "row"}-${index}`}>
                  <td>
                    <strong>{row.criterion}</strong>
                  </td>
                  <td>{row.item_a}</td>
                  <td>{row.item_b}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {(strengthsA || strengthsB || weaknessesA || weaknessesB || bestForA || bestForB) && (
        <div className="compare-columns compare-summary">
          <div className="compare-column compare-a">
            <div className="compare-column-head">
              <span className="compare-badge">A</span>
              <strong>{labelA}</strong>
            </div>
            {strengthsA && (
              <>
                <div className="compare-column-head">
                  <strong>Strengths</strong>
                </div>
                <p className="compare-note">{strengthsA}</p>
              </>
            )}
            {weaknessesA && (
              <>
                <div className="compare-column-head">
                  <strong>Weaknesses</strong>
                </div>
                <p className="compare-note">{weaknessesA}</p>
              </>
            )}
            {bestForA && (
              <>
                <div className="compare-column-head">
                  <strong>Best for</strong>
                </div>
                <p className="compare-note">{bestForA}</p>
              </>
            )}
          </div>
          <div className="compare-column compare-b">
            <div className="compare-column-head">
              <span className="compare-badge">B</span>
              <strong>{labelB}</strong>
            </div>
            {strengthsB && (
              <>
                <div className="compare-column-head">
                  <strong>Strengths</strong>
                </div>
                <p className="compare-note">{strengthsB}</p>
              </>
            )}
            {weaknessesB && (
              <>
                <div className="compare-column-head">
                  <strong>Weaknesses</strong>
                </div>
                <p className="compare-note">{weaknessesB}</p>
              </>
            )}
            {bestForB && (
              <>
                <div className="compare-column-head">
                  <strong>Best for</strong>
                </div>
                <p className="compare-note">{bestForB}</p>
              </>
            )}
          </div>
        </div>
      )}

      {winner && (
        <div className="compare-winner">
          <span>Recommendation</span>
          <strong>{winner}</strong>
        </div>
      )}
    </div>
  );
}
