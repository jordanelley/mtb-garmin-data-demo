// Trail difficulty grading, derived from per-point gradient (track.js gradPct). Grades are
// ordered 1-6 with monotonically increasing degree thresholds, so classification walks grades
// low-to-high and returns the first one the trail's gradient profile doesn't violate.

export const DIRECTIONS = {
  uphill: { key: 'uphill', label: 'Uphill' },
  downhill: { key: 'downhill', label: 'Downhill' },
  twoWay: { key: 'twoWay', label: 'Two-way' },
}

// "uphill" and "two-way" trails share one band table (the climbing direction is the limiting
// case); "downhill" trails get their own, more permissive table.
function bandsFor(direction) {
  return direction === DIRECTIONS.downhill.key ? 'downhill' : 'uphillTwoWay'
}

export const GRADE_RULES = [
  {
    grade: 1,
    label: 'Grade 1',
    color: '#9ccc65',
    uphillTwoWay: {
      baselineMaxDeg: 2,
      baselineMinPct: 90,
      tiers: [
        { minDeg: 2, maxDeg: 3, maxRunM: 100 },
        { minDeg: 3, maxDeg: 4, maxRunM: 10 },
        { minDeg: 4, maxDeg: 6, maxRunM: 3 },
      ],
    },
    downhill: {
      baselineMaxDeg: 3.5,
      baselineMinPct: 90,
      tiers: [
        { minDeg: 3.5, maxDeg: 5, maxRunM: 100 },
        { minDeg: 5, maxDeg: 7, maxRunM: 15 },
        { minDeg: 7, maxDeg: 9, maxRunM: 5 },
      ],
    },
  },
  {
    grade: 2,
    label: 'Grade 2',
    color: '#43a047',
    uphillTwoWay: {
      baselineMaxDeg: 3.5,
      baselineMinPct: 90,
      tiers: [
        { minDeg: 3.5, maxDeg: 5, maxRunM: 100 },
        { minDeg: 5, maxDeg: 7, maxRunM: 10 },
        { minDeg: 7, maxDeg: 9, maxRunM: 3 },
      ],
    },
    downhill: {
      baselineMaxDeg: 5,
      baselineMinPct: 80,
      tiers: [
        { minDeg: 5, maxDeg: 7, maxRunM: 100 },
        { minDeg: 7, maxDeg: 10, maxRunM: 15 },
        { minDeg: 10, maxDeg: 12, maxRunM: 5 },
      ],
    },
  },
  {
    grade: 3,
    label: 'Grade 3',
    color: '#4fc3f7',
    note: 'May also feature rollovers/chutes — not automatically detected from GPX data.',
    uphillTwoWay: {
      baselineMaxDeg: 5,
      baselineMinPct: 90,
      tiers: [
        { minDeg: 5, maxDeg: 7, maxRunM: 100 },
        { minDeg: 7, maxDeg: 10, maxRunM: 10 },
        { minDeg: 10, maxDeg: 12, maxRunM: 3 },
      ],
    },
    downhill: {
      baselineMaxDeg: 7,
      baselineMinPct: 70,
      tiers: [
        { minDeg: 7, maxDeg: 9, maxRunM: 100 },
        { minDeg: 9, maxDeg: 12, maxRunM: 15 },
        { minDeg: 12, maxDeg: 15, maxRunM: 5 },
      ],
    },
  },
  {
    grade: 4,
    label: 'Grade 4',
    color: '#1565c0',
    uphillTwoWay: {
      baselineMaxDeg: 7,
      baselineMinPct: 90,
      tiers: [
        { minDeg: 7, maxDeg: 10, maxRunM: 100 },
        { minDeg: 10, maxDeg: 15, maxRunM: 10 },
        { minDeg: 15, maxDeg: 20, maxRunM: 3 },
      ],
    },
    downhill: {
      baselineMaxDeg: 10,
      baselineMinPct: 60,
      tiers: [
        { minDeg: 10, maxDeg: 15, maxRunM: 50 },
        { minDeg: 15, maxDeg: 20, maxRunM: 15 },
        { minDeg: 20, maxDeg: 25, maxRunM: 5 },
      ],
    },
  },
  {
    grade: 5,
    label: 'Grade 5',
    color: '#1a1a1a',
    uphillTwoWay: {
      baselineMaxDeg: 10,
      baselineMinPct: 90,
      tiers: [
        { minDeg: 10, maxDeg: 15, maxRunM: 100 },
        { minDeg: 15, maxDeg: 20, maxRunM: 10 },
        { minDeg: 20, maxDeg: 25, maxRunM: 3 },
      ],
    },
    downhill: {
      baselineMaxDeg: 15,
      baselineMinPct: 50,
      tiers: [
        { minDeg: 15, maxDeg: 20, maxRunM: 50 },
        { minDeg: 20, maxDeg: 25, maxRunM: 15 },
        { minDeg: 25, maxDeg: 30, maxRunM: 10 },
        { minDeg: 30, maxDeg: 35, maxRunM: 5 },
      ],
    },
  },
  {
    grade: 6,
    label: 'Grade 6',
    color: '#e53935',
    uphillTwoWay: {
      baselineMaxDeg: 15,
      baselineMinPct: 90,
      tiers: [
        { minDeg: 15, maxDeg: 20, maxRunM: 100 },
        { minDeg: 20, maxDeg: 25, maxRunM: 10 },
        { minDeg: 25, maxDeg: 30, maxRunM: 3 },
      ],
    },
    downhill: null, // no gradient limit
  },
]

// Buckets a berm's peak bank angle onto the same Grade 1-5 color/label scale as GRADE_RULES,
// using the bank-angle caps from the grading criteria (10/20/30/40/50°). Grade 6 has no berm
// cap in the criteria, so berms top out visually at Grade 5.
const BERM_GRADE_MAX_DEG = [10, 20, 30, 40, Infinity]

export const BERM_GRADES = GRADE_RULES.slice(0, 5).map((rule, i) => ({
  grade: rule.grade,
  label: rule.label,
  color: rule.color,
  maxDeg: BERM_GRADE_MAX_DEG[i],
}))

export function classifyBermGrade(angleDeg) {
  return BERM_GRADES.find((g) => angleDeg <= g.maxDeg) ?? BERM_GRADES[BERM_GRADES.length - 1]
}

function formatDegRange(prevMax, maxDeg) {
  return maxDeg === Infinity ? `${prevMax}°+` : `${prevMax}–${maxDeg}°`
}

/** The berm bank-angle range that defines each Grade 1-5 bucket, for display as a legend/key. */
export function bermGradeRanges() {
  return BERM_GRADES.map((g, i) => ({ label: g.label, color: g.color, range: formatDegRange(i === 0 ? 0 : BERM_GRADES[i - 1].maxDeg, g.maxDeg) }))
}

/** The gradient-degree range that defines each Grade 1-6 bucket for the given direction, for display as a legend/key. */
export function gradientGradeRanges(direction) {
  const cutoffs = gradientCutoffs(direction)
  return GRADE_RULES.map((rule, i) => ({ label: rule.label, color: rule.color, range: formatDegRange(i === 0 ? 0 : cutoffs[i - 1], cutoffs[i]) }))
}

function degFromGradPct(gradPct) {
  return (Math.atan(gradPct / 100) * 180) / Math.PI
}

/** Groups segments exceeding baselineMaxDeg into contiguous runs, each tagged with its peak degree. */
function findSteepRuns(segments, baselineMaxDeg) {
  const runs = []
  let current = null
  for (const seg of segments) {
    if (seg.deg > baselineMaxDeg) {
      if (!current) {
        current = { lengthM: 0, peakDeg: 0 }
        runs.push(current)
      }
      current.lengthM += seg.lenM
      current.peakDeg = Math.max(current.peakDeg, seg.deg)
    } else {
      current = null
    }
  }
  return runs
}

/** Checks one direction's gradient bands against the track; returns { pass, reason? }. */
function checkGradientBands(segments, totalDistM, bands) {
  if (bands === null) return { pass: true }
  if (totalDistM <= 0) return { pass: true }

  let baselineDistM = 0
  for (const seg of segments) {
    if (seg.deg <= bands.baselineMaxDeg) baselineDistM += seg.lenM
  }
  const baselinePct = (baselineDistM / totalDistM) * 100
  if (baselinePct < bands.baselineMinPct) {
    return { pass: false, reason: `only ${baselinePct.toFixed(0)}% of trail is within the ${bands.baselineMaxDeg}° baseline (needs ≥${bands.baselineMinPct}%)` }
  }

  const runs = findSteepRuns(segments, bands.baselineMaxDeg)
  for (const run of runs) {
    const tier = bands.tiers.find((t) => run.peakDeg > t.minDeg && run.peakDeg <= t.maxDeg)
    if (!tier) {
      return { pass: false, reason: `a section reaches ${run.peakDeg.toFixed(1)}°, beyond this grade's steepest allowed tier` }
    }
    if (run.lengthM > tier.maxRunM) {
      return {
        pass: false,
        reason: `a ${run.lengthM.toFixed(0)}m section at ${run.peakDeg.toFixed(1)}° exceeds the ${tier.maxRunM}m cap for the ${tier.minDeg}–${tier.maxDeg}° tier`,
      }
    }
  }

  return { pass: true }
}

/**
 * Classifies a track model against GRADE_RULES for the given direction.
 * Returns { grade: ruleOrNull, failures: [{ grade, reason }], summary, exceedsTopGrade? } —
 * grade is the lowest-numbered rule the trail satisfies, capped at Grade 6 (with
 * exceedsTopGrade: true) if it's steeper than even that; null only when there's no elevation
 * data to grade at all. summary is a one-line plain-language explanation of why that grade
 * (and not one easier) was assigned.
 */
export function classifyTrailGrade(track, direction) {
  if (!track.hasEle) {
    const reason = 'no elevation data in this GPX file — gradient can’t be graded'
    return { grade: null, failures: [], reason, summary: reason }
  }

  const key = bandsFor(direction)

  // gradPct is already per-segment (the run from the previous point), so pair each with that
  // same distance delta rather than re-deriving it from gaps between filtered points.
  const segLengths = []
  for (let i = 1; i < track.points.length; i++) {
    const p = track.points[i]
    if (p.gradPct === null) continue
    segLengths.push({ lenM: p.distM - track.points[i - 1].distM, deg: Math.abs(degFromGradPct(p.gradPct)) })
  }

  const totalDistM = track.totals.distanceM
  const failures = []

  for (const rule of GRADE_RULES) {
    const bands = rule[key]
    const gradientResult = checkGradientBands(segLengths, totalDistM, bands)

    if (gradientResult.pass) {
      const summary =
        failures.length === 0
          ? `${rule.label}: the entire gradient profile fits comfortably within its limits.`
          : `${rule.label} — doesn't meet Grade ${failures[failures.length - 1].grade} because ${failures[failures.length - 1].reason}.`
      return { grade: rule, failures, summary }
    }
    failures.push({ grade: rule.grade, reason: gradientResult.reason })
  }

  // Grade 6 is the ceiling — a trail steeper than its tiers still gets capped at Grade 6
  // rather than left unclassified.
  const topGrade = GRADE_RULES[GRADE_RULES.length - 1]
  const lastFailure = failures[failures.length - 1]
  const summary = `${topGrade.label} (capped) — exceeds even Grade 6 limits: ${lastFailure.reason}.`
  return { grade: topGrade, failures, exceedsTopGrade: true, summary }
}

// Each grade's baseline degree cutoff for a direction increases monotonically grade-over-grade,
// so they double as disjoint bucket edges for classifying a single gradient reading.
function gradientCutoffs(direction) {
  const key = bandsFor(direction)
  return GRADE_RULES.map((rule) => {
    const bands = rule[key]
    return bands === null ? Infinity : bands.baselineMaxDeg
  })
}

/** Buckets a single gradient % reading onto the Grade 1-6 color/label scale for the given direction. */
export function classifyGradientGrade(gradPct, direction) {
  const deg = Math.abs(degFromGradPct(gradPct))
  const cutoffs = gradientCutoffs(direction)
  const idx = cutoffs.findIndex((c) => deg <= c)
  return GRADE_RULES[idx === -1 ? cutoffs.length - 1 : idx]
}

/**
 * Buckets each gradient segment onto the Grade 1-6 scale (see classifyGradientGrade) and
 * returns the % of trail distance landing in each grade (grades with 0% are omitted), for a
 * quick "how much of this trail is each grade" readout.
 */
export function summarizeGradientByGrade(track, direction) {
  if (!track.hasEle) return []

  const cutoffs = gradientCutoffs(direction)
  const distByGrade = new Array(GRADE_RULES.length).fill(0)
  let totalDistM = 0

  for (let i = 1; i < track.points.length; i++) {
    const p = track.points[i]
    if (p.gradPct === null) continue
    const lenM = p.distM - track.points[i - 1].distM
    const deg = Math.abs(degFromGradPct(p.gradPct))
    totalDistM += lenM
    const idx = cutoffs.findIndex((c) => deg <= c)
    distByGrade[idx === -1 ? cutoffs.length - 1 : idx] += lenM
  }

  if (totalDistM <= 0) return []

  return GRADE_RULES.map((rule, i) => ({ label: rule.label, color: rule.color, pct: Math.round((distByGrade[i] / totalDistM) * 100) })).filter(
    (e) => e.pct > 0,
  )
}
