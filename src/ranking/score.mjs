export const METHODOLOGY_VERSION = '1.0.0';

export const SCORE_WEIGHTS = Object.freeze({
  activity: 0.45,
  impact: 0.25,
  community: 0.15,
  collaboration: 0.15
});

function finite(value) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : 0;
}

function logNormalize(value, maximum) {
  const max = finite(maximum);
  if (max === 0) return 0;
  return Math.log1p(finite(value)) / Math.log1p(max);
}

function round(value, precision = 2) {
  const factor = 10 ** precision;
  return Math.round((value + Number.EPSILON) * factor) / factor;
}

function rawCollaboration(user) {
  return (
    finite(user.metrics?.pullRequests365d) +
    finite(user.metrics?.reviews365d) * 1.5 +
    finite(user.metrics?.issues365d) * 0.5
  );
}

function rawImpact(user) {
  return finite(user.metrics?.starsReceived) + finite(user.metrics?.forksReceived) * 2;
}

export function rankDevelopers(developers) {
  const candidates = Array.isArray(developers) ? developers : [];
  const maxima = {
    activity: Math.max(0, ...candidates.map((user) => finite(user.metrics?.contributions365d))),
    impact: Math.max(0, ...candidates.map(rawImpact)),
    community: Math.max(0, ...candidates.map((user) => finite(user.metrics?.followers))),
    collaboration: Math.max(0, ...candidates.map(rawCollaboration))
  };

  return candidates
    .map((user) => {
      const components = {
        activity: logNormalize(user.metrics?.contributions365d, maxima.activity) * 100,
        impact: logNormalize(rawImpact(user), maxima.impact) * 100,
        community: logNormalize(user.metrics?.followers, maxima.community) * 100,
        collaboration: logNormalize(rawCollaboration(user), maxima.collaboration) * 100
      };

      const overall = Object.entries(SCORE_WEIGHTS).reduce(
        (sum, [name, weight]) => sum + components[name] * weight,
        0
      );

      return {
        ...user,
        scores: {
          overall: round(overall),
          activity: round(components.activity),
          impact: round(components.impact),
          community: round(components.community),
          collaboration: round(components.collaboration)
        }
      };
    })
    .sort((a, b) => {
      return (
        b.scores.overall - a.scores.overall ||
        finite(b.metrics?.contributions365d) - finite(a.metrics?.contributions365d) ||
        finite(b.metrics?.starsReceived) - finite(a.metrics?.starsReceived) ||
        String(a.login).localeCompare(String(b.login))
      );
    })
    .map((user, index) => ({ ...user, rank: index + 1 }));
}
