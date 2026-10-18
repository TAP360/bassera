import type {
  LocalizedText,
  Questionnaire,
  QuestionnaireDimension,
  QuestionnaireQuestion,
} from '@workspace/api-client-react';

export type ScoreBand = 'high' | 'moderate' | 'low';

export interface DimensionScore {
  key: string;
  label: LocalizedText;
  profileName?: LocalizedText;
  narrative?: LocalizedText;
  /** Weighted score normalized to 0-100. */
  score: number;
  band: ScoreBand;
  populationAverage?: number;
}

export interface QuestionnaireResult {
  questionnaireId: string;
  code: string;
  version: number;
  completedAt: string;
  /** Answer value per question id, as submitted by the user. */
  answers: Record<string, number>;
  dimensions: DimensionScore[];
  /** Key of the dimension with the highest score. */
  dominantKey: string | null;
}

const DEFAULT_HIGH_THRESHOLD = 75;
const DEFAULT_MODERATE_THRESHOLD = 40;

export function localize(
  text: LocalizedText | undefined | null,
  language: string,
): string {
  if (!text) return '';
  return (language === 'ar' ? text.ar : text.en) || text.en || text.ar || '';
}

const byDisplayOrder = (a: { displayOrder: number }, b: { displayOrder: number }) =>
  a.displayOrder - b.displayOrder;

const isAskable = (q: QuestionnaireQuestion) =>
  q.active !== false && (q.answerSchema?.options?.length ?? 0) > 0;

/**
 * Accepts the questionnaire payload either as an object or as a JSON-encoded
 * string (some gateways double-encode the body) and validates its shape.
 */
export function parseQuestionnaire(data: unknown): Questionnaire {
  const value = typeof data === 'string' ? JSON.parse(data) : data;
  if (!value || typeof value !== 'object' || !Array.isArray((value as Questionnaire).dimensions)) {
    throw new Error('INVALID_QUESTIONNAIRE');
  }
  const questionnaire = value as Questionnaire;
  return {
    ...questionnaire,
    dimensions: questionnaire.dimensions.map((d) => ({ ...d, questions: d.questions ?? [] })),
    undimensionedQuestions: questionnaire.undimensionedQuestions ?? [],
  };
}

/** All active questions in display order, across dimensions. */
export function orderedQuestions(questionnaire: Questionnaire): QuestionnaireQuestion[] {
  return [
    ...questionnaire.dimensions.flatMap((d) => d.questions),
    ...(questionnaire.undimensionedQuestions ?? []),
  ]
    .filter(isAskable)
    .sort(byDisplayOrder);
}

/** Answer options for a question, highest value first. */
export function questionOptions(question: QuestionnaireQuestion) {
  return [...question.answerSchema.options].sort((a, b) => b.value - a.value);
}

function bandFor(score: number, questionnaire: Questionnaire): ScoreBand {
  const high = questionnaire.scoreHighThreshold ?? DEFAULT_HIGH_THRESHOLD;
  const moderate = questionnaire.scoreModerateThreshold ?? DEFAULT_MODERATE_THRESHOLD;
  if (score >= high) return 'high';
  if (score >= moderate) return 'moderate';
  return 'low';
}

function scoreDimension(
  dimension: QuestionnaireDimension,
  questionnaire: Questionnaire,
  answers: Record<string, number>,
): DimensionScore | null {
  let earned = 0;
  let possible = 0;
  for (const question of dimension.questions.filter(isAskable)) {
    const answer = answers[question.id];
    if (answer === undefined) continue;
    const values = question.answerSchema.options.map((o) => o.value);
    const min = Math.min(...values);
    const max = Math.max(...values);
    if (max === min) continue;
    const weight = question.scoreWeight ?? 1;
    const value = question.reverseScored ? min + max - answer : answer;
    earned += weight * (value - min);
    possible += weight * (max - min);
  }
  if (possible <= 0) return null;

  const score = Math.round((earned / possible) * 100);
  const band = bandFor(score, questionnaire);
  return {
    key: dimension.key,
    label: dimension.label,
    profileName: dimension.profileName,
    narrative:
      band === 'high'
        ? dimension.narrativeHigh
        : band === 'moderate'
          ? dimension.narrativeModerate
          : dimension.narrativeLow,
    score,
    band,
    populationAverage: dimension.populationAverage,
  };
}

/**
 * Scores each dimension as the weighted share of the maximum possible points
 * (0-100), flipping reverse-scored answers, then bands it using the
 * questionnaire's high/moderate thresholds.
 */
export function scoreQuestionnaire(
  questionnaire: Questionnaire,
  answers: Record<string, number>,
): QuestionnaireResult {
  const dimensions = [...questionnaire.dimensions]
    .sort(byDisplayOrder)
    .map((d) => scoreDimension(d, questionnaire, answers))
    .filter((d): d is DimensionScore => d !== null);

  // Highest score wins; ties go to the dimension furthest above its population average.
  const dominant = dimensions.reduce<DimensionScore | null>((best, d) => {
    if (!best || d.score > best.score) return d;
    if (
      d.score === best.score &&
      d.score - (d.populationAverage ?? 0) > best.score - (best.populationAverage ?? 0)
    )
      return d;
    return best;
  }, null);

  return {
    questionnaireId: questionnaire.id,
    code: questionnaire.code,
    version: questionnaire.version,
    completedAt: new Date().toISOString(),
    answers,
    dimensions,
    dominantKey: dominant?.key ?? null,
  };
}
