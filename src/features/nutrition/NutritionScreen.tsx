import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { getUserProfile, saveUserProfile } from '../../data/db';
import type { NutritionPreferences, UserProfile } from '../../data/types';
import {
  DEFAULT_NUTRITION_PREFERENCES,
  FOOD_EXCLUSION_OPTIONS,
  calculateNutritionTargets,
  generateIndianDietPlan,
  validateNutritionPreferences,
} from './nutritionModel';
import './NutritionScreen.css';

interface NutritionScreenProps {
  onProfileUpdated?: (profile: UserProfile) => void;
}

type View = 'Meals' | 'Calculators' | 'Diet settings';
type Draft = Omit<NutritionPreferences, 'age' | 'weightKg' | 'heightCm'> & {
  age: string;
  weightKg: string;
  heightCm: string;
};

const activityLabels: Record<NutritionPreferences['activity'], string> = {
  sedentary: 'Sedentary — mostly sitting',
  light: 'Light — some walking or light exercise',
  moderate: 'Moderate — regular activity or exercise',
  high: 'High — very active days or frequent hard exercise',
};
const dietLabels: Record<NutritionPreferences['diet'], string> = {
  vegetarian: 'Vegetarian', eggetarian: 'Eggetarian', 'non-vegetarian': 'Non-vegetarian',
};
const goalLabels: Record<NutritionPreferences['goal'], string> = {
  maintain: 'Maintain weight', lose: 'Gradual weight loss', gain: 'Gradual weight gain',
};
const number = (value: number) => Math.round(value).toLocaleString();

function toDraft(preferences?: NutritionPreferences): Draft {
  const value = { ...DEFAULT_NUTRITION_PREFERENCES, ...preferences };
  return {
    ...value,
    age: preferences ? String(value.age) : '',
    weightKg: preferences ? String(value.weightKg) : '',
    heightCm: preferences ? String(value.heightCm) : '',
    foodExclusions: Array.isArray(value.foodExclusions) ? [...value.foodExclusions] : [],
  };
}

function newSeed(): string {
  return `atlas-${Date.now()}-${crypto.getRandomValues(new Uint32Array(1))[0]}`;
}

export function NutritionScreen({ onProfileUpdated }: NutritionScreenProps) {
  const [view, setView] = useState<View>('Diet settings');
  const [draft, setDraft] = useState<Draft>(() => toDraft());
  const [saved, setSaved] = useState<NutritionPreferences>();
  const [loading, setLoading] = useState(true);
  const [loadAttempt, setLoadAttempt] = useState(0);
  const [loadError, setLoadError] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [selectedDay, setSelectedDay] = useState(0);
  const errorRef = useRef<HTMLParagraphElement>(null);
  const noticeRef = useRef<HTMLParagraphElement>(null);

  useEffect(() => {
    if (error) errorRef.current?.focus();
  }, [error]);

  useEffect(() => {
    if (notice) noticeRef.current?.focus();
  }, [notice]);

  useEffect(() => {
    let active = true;
    getUserProfile().then((profile) => {
      if (!active) return;
      const preferences = profile.nutrition;
      setSaved(preferences);
      setDraft(toDraft(preferences));
      setView(preferences ? 'Meals' : 'Diet settings');
    }).catch(() => {
      if (active) setLoadError(true);
    }).finally(() => {
      if (active) setLoading(false);
    });
    return () => { active = false; };
  }, [loadAttempt]);

  const derived = useMemo(() => {
    if (!saved) return null;
    try {
      if (!validateNutritionPreferences(saved)) return null;
      return {
        targets: calculateNutritionTargets(saved),
        plan: generateIndianDietPlan(saved, saved.planSeed ?? 'atlas'),
      };
    } catch {
      return null;
    }
  }, [saved]);

  function update<K extends keyof Draft>(key: K, value: Draft[K]) {
    setDraft((current) => ({ ...current, [key]: value }));
    setError('');
    setNotice('');
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    setError('');
    setNotice('');
    if (!draft.age.trim() || !draft.weightKg.trim() || !draft.heightCm.trim()) {
      setError('Enter your age, weight and height before generating a diet. Example values are not your measurements.');
      return;
    }
    const preferences: NutritionPreferences = {
      ...draft,
      age: Number(draft.age), weightKg: Number(draft.weightKg), heightCm: Number(draft.heightCm),
    };
    if (!validateNutritionPreferences(preferences) || !Number.isInteger(preferences.age)) {
      setError('Enter an adult age of 18–100 whole years, weight of 30–300 kg and height of 120–230 cm. Check that your diet, activity, goal and food exclusions are supported.');
      return;
    }
    setBusy(true);
    try {
      const nutrition = { ...preferences, planSeed: newSeed() };
      calculateNutritionTargets(nutrition);
      const plan = generateIndianDietPlan(nutrition, nutrition.planSeed);
      const current = await getUserProfile();
      const next = { ...current, nutrition };
      await saveUserProfile(next);
      setSaved(nutrition);
      setDraft(toDraft(nutrition));
      setSelectedDay(0);
      setView('Meals');
      setNotice(plan.days.length > 0 ? 'Diet settings saved. Your week is ready.' : 'Diet settings saved, but your exclusions leave too few food groups for a complete menu.');
      onProfileUpdated?.(next);
    } catch {
      setError('Could not save your diet settings. Your previous week is unchanged. Please try again.');
    } finally {
      setBusy(false);
    }
  }

  async function regenerate() {
    if (busy || !derived) return;
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const current = await getUserProfile();
      if (!current.nutrition || !validateNutritionPreferences(current.nutrition)) {
        setError('Your saved diet settings need attention. Open Diet settings and save valid adult measurements.');
        return;
      }
      const nutrition = { ...current.nutrition, planSeed: newSeed() };
      const plan = generateIndianDietPlan(nutrition, nutrition.planSeed);
      const next = { ...current, nutrition };
      await saveUserProfile(next);
      setSaved(nutrition);
      setSelectedDay(0);
      setNotice(plan.days.length > 0 ? 'Another week saved. Your workout history is unchanged.' : 'Settings saved, but your exclusions leave too few food groups for a complete menu.');
      onProfileUpdated?.(next);
    } catch {
      setError('Could not save another week. Your previous week is unchanged. Please try again.');
    } finally {
      setBusy(false);
    }
  }

  if (loading) return <main className="view nutrition-screen"><p role="status">Loading diet settings…</p></main>;
  if (loadError) return (
    <main className="view nutrition-screen">
      <p role="alert">Could not load your diet settings. Nothing has been changed.</p>
      <button className="btn" onClick={() => {
        setLoading(true);
        setLoadError(false);
        setLoadAttempt((attempt) => attempt + 1);
      }}>Try again</button>
    </main>
  );

  const day = derived?.plan.days[selectedDay];
  return (
    <main className="view nutrition-screen" aria-label="Diet and nutrition">
      <div className="nutrition-segments" role="group" aria-label="Nutrition views">
        {(['Meals', 'Calculators', 'Diet settings'] as const).map((label) => (
          <button key={label} type="button" aria-pressed={view === label} onClick={() => setView(label)}>{label}</button>
        ))}
      </div>
      {error && <p className="nutrition-error" role="alert" tabIndex={-1} ref={errorRef}>{error}</p>}
      {notice && <p className="nutrition-support" role="status" tabIndex={-1} ref={noticeRef}>{notice}</p>}

      {view === 'Diet settings' ? (
        <form className="nutrition-stack" onSubmit={save} noValidate aria-label="Diet settings" aria-busy={busy}>
          <section className="nutrition-intro">
            <h2>Make it your diet</h2>
            <p>Build a week of Indian meals around your preferences. Enter your own measurements; nothing is calculated until you save.</p>
            {!saved && <p className="nutrition-support">Diet, activity, goal and equation choices start as editable examples, not facts about you. Age, weight and height are left blank.</p>}
          </section>
          <fieldset className="nutrition-form-fields" disabled={busy}>
          <legend className="sr-only">Your nutrition preferences</legend>
          <details className="nutrition-details" open>
            <summary>Basics</summary>
            <div className="nutrition-fields">
              <div className="nutrition-field">
                <label htmlFor="nutrition-age">Age (18 or older)</label>
                <input id="nutrition-age" className="input" type="number" inputMode="numeric" min="18" max="100" step="1" required value={draft.age} placeholder="Example: 30" onChange={(event) => update('age', event.target.value)} />
              </div>
              <div className="nutrition-field">
                <label htmlFor="nutrition-sex">Equation sex</label>
                <select id="nutrition-sex" className="input" value={draft.equationSex} aria-describedby="nutrition-sex-help" onChange={(event) => update('equationSex', event.target.value as NutritionPreferences['equationSex'])}>
                  <option value="female">Female coefficient</option><option value="male">Male coefficient</option>
                </select>
                <p id="nutrition-sex-help" className="nutrition-support">A sex term in the energy formula, not a description of your gender identity. This binary equation is a general estimate and does not capture every body.</p>
              </div>
              <div className="nutrition-field">
                <label htmlFor="nutrition-weight">Weight (kg)</label>
                <input id="nutrition-weight" className="input" type="number" inputMode="decimal" min="30" max="300" step="any" required value={draft.weightKg} placeholder="Example: 70" onChange={(event) => update('weightKg', event.target.value)} />
              </div>
              <div className="nutrition-field">
                <label htmlFor="nutrition-height">Height (cm)</label>
                <input id="nutrition-height" className="input" type="number" inputMode="decimal" min="120" max="230" step="any" required value={draft.heightCm} placeholder="Example: 170" onChange={(event) => update('heightCm', event.target.value)} />
              </div>
            </div>
          </details>
          <details className="nutrition-details" open>
            <summary>Activity & goal</summary>
            <div className="nutrition-fields">
              <div className="nutrition-field">
                <label htmlFor="nutrition-activity">Usual activity</label>
                <select id="nutrition-activity" className="input" value={draft.activity} onChange={(event) => update('activity', event.target.value as NutritionPreferences['activity'])}>
                  {Object.entries(activityLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                </select>
                <p className="nutrition-support">Include your whole day, not just workouts. This is not measured exercise expenditure.</p>
              </div>
              <div className="nutrition-field">
                <label htmlFor="nutrition-goal">Nutrition goal</label>
                <select id="nutrition-goal" className="input" value={draft.goal} onChange={(event) => update('goal', event.target.value as NutritionPreferences['goal'])}>
                  {Object.entries(goalLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                </select>
              </div>
            </div>
          </details>
          <details className="nutrition-details" open>
            <summary>Diet preference</summary>
            <div className="nutrition-fields">
              <div className="nutrition-field">
                <label htmlFor="nutrition-diet">Diet</label>
                <select id="nutrition-diet" className="input" value={draft.diet} onChange={(event) => update('diet', event.target.value as NutritionPreferences['diet'])}>
                  {Object.entries(dietLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                </select>
                <p className="nutrition-support">Vegetarian includes dairy, but no eggs, meat or fish. Eggetarian adds eggs, but no meat or fish. Non-vegetarian also allows chicken and fish.</p>
              </div>
            </div>
          </details>
          <details className="nutrition-details">
            <summary>Food exclusions{draft.foodExclusions.length > 0 ? ` (${draft.foodExclusions.length})` : ''}</summary>
            <fieldset className="nutrition-exclusions">
              <legend>Leave these foods out of the plan</legend>
              {FOOD_EXCLUSION_OPTIONS.map((option) => (
                <label key={option.id}>
                  <input type="checkbox" checked={draft.foodExclusions.includes(option.id)} onChange={(event) => update('foodExclusions', event.target.checked ? [...draft.foodExclusions, option.id] : draft.foodExclusions.filter((id) => id !== option.id))} />
                  <span>{option.label}</span>
                </label>
              ))}
            </fieldset>
            <p className="nutrition-support">Exclusions are planning filters, not certified allergy safety. Ingredients, packaging and kitchen cross-contamination still need checking.</p>
          </details>
          </fieldset>
          <p className="nutrition-support">For adults seeking general nutrition guidance only. Not a medical diet. If you are pregnant or breastfeeding, have a clinical condition or an eating disorder, consult a qualified professional before using calorie targets.</p>
          <button className="btn primary block" type="submit" disabled={busy}>{busy ? 'Saving diet…' : 'Save & generate diet'}</button>
          <p className="nutrition-support">Saved on this device. Training preferences, reminders and completed workouts stay unchanged.</p>
        </form>
      ) : !derived || !saved ? (
        <section className="nutrition-stack">
          <h2>{view === 'Meals' ? 'Your meals start here' : 'Estimates need your details'}</h2>
          <p>{saved ? 'Your saved details need updating before we can show adult nutrition estimates.' : 'Save your diet settings to see a meal week and nutrition estimates. We will not calculate from example measurements.'}</p>
          <button className="btn primary" onClick={() => setView('Diet settings')}>Open diet settings</button>
        </section>
      ) : view === 'Meals' ? (
        <section className="nutrition-stack" aria-labelledby="nutrition-meals-heading">
          <div className="nutrition-intro">
            <h2 id="nutrition-meals-heading">Your meal week</h2>
            <p>{dietLabels[saved.diet]} Indian meals, using your saved settings.</p>
            <p className="nutrition-support">All food numbers are approximate. Household portions, recipes and cooking oil vary. These are suggested meals, not a record of what you ate.</p>
          </div>
          {derived.plan.days.length > 0 ? <div className="nutrition-field">
            <label htmlFor="nutrition-day">Choose a day</label>
            <select id="nutrition-day" className="input" value={selectedDay} onChange={(event) => setSelectedDay(Number(event.target.value))}>
              {derived.plan.days.map((item, index) => <option key={index} value={index}>{item.label}</option>)}
            </select>
          </div> : <section className="nutrition-stack"><h3>No complete menu available</h3><p>Your exclusions leave too few food groups for a varied meal week. Adjust your exclusions or ask a qualified professional for a suitable plan.</p><button className="btn" onClick={() => setView('Diet settings')}>Review food exclusions</button></section>}
          {day && <>
            <section className="nutrition-day-summary" aria-label="Approximate daily totals">
              <h3>{day.label} totals</h3>
              <p>About <strong>{number(day.calories)} kcal</strong> · <strong>{number(day.proteinG)} g protein</strong></p>
              <p>{number(day.carbsG)} g carbs · {number(day.fatG)} g fat</p>
              <p className="nutrition-support">Energy estimate: {number(derived.targets.calories)} kcal. This menu is {number(Math.abs(day.calories - derived.targets.calories))} kcal {day.calories >= derived.targets.calories ? 'above' : 'below'} that estimate.</p>
              <p className="nutrition-support">Protein estimate: {number(derived.targets.proteinG)} g. Menu difference: {number(Math.abs(day.proteinG - derived.targets.proteinG))} g {day.proteinG >= derived.targets.proteinG ? 'above' : 'below'}.</p>
            </section>
            <div className="nutrition-meals">
              {day.meals.map((meal, index) => (
                <article className="nutrition-meal" key={`${meal.name}-${index}`}>
                  <h3>{meal.name}</h3>
                  <ul>
                    {meal.foods.map((food, foodIndex) => (
                      <li key={`${food.foodId}-${foodIndex}`}>
                        <strong>{food.name}</strong>
                        <span>{food.portion}</span>
                        <span className="nutrition-support">Approx. {number(food.calories)} kcal · {number(food.proteinG)} g protein · {number(food.carbsG)} g carbs · {number(food.fatG)} g fat</span>
                      </li>
                    ))}
                  </ul>
                  <p className="nutrition-support">Meal total: approx. {number(meal.calories)} kcal · {number(meal.proteinG)} g protein</p>
                </article>
              ))}
            </div>
          </>}
          {derived.plan.notes.length > 0 && <section className="nutrition-stack nutrition-notes"><h3>About this plan</h3><ul>{derived.plan.notes.map((note, index) => <li key={index}>{note}</li>)}</ul></section>}
          {derived.plan.days.length > 0 && <><button className="btn" disabled={busy} onClick={regenerate}>{busy ? 'Saving another week…' : 'Generate another week'}</button><p className="nutrition-support">Uses saved settings only. Unsaved edits stay in Diet settings; past workouts are never rewritten.</p></>}
        </section>
      ) : (
        <section className="nutrition-stack" aria-labelledby="nutrition-calculators-heading">
          <div className="nutrition-intro"><h2 id="nutrition-calculators-heading">Nutrition estimates</h2><p>General estimates from your saved measurements, not precise requirements or measured calories burned.</p></div>
          <section className="nutrition-calculator">
            <h3>Daily energy</h3>
            <dl><div><dt>Resting energy (BMR)</dt><dd>About {number(derived.targets.bmr)} kcal/day</dd></div><div><dt>Usual daily energy (TDEE)</dt><dd>About {number(derived.targets.tdee)} kcal/day</dd></div><div><dt>Goal-adjusted estimate</dt><dd>About {number(derived.targets.calories)} kcal/day</dd></div></dl>
            <p className="nutrition-support">Mifflin–St Jeor equation: 10 × weight (kg) + 6.25 × height (cm) − 5 × age + a sex coefficient (+5 male, −161 female). TDEE multiplies resting energy by an activity estimate.</p>
          </section>
          <section className="nutrition-calculator"><h3>Daily macro estimates</h3><dl><div><dt>Protein</dt><dd>{number(derived.targets.proteinG)} g</dd></div><div><dt>Carbohydrates</dt><dd>{number(derived.targets.carbsG)} g</dd></div><div><dt>Fat</dt><dd>{number(derived.targets.fatG)} g</dd></div></dl><p className="nutrition-support">Planning estimates, not a requirement to hit every gram. Actual meal totals are shown in Meals and can differ.</p></section>
          <section className="nutrition-calculator"><h3>Body mass index (BMI)</h3><p>{derived.targets.bmi.toFixed(1)} kg/m²</p><p className="nutrition-support">Weight (kg) ÷ height (m)². This is a population-level screening measure, not a diagnosis, body-fat measurement or ideal-weight recommendation. It does not distinguish muscle from fat.</p></section>
          <section className="nutrition-calculator"><h3>Inputs used</h3><dl><div><dt>Measurements</dt><dd>{saved.age} years · {saved.weightKg} kg · {saved.heightCm} cm</dd></div><div><dt>Equation sex term</dt><dd>{saved.equationSex === 'female' ? 'Female' : 'Male'} coefficient</dd></div><div><dt>Activity</dt><dd>{activityLabels[saved.activity]}</dd></div><div><dt>Goal</dt><dd>{goalLabels[saved.goal]}</dd></div></dl><button className="btn" onClick={() => setView('Diet settings')}>Edit diet settings</button></section>
          {derived.targets.warnings?.map((warning, index) => <p className="nutrition-support" key={index}>{warning}</p>)}
          <p className="nutrition-support">Adult general guidance only, not medical advice. Pregnancy, breastfeeding, clinical conditions and eating disorders require personalised professional guidance.</p>
        </section>
      )}
    </main>
  );
}
