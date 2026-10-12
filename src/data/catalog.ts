import { exercises as repdbExercises } from '@repdb/exercises';
import type { Exercise, LocationType, Movement, MuscleId } from './types';
import { DEFAULT_EQUIPMENT } from './equipment';

/**
 * Built-in curated catalogue (source: 'atlas').
 *
 * These entries are original Atlas Fit content with manually reviewed
 * primary/secondary muscle assignments (§8.2 — teaching approximations, not
 * measured activation). They ship offline and are always available.
 */
export const CURATED_EXERCISES: Exercise[] = [
  {
    id: 'push-up',
    name: 'Push-up',
    aliases: ['press up', 'pushup'],
    source: 'atlas',
    equipmentIds: ['bodyweight'],
    movement: 'hpush',
    difficulty: 1,
    primary: ['chest'],
    secondary: ['front_delts', 'triceps'],
    instructions: [
      'Start in a plank with hands under shoulders and body in one line.',
      'Lower your chest toward the floor by bending the elbows to about 45 degrees.',
      'Push the floor away to return to the top without letting hips sag.',
    ],
    cues: ['Ribs down, glutes tight', 'Chest to floor, not nose'],
    mistakes: ['Hips sagging', 'Flaring elbows to 90 degrees', 'Half range of motion'],
    substitutes: ['incline-push-up', 'db-floor-press', 'band-chest-press'],
  },
  {
    id: 'incline-push-up',
    name: 'Incline Push-up',
    aliases: ['elevated push-up'],
    source: 'atlas',
    equipmentIds: ['bodyweight', 'chair'],
    movement: 'hpush',
    difficulty: 1,
    primary: ['chest'],
    secondary: ['front_delts', 'triceps'],
    instructions: [
      'Place hands on a sturdy raised surface, body in a straight line.',
      'Lower your chest to the surface with control.',
      'Press back up to full arm extension.',
    ],
    cues: ['Higher surface = easier', 'Keep a rigid plank line'],
    mistakes: ['Bending at the hips', 'Shrugging shoulders to ears'],
    substitutes: ['push-up', 'band-chest-press'],
  },
  {
    id: 'pike-push-up',
    name: 'Pike Push-up',
    aliases: ['pike press'],
    source: 'atlas',
    equipmentIds: ['bodyweight'],
    movement: 'vpush',
    difficulty: 2,
    primary: ['front_delts', 'side_delts'],
    secondary: ['triceps', 'traps'],
    instructions: [
      'From a push-up position, walk feet in and lift hips high.',
      'Bend elbows to lower the top of your head toward the floor.',
      'Press back up, keeping hips high throughout.',
    ],
    cues: ['Hips high like an upside-down V', 'Head moves forward of hands'],
    mistakes: ['Letting hips drop into a regular push-up', 'Neck craning'],
    substitutes: ['db-shoulder-press', 'chair-dip'],
  },
  {
    id: 'chair-dip',
    name: 'Chair Dip',
    aliases: ['bench dip', 'tricep dip'],
    source: 'atlas',
    equipmentIds: ['chair'],
    movement: 'vpush',
    difficulty: 1,
    primary: ['triceps'],
    secondary: ['chest', 'front_delts'],
    instructions: [
      'Sit on a sturdy chair edge, hands beside hips, fingers forward.',
      'Walk feet out and lower your body by bending the elbows.',
      'Press through your palms back to the top. Stop before shoulder pain.',
    ],
    cues: ['Shoulders down away from ears', 'Shallow range first'],
    mistakes: ['Shrugging', 'Dropping too deep too soon'],
    substitutes: ['push-up', 'db-triceps-extension'],
  },
  {
    id: 'bodyweight-squat',
    name: 'Bodyweight Squat',
    aliases: ['air squat'],
    source: 'atlas',
    equipmentIds: ['bodyweight'],
    movement: 'squat',
    difficulty: 1,
    primary: ['quads', 'glutes'],
    secondary: ['hamstrings', 'calves'],
    instructions: [
      'Stand with feet shoulder-width apart, toes slightly out.',
      'Push hips back and bend knees, keeping chest proud.',
      'Drive through the whole foot to stand back up.',
    ],
    cues: ['Knees track over toes', 'Heels stay planted'],
    mistakes: ['Knees caving inward', 'Heels lifting', 'Rounding the lower back'],
    substitutes: ['step-up', 'db-goblet-squat', 'band-squat'],
  },
  {
    id: 'split-squat',
    name: 'Split Squat',
    aliases: ['static lunge'],
    source: 'atlas',
    equipmentIds: ['bodyweight'],
    movement: 'squat',
    difficulty: 2,
    primary: ['quads', 'glutes'],
    secondary: ['hamstrings', 'calves'],
    instructions: [
      'Take a long staggered stance, torso tall.',
      'Lower straight down until the back knee nears the floor.',
      'Drive up through the front foot; repeat, then switch sides.',
    ],
    cues: ['Most weight on the front leg', 'Torso stays vertical'],
    mistakes: ['Stance too short', 'Leaning far forward'],
    substitutes: ['db-lunge', 'step-up'],
  },
  {
    id: 'glute-bridge',
    name: 'Glute Bridge',
    aliases: ['hip bridge'],
    source: 'atlas',
    equipmentIds: ['bodyweight', 'mat'],
    movement: 'hinge',
    difficulty: 1,
    primary: ['glutes'],
    secondary: ['hamstrings', 'erectors'],
    instructions: [
      'Lie on your back, knees bent, feet flat and close to hips.',
      'Squeeze glutes and lift hips until knees-hips-shoulders align.',
      'Lower slowly without fully relaxing between reps.',
    ],
    cues: ['Push the floor away with your feet', 'Ribs stay down'],
    mistakes: ['Overarching the lower back', 'Pushing through the toes only'],
    substitutes: ['db-hip-thrust', 'kb-swing'],
  },
  {
    id: 'single-leg-rdl-bw',
    name: 'Single-leg Romanian Deadlift (bodyweight)',
    aliases: ['single leg rdl', 'one-leg deadlift'],
    source: 'atlas',
    equipmentIds: ['bodyweight'],
    movement: 'hinge',
    difficulty: 2,
    primary: ['hamstrings', 'glutes'],
    secondary: ['erectors', 'calves'],
    instructions: [
      'Stand on one leg with a soft knee, hands at sides.',
      'Hinge at the hip, reaching the free leg back as torso lowers.',
      'Squeeze the standing glute to return. Hold a wall for balance if needed.',
    ],
    cues: ['Hips stay square', 'Feel a stretch in the standing hamstring'],
    mistakes: ['Rounding the back', 'Rotating the hips open'],
    substitutes: ['db-rdl', 'glute-bridge'],
  },
  {
    id: 'plank',
    name: 'Forearm Plank',
    aliases: ['plank hold'],
    source: 'atlas',
    equipmentIds: ['mat'],
    movement: 'core',
    difficulty: 1,
    primary: ['abs'],
    secondary: ['obliques', 'glutes'],
    instructions: [
      'Rest on forearms and toes with elbows under shoulders.',
      'Squeeze glutes and brace the trunk; body forms one line.',
      'Breathe steadily and hold with quality form, not maximum time.',
    ],
    cues: ['Push the floor away', 'Stop the set when hips sag'],
    mistakes: ['Hips sagging or piking', 'Holding breath'],
    substitutes: ['dead-bug', 'side-plank'],
  },
  {
    id: 'dead-bug',
    name: 'Dead Bug',
    aliases: ['deadbug'],
    source: 'atlas',
    equipmentIds: ['mat'],
    movement: 'core',
    difficulty: 1,
    primary: ['abs'],
    secondary: ['obliques'],
    instructions: [
      'Lie on your back, arms to ceiling, hips and knees at 90 degrees.',
      'Press your lower back into the floor.',
      'Slowly extend opposite arm and leg, then return; alternate sides.',
    ],
    cues: ['Back stays glued to the floor', 'Move slowly'],
    mistakes: ['Back arching off the floor', 'Rushing the reps'],
    substitutes: ['plank', 'bird-dog'],
  },
  {
    id: 'side-plank',
    name: 'Side Plank',
    aliases: [],
    source: 'atlas',
    equipmentIds: ['mat'],
    movement: 'core',
    difficulty: 2,
    primary: ['obliques'],
    secondary: ['abs', 'glutes'],
    instructions: [
      'Lie on your side, elbow under shoulder, legs stacked.',
      'Lift hips until body forms a straight line.',
      'Hold with steady breathing; repeat on the other side.',
    ],
    cues: ['Top foot in front of bottom foot to make it easier', 'Hips forward'],
    mistakes: ['Hips dropping', 'Rolling forward'],
    substitutes: ['plank', 'dead-bug'],
  },
  {
    id: 'bird-dog',
    name: 'Bird Dog',
    aliases: ['birddog'],
    source: 'atlas',
    equipmentIds: ['mat'],
    movement: 'core',
    difficulty: 1,
    primary: ['erectors'],
    secondary: ['abs', 'glutes'],
    instructions: [
      'Start on hands and knees, back flat.',
      'Extend opposite arm and leg slowly without rocking the hips.',
      'Pause briefly, return, and alternate sides.',
    ],
    cues: ['Move like balancing a glass on your back', 'Long spine'],
    mistakes: ['Hips rotating', 'Overarching when the leg lifts'],
    substitutes: ['dead-bug', 'superman-hold'],
  },
  {
    id: 'superman-hold',
    name: 'Superman Hold',
    aliases: ['prone back extension'],
    source: 'atlas',
    equipmentIds: ['mat'],
    movement: 'core',
    difficulty: 1,
    primary: ['erectors'],
    secondary: ['glutes', 'upper_back'],
    instructions: [
      'Lie face down with arms extended overhead.',
      'Lift chest, arms and legs a few inches off the floor.',
      'Hold briefly, then lower with control.',
    ],
    cues: ['Look at the floor, not forward', 'Squeeze glutes at the top'],
    mistakes: ['Yanking into extension', 'Holding breath'],
    substitutes: ['bird-dog', 'back-extension-bench'],
  },
  {
    id: 'doorway-row',
    name: 'Table / Doorway Row',
    aliases: ['inverted row', 'australian pull-up'],
    source: 'atlas',
    equipmentIds: ['bodyweight'],
    movement: 'hpull',
    difficulty: 1,
    primary: ['lats', 'upper_back'],
    secondary: ['biceps', 'rear_delts'],
    instructions: [
      'Grip a sturdy table edge or doorframe and lean back, body straight.',
      'Pull your chest toward your hands, squeezing shoulder blades.',
      'Lower with control to straight arms.',
    ],
    cues: ['Body rigid like a plank', 'Lead with the chest'],
    mistakes: ['Using an unstable anchor', 'Sagging hips'],
    substitutes: ['db-row', 'band-row', 'suspension-row'],
  },
  {
    id: 'negative-pull-up',
    name: 'Negative Pull-up',
    aliases: ['eccentric pull-up'],
    source: 'atlas',
    equipmentIds: ['pullup-bar'],
    movement: 'vpull',
    difficulty: 2,
    primary: ['lats'],
    secondary: ['biceps', 'rear_delts'],
    instructions: [
      'Step or jump to the top position, chin over the bar.',
      'Lower yourself as slowly as possible to straight arms.',
      'Step back up and repeat. Stop if you cannot control the descent.',
    ],
    cues: ['Aim for a 3–5 second lowering', 'Chest up'],
    mistakes: ['Dropping the last few inches', 'Swinging'],
    substitutes: ['doorway-row', 'lat-pulldown', 'assisted-pull-up'],
  },
  {
    id: 'hanging-knee-raise',
    name: 'Hanging Knee Raise',
    aliases: ['captains chair knee raise'],
    source: 'atlas',
    equipmentIds: ['pullup-bar'],
    movement: 'core',
    difficulty: 2,
    primary: ['abs'],
    secondary: ['forearms', 'obliques'],
    instructions: [
      'Hang from a bar with straight arms and active shoulders.',
      'Curl knees up toward the chest without swinging.',
      'Lower legs slowly back to the hang.',
    ],
    cues: ['Tuck the pelvis', 'Control the swing'],
    mistakes: ['Kipping for momentum', 'Half range'],
    substitutes: ['dead-bug', 'plank'],
  },
  {
    id: 'step-up',
    name: 'Step-up',
    aliases: ['box step-up'],
    source: 'atlas',
    equipmentIds: ['chair'],
    movement: 'squat',
    difficulty: 1,
    primary: ['quads', 'glutes'],
    secondary: ['calves', 'hamstrings'],
    instructions: [
      'Face a sturdy step or low chair.',
      'Place one foot fully on the step and drive up through it.',
      'Lower with control; repeat, then switch sides.',
    ],
    cues: ['Whole foot on the step', 'Knee over ankle'],
    mistakes: ['Pushing off the trailing leg', 'Knee caving in'],
    substitutes: ['bodyweight-squat', 'split-squat'],
  },
  {
    id: 'db-bench-press',
    name: 'Dumbbell Bench Press',
    aliases: ['db press'],
    source: 'atlas',
    equipmentIds: ['dumbbells', 'bench'],
    movement: 'hpush',
    difficulty: 1,
    primary: ['chest'],
    secondary: ['front_delts', 'triceps'],
    instructions: [
      'Lie on a bench, dumbbells at chest level, feet planted.',
      'Press the weights up until arms are extended, not locked.',
      'Lower slowly to a light chest stretch and repeat.',
    ],
    cues: ['Elbows at roughly 45 degrees', 'Wrists stacked over elbows'],
    mistakes: ['Bouncing the weights', 'Arching excessively'],
    substitutes: ['push-up', 'band-chest-press', 'barbell-bench'],
  },
  {
    id: 'db-floor-press',
    name: 'Dumbbell Floor Press',
    aliases: ['floor press'],
    source: 'atlas',
    equipmentIds: ['dumbbells', 'mat'],
    movement: 'hpush',
    difficulty: 1,
    primary: ['chest', 'triceps'],
    secondary: ['front_delts'],
    instructions: [
      'Lie on the floor, knees bent, dumbbells at chest level.',
      'Press up until arms are extended.',
      'Lower until upper arms rest lightly on the floor.',
    ],
    cues: ['Pause on the floor each rep', 'Keep ribs down'],
    mistakes: ['Flaring elbows wide', 'Rushing the lowering'],
    substitutes: ['push-up', 'db-bench-press'],
  },
  {
    id: 'db-shoulder-press',
    name: 'Dumbbell Shoulder Press',
    aliases: ['overhead press', 'db ohp'],
    source: 'atlas',
    equipmentIds: ['dumbbells'],
    movement: 'vpush',
    difficulty: 2,
    primary: ['front_delts', 'side_delts'],
    secondary: ['triceps', 'traps'],
    instructions: [
      'Stand or sit tall, dumbbells at shoulder height, palms in.',
      'Press overhead until arms are extended without shrugging.',
      'Lower with control to shoulder height.',
    ],
    cues: ['Brace the trunk', 'Head stays neutral'],
    mistakes: ['Arching the lower back', 'Pressing in front of the face'],
    substitutes: ['pike-push-up', 'db-lateral-raise'],
  },
  {
    id: 'db-row',
    name: 'One-arm Dumbbell Row',
    aliases: ['single arm row'],
    source: 'atlas',
    equipmentIds: ['dumbbells', 'chair'],
    movement: 'hpull',
    difficulty: 1,
    primary: ['lats', 'upper_back'],
    secondary: ['biceps', 'rear_delts'],
    instructions: [
      'Brace one knee and hand on a bench or chair, back flat.',
      'Pull the dumbbell to the hip, driving the elbow back.',
      'Lower slowly to full arm extension; repeat, then switch.',
    ],
    cues: ['Flat back', 'Elbow drives, hand just holds'],
    mistakes: ['Twisting the torso', 'Shrugging the weight up'],
    substitutes: ['band-row', 'seated-cable-row', 'barbell-row'],
  },
  {
    id: 'db-rdl',
    name: 'Dumbbell Romanian Deadlift',
    aliases: ['db rdl', 'dumbbell hinge'],
    source: 'atlas',
    equipmentIds: ['dumbbells'],
    movement: 'hinge',
    difficulty: 2,
    primary: ['hamstrings', 'glutes'],
    secondary: ['erectors', 'forearms'],
    instructions: [
      'Stand tall holding dumbbells in front of thighs.',
      'Push hips back, sliding weights down the legs with a flat back.',
      'Drive hips forward to stand once you feel a hamstring stretch.',
    ],
    cues: ['Hips back, not knees forward', 'Lats on — crush oranges in armpits'],
    mistakes: ['Rounding the back', 'Squatting the weight up'],
    substitutes: ['single-leg-rdl-bw', 'kb-swing', 'barbell-rdl'],
  },
  {
    id: 'db-goblet-squat',
    name: 'Dumbbell Goblet Squat',
    aliases: ['goblet squat'],
    source: 'atlas',
    equipmentIds: ['dumbbells'],
    movement: 'squat',
    difficulty: 1,
    primary: ['quads', 'glutes'],
    secondary: ['erectors', 'calves'],
    instructions: [
      'Hold a dumbbell vertically at chest height, elbows tucked.',
      'Squat down between your knees with chest proud.',
      'Drive through the feet to stand.',
    ],
    cues: ['Elbows inside knees at the bottom', 'Weight on the whole foot'],
    mistakes: ['Heels lifting', 'Collapsing forward'],
    substitutes: ['bodyweight-squat', 'kb-goblet-squat', 'leg-press'],
  },
  {
    id: 'db-lunge',
    name: 'Dumbbell Lunge',
    aliases: ['walking lunge', 'forward lunge'],
    source: 'atlas',
    equipmentIds: ['dumbbells'],
    movement: 'squat',
    difficulty: 2,
    primary: ['quads', 'glutes'],
    secondary: ['hamstrings', 'calves'],
    instructions: [
      'Stand tall holding dumbbells at your sides.',
      'Step forward and lower until both knees are near 90 degrees.',
      'Push through the front foot back to standing; alternate legs.',
    ],
    cues: ['Long step', 'Torso tall'],
    mistakes: ['Front knee shooting past toes with heel lifting', 'Wobbling'],
    substitutes: ['split-squat', 'step-up'],
  },
  {
    id: 'db-curl',
    name: 'Dumbbell Biceps Curl',
    aliases: ['db curl'],
    source: 'atlas',
    equipmentIds: ['dumbbells'],
    movement: 'accessory',
    difficulty: 1,
    primary: ['biceps'],
    secondary: ['forearms'],
    instructions: [
      'Stand tall, dumbbells at sides, palms forward.',
      'Curl the weights toward the shoulders without swinging.',
      'Lower slowly to straight arms.',
    ],
    cues: ['Elbows pinned at ribs', 'No swinging'],
    mistakes: ['Using momentum', 'Curling only partial range'],
    substitutes: ['band-curl', 'doorway-row'],
  },
  {
    id: 'db-triceps-extension',
    name: 'Dumbbell Overhead Triceps Extension',
    aliases: ['overhead extension'],
    source: 'atlas',
    equipmentIds: ['dumbbells'],
    movement: 'accessory',
    difficulty: 1,
    primary: ['triceps'],
    secondary: ['forearms'],
    instructions: [
      'Hold one dumbbell overhead with both hands, elbows pointing forward.',
      'Lower the weight behind your head by bending the elbows.',
      'Extend back overhead. Stop if elbows hurt.',
    ],
    cues: ['Elbows stay still', 'Light weight first'],
    mistakes: ['Flaring elbows wide', 'Arching the back'],
    substitutes: ['chair-dip', 'cable-triceps-pushdown'],
  },
  {
    id: 'db-lateral-raise',
    name: 'Dumbbell Lateral Raise',
    aliases: ['side raise'],
    source: 'atlas',
    equipmentIds: ['dumbbells'],
    movement: 'accessory',
    difficulty: 2,
    primary: ['side_delts'],
    secondary: ['traps', 'front_delts'],
    instructions: [
      'Stand tall with light dumbbells at your sides.',
      'Raise arms out to the side to shoulder height with soft elbows.',
      'Lower slowly; use a weight you can control.',
    ],
    cues: ['Lead with the elbows', 'Stop at shoulder height'],
    mistakes: ['Shrugging heavy weights', 'Swinging'],
    substitutes: ['band-pull-apart'],
  },
  {
    id: 'db-farmer-carry',
    name: 'Dumbbell Farmer Carry',
    aliases: ['farmers walk', 'loaded carry'],
    source: 'atlas',
    equipmentIds: ['dumbbells'],
    movement: 'carry',
    difficulty: 1,
    primary: ['forearms', 'traps'],
    secondary: ['calves', 'glutes'],
    instructions: [
      'Pick up heavy dumbbells and stand tall.',
      'Walk steadily for distance or time with packed shoulders.',
      'Set the weights down with a hinge, not a rounded back.',
    ],
    cues: ['Tall posture', 'Crush the handles'],
    mistakes: ['Leaning to one side', 'Shrugging'],
    substitutes: ['dead-bug', 'plank'],
  },
  {
    id: 'db-hip-thrust',
    name: 'Dumbbell Hip Thrust',
    aliases: ['hip thrust'],
    source: 'atlas',
    equipmentIds: ['dumbbells', 'chair'],
    movement: 'hinge',
    difficulty: 2,
    primary: ['glutes'],
    secondary: ['hamstrings', 'quads'],
    instructions: [
      'Rest upper back on a bench or chair, feet flat, weight on hips.',
      'Drive hips up until knees-hips-shoulders align.',
      'Lower with control without overarching.',
    ],
    cues: ['Chin tucked', 'Squeeze hard at the top'],
    mistakes: ['Overextending the back', 'Feet too far away'],
    substitutes: ['glute-bridge', 'kb-swing'],
  },
  {
    id: 'band-row',
    name: 'Resistance Band Row',
    aliases: ['band seated row'],
    source: 'atlas',
    equipmentIds: ['bands'],
    movement: 'hpull',
    difficulty: 1,
    primary: ['lats', 'upper_back'],
    secondary: ['biceps', 'rear_delts'],
    instructions: [
      'Anchor a band at chest height or loop it around your feet seated.',
      'Sit tall and pull the handles to your ribs.',
      'Squeeze shoulder blades, then extend arms slowly.',
    ],
    cues: ['Chest up', 'Elbows drive back'],
    mistakes: ['Rounding the back', 'Shrugging'],
    substitutes: ['db-row', 'doorway-row', 'seated-cable-row'],
  },
  {
    id: 'band-pull-apart',
    name: 'Band Pull-apart',
    aliases: ['band aparts'],
    source: 'atlas',
    equipmentIds: ['bands'],
    movement: 'hpull',
    difficulty: 1,
    primary: ['rear_delts', 'upper_back'],
    secondary: ['side_delts'],
    instructions: [
      'Hold a light band in front with straight arms.',
      'Pull the band apart until it touches your chest.',
      'Return slowly without letting shoulders roll forward.',
    ],
    cues: ['Light band, perfect reps', 'Pinch shoulder blades'],
    mistakes: ['Bending the elbows a lot', 'Using too heavy a band'],
    substitutes: ['db-lateral-raise', 'cable-face-pull'],
  },
  {
    id: 'band-chest-press',
    name: 'Band Chest Press',
    aliases: ['band press'],
    source: 'atlas',
    equipmentIds: ['bands'],
    movement: 'hpush',
    difficulty: 1,
    primary: ['chest'],
    secondary: ['front_delts', 'triceps'],
    instructions: [
      'Anchor a band behind you at chest height.',
      'Press the handles forward until arms are extended.',
      'Return slowly, controlling the band tension.',
    ],
    cues: ['Step forward for more tension', 'Wrists straight'],
    mistakes: ['Letting the band snap back', 'Shrugging'],
    substitutes: ['push-up', 'db-floor-press'],
  },
  {
    id: 'band-curl',
    name: 'Band Biceps Curl',
    aliases: [],
    source: 'atlas',
    equipmentIds: ['bands'],
    movement: 'accessory',
    difficulty: 1,
    primary: ['biceps'],
    secondary: ['forearms'],
    instructions: [
      'Stand on the band, handles at your sides.',
      'Curl to the shoulders with elbows pinned.',
      'Lower slowly against the band tension.',
    ],
    cues: ['Elbows still', 'Squeeze at the top'],
    mistakes: ['Leaning back to cheat', 'Partial range'],
    substitutes: ['db-curl'],
  },
  {
    id: 'band-squat',
    name: 'Band Squat',
    aliases: [],
    source: 'atlas',
    equipmentIds: ['bands'],
    movement: 'squat',
    difficulty: 1,
    primary: ['quads', 'glutes'],
    secondary: ['hamstrings'],
    instructions: [
      'Stand on the band, handles at shoulder height.',
      'Squat with chest proud and knees tracking over toes.',
      'Drive up through the feet.',
    ],
    cues: ['Band under mid-foot', 'Knees out gently'],
    mistakes: ['Collapsing knees inward', 'Rounding forward'],
    substitutes: ['bodyweight-squat', 'db-goblet-squat'],
  },
  {
    id: 'kb-swing',
    name: 'Kettlebell Swing',
    aliases: ['russian swing'],
    source: 'atlas',
    equipmentIds: ['kettlebell'],
    movement: 'hinge',
    difficulty: 2,
    primary: ['glutes', 'hamstrings'],
    secondary: ['erectors', 'forearms'],
    instructions: [
      'Hike the bell back between your legs with a flat back.',
      'Snap hips forward to float the bell to chest height.',
      'Let the bell fall back down and repeat rhythmically. Learn this supervised first.',
    ],
    cues: ['Hinge, not squat', 'Arms are ropes'],
    mistakes: ['Squatting the swing', 'Lifting with the shoulders'],
    substitutes: ['db-rdl', 'db-hip-thrust', 'glute-bridge'],
  },
  {
    id: 'kb-goblet-squat',
    name: 'Kettlebell Goblet Squat',
    aliases: [],
    source: 'atlas',
    equipmentIds: ['kettlebell'],
    movement: 'squat',
    difficulty: 1,
    primary: ['quads', 'glutes'],
    secondary: ['erectors'],
    instructions: [
      'Hold the bell by the horns at chest height.',
      'Squat deep between your knees with a proud chest.',
      'Drive through the feet to stand.',
    ],
    cues: ['Elbows track inside knees', 'Full-foot pressure'],
    mistakes: ['Heels lifting', 'Bell drifting away from chest'],
    substitutes: ['db-goblet-squat', 'bodyweight-squat'],
  },
  {
    id: 'barbell-squat',
    name: 'Barbell Back Squat',
    aliases: ['back squat'],
    source: 'atlas',
    equipmentIds: ['barbell', 'squat-rack'],
    movement: 'squat',
    difficulty: 3,
    primary: ['quads', 'glutes'],
    secondary: ['erectors', 'hamstrings'],
    instructions: [
      'Set the bar at mid-chest, get tight under it, and unrack with both feet.',
      'Squat down with braced trunk and knees tracking over toes.',
      'Drive up through the whole foot. Use safeties and learn supervised.',
    ],
    cues: ['Big breath and brace each rep', 'Knees out'],
    mistakes: ['Butt wink with excessive depth for your build', 'Knees caving'],
    substitutes: ['db-goblet-squat', 'leg-press', 'split-squat'],
  },
  {
    id: 'barbell-rdl',
    name: 'Barbell Romanian Deadlift',
    aliases: ['barbell rdl'],
    source: 'atlas',
    equipmentIds: ['barbell'],
    movement: 'hinge',
    difficulty: 2,
    primary: ['hamstrings', 'glutes'],
    secondary: ['erectors', 'forearms'],
    instructions: [
      'Stand tall with the bar at your thighs, grip just outside legs.',
      'Push hips back, bar sliding down the legs with a flat back.',
      'Drive hips forward to stand at a strong hamstring stretch.',
    ],
    cues: ['Hips back', 'Bar stays close'],
    mistakes: ['Rounding the lower back', 'Bending the knees too much'],
    substitutes: ['db-rdl', 'kb-swing'],
  },
  {
    id: 'barbell-bench',
    name: 'Barbell Bench Press',
    aliases: ['bench press'],
    source: 'atlas',
    equipmentIds: ['barbell', 'bench'],
    movement: 'hpush',
    difficulty: 2,
    primary: ['chest'],
    secondary: ['front_delts', 'triceps'],
    instructions: [
      'Lie on a bench with feet planted and shoulder blades pinched.',
      'Lower the bar to mid-chest with control.',
      'Press up to extended arms. Use a spotter or safeties.',
    ],
    cues: ['Touch the same chest spot each rep', 'Leg drive'],
    mistakes: ['Bouncing off the chest', 'Flaring elbows'],
    substitutes: ['db-bench-press', 'push-up'],
  },
  {
    id: 'barbell-row',
    name: 'Barbell Bent-over Row',
    aliases: ['bent over row'],
    source: 'atlas',
    equipmentIds: ['barbell'],
    movement: 'hpull',
    difficulty: 2,
    primary: ['lats', 'upper_back'],
    secondary: ['biceps', 'rear_delts'],
    instructions: [
      'Hinge to about 45 degrees holding the bar with a flat back.',
      'Pull the bar to your lower ribs, driving elbows back.',
      'Lower with control to straight arms.',
    ],
    cues: ['Flat back like a tabletop', 'Chest supported by nothing — brace hard'],
    mistakes: ['Standing up to cheat', 'Rounding the back'],
    substitutes: ['db-row', 'seated-cable-row', 'tbar-row'],
  },
  {
    id: 'lat-pulldown',
    name: 'Lat Pulldown',
    aliases: ['pulldown'],
    source: 'atlas',
    equipmentIds: ['lat-pulldown'],
    movement: 'vpull',
    difficulty: 1,
    primary: ['lats'],
    secondary: ['biceps', 'rear_delts'],
    instructions: [
      'Sit tall with thighs secured, gripping the bar wide.',
      'Pull the bar to your upper chest, chest proud.',
      'Return slowly to full arm extension.',
    ],
    cues: ['Lead with elbows', 'No leaning back excessively'],
    mistakes: ['Pulling behind the neck', 'Using momentum'],
    substitutes: ['negative-pull-up', 'assisted-pull-up', 'band-row'],
  },
  {
    id: 'seated-cable-row',
    name: 'Seated Cable Row',
    aliases: ['cable row'],
    source: 'atlas',
    equipmentIds: ['seated-row'],
    movement: 'hpull',
    difficulty: 1,
    primary: ['lats', 'upper_back'],
    secondary: ['biceps', 'rear_delts'],
    instructions: [
      'Sit tall with knees soft and chest up.',
      'Pull the handle to your navel, squeezing shoulder blades.',
      'Extend arms fully with control each rep.',
    ],
    cues: ['Tall torso', 'Pause at the squeeze'],
    mistakes: ['Rocking back and forth', 'Shrugging'],
    substitutes: ['db-row', 'band-row', 'barbell-row'],
  },
  {
    id: 'machine-chest-press',
    name: 'Chest Press Machine',
    aliases: ['machine press'],
    source: 'atlas',
    equipmentIds: ['chest-press'],
    movement: 'hpush',
    difficulty: 1,
    primary: ['chest'],
    secondary: ['front_delts', 'triceps'],
    instructions: [
      'Set the seat so handles align with mid-chest.',
      'Press forward until arms are extended without locking.',
      'Return slowly to a comfortable stretch.',
    ],
    cues: ['Shoulder blades back', 'Control the return'],
    mistakes: ['Seat too high or low', 'Locking elbows hard'],
    substitutes: ['db-bench-press', 'push-up', 'band-chest-press'],
  },
  {
    id: 'leg-press',
    name: 'Leg Press',
    aliases: [],
    source: 'atlas',
    equipmentIds: ['leg-press'],
    movement: 'squat',
    difficulty: 1,
    primary: ['quads', 'glutes'],
    secondary: ['hamstrings', 'calves'],
    instructions: [
      'Sit with back flat and feet hip-width on the platform.',
      'Lower until knees are near 90 degrees without hips lifting.',
      'Press through the whole foot without locking knees.',
    ],
    cues: ['Lower back stays on the pad', 'Heels planted'],
    mistakes: ['Going so deep hips roll off the seat', 'Locking knees'],
    substitutes: ['db-goblet-squat', 'barbell-squat', 'split-squat'],
  },
  {
    id: 'leg-extension',
    name: 'Leg Extension',
    aliases: [],
    source: 'atlas',
    equipmentIds: ['leg-extension'],
    movement: 'accessory',
    difficulty: 1,
    primary: ['quads'],
    secondary: [],
    instructions: [
      'Sit with knees aligned to the machine pivot, pad at the ankles.',
      'Extend knees to straight without jerking.',
      'Lower slowly. Use a comfortable range if knees are sensitive.',
    ],
    cues: ['Light and controlled', 'Pause at the top'],
    mistakes: ['Kicking with momentum', 'Forcing painful ranges'],
    substitutes: ['step-up', 'split-squat'],
  },
  {
    id: 'leg-curl',
    name: 'Lying / Seated Leg Curl',
    aliases: ['hamstring curl'],
    source: 'atlas',
    equipmentIds: ['leg-curl'],
    movement: 'accessory',
    difficulty: 1,
    primary: ['hamstrings'],
    secondary: ['glutes', 'calves'],
    instructions: [
      'Align knees with the pivot and secure the pads.',
      'Curl the heels toward your glutes.',
      'Lower slowly to full extension.',
    ],
    cues: ['Hips stay down', 'Squeeze at the top'],
    mistakes: ['Lifting hips off the pad', 'Partial range'],
    substitutes: ['db-rdl', 'single-leg-rdl-bw'],
  },
  {
    id: 'cable-triceps-pushdown',
    name: 'Cable Triceps Pushdown',
    aliases: ['pushdown'],
    source: 'atlas',
    equipmentIds: ['cable'],
    movement: 'accessory',
    difficulty: 1,
    primary: ['triceps'],
    secondary: ['forearms'],
    instructions: [
      'Stand tall at a high pulley, elbows pinned at your sides.',
      'Press the handle down until arms are straight.',
      'Return slowly to 90 degrees.',
    ],
    cues: ['Elbows glued to ribs', 'Shoulders down'],
    mistakes: ['Leaning into the rep', 'Letting elbows drift forward'],
    substitutes: ['db-triceps-extension', 'chair-dip'],
  },
  {
    id: 'cable-face-pull',
    name: 'Cable Face Pull',
    aliases: ['face pull'],
    source: 'atlas',
    equipmentIds: ['cable'],
    movement: 'hpull',
    difficulty: 2,
    primary: ['rear_delts', 'upper_back'],
    secondary: ['biceps', 'traps'],
    instructions: [
      'Set a pulley at eye height with a rope attachment.',
      'Pull to your forehead, rotating knuckles back and elbows high.',
      'Return slowly with control.',
    ],
    cues: ['Elbows high', 'Light weight, perfect form'],
    mistakes: ['Pulling to the chin with low elbows', 'Too heavy'],
    substitutes: ['band-pull-apart', 'db-row'],
  },
  {
    id: 'assisted-pull-up',
    name: 'Assisted Pull-up',
    aliases: ['machine pull-up'],
    source: 'atlas',
    equipmentIds: ['assisted-pullup'],
    movement: 'vpull',
    difficulty: 2,
    primary: ['lats'],
    secondary: ['biceps', 'rear_delts'],
    instructions: [
      'Set a counterweight that lets you do controlled reps.',
      'Pull your chest to the bar from straight arms.',
      'Lower fully with control each rep.',
    ],
    cues: ['Full range both ways', 'Less help over time'],
    mistakes: ['Half reps', 'Kipping'],
    substitutes: ['lat-pulldown', 'negative-pull-up'],
  },
  {
    id: 'ab-wheel-rollout',
    name: 'Ab Wheel Rollout',
    aliases: ['ab rollout'],
    source: 'atlas',
    equipmentIds: ['ab-wheel'],
    movement: 'core',
    difficulty: 3,
    primary: ['abs'],
    secondary: ['lats', 'erectors'],
    instructions: [
      'Kneel with the wheel under your shoulders.',
      'Roll forward as far as you can without your back arching.',
      'Pull back to the start using your trunk. Start with short range.',
    ],
    cues: ['Short range first', 'Hips tucked'],
    mistakes: ['Sagging the lower back', 'Going too far too soon'],
    substitutes: ['plank', 'dead-bug'],
  },
  {
    id: 'suspension-row',
    name: 'Suspension Row',
    aliases: ['trx row'],
    source: 'atlas',
    equipmentIds: ['suspension'],
    movement: 'hpull',
    difficulty: 2,
    primary: ['lats', 'upper_back'],
    secondary: ['biceps', 'rear_delts'],
    instructions: [
      'Lean back holding the handles, body in a straight line.',
      'Pull your chest to your hands.',
      'Extend arms slowly. Walk feet forward to make it harder.',
    ],
    cues: ['Body rigid', 'Squeeze shoulder blades'],
    mistakes: ['Sagging hips', 'Shrugging'],
    substitutes: ['doorway-row', 'band-row', 'db-row'],
  },
  {
    id: 'machine-hip-thrust',
    name: 'Hip Thrust Machine',
    aliases: ['glute drive'],
    source: 'atlas',
    equipmentIds: ['hip-thrust'],
    movement: 'hinge',
    difficulty: 1,
    primary: ['glutes'],
    secondary: ['hamstrings', 'quads'],
    instructions: [
      'Set up with shoulders on the pad and feet flat.',
      'Drive hips up until the body forms a straight line.',
      'Lower with control.',
    ],
    cues: ['Chin tucked', 'Full hip extension'],
    mistakes: ['Overarching', 'Feet sliding'],
    substitutes: ['db-hip-thrust', 'glute-bridge'],
  },
  {
    id: 'machine-calf-raise',
    name: 'Calf Raise Machine',
    aliases: ['standing calf raise'],
    source: 'atlas',
    equipmentIds: ['calf-raise'],
    movement: 'accessory',
    difficulty: 1,
    primary: ['calves'],
    secondary: [],
    instructions: [
      'Place the balls of your feet on the platform.',
      'Rise as high as possible onto your toes.',
      'Lower to a full stretch and repeat.',
    ],
    cues: ['Pause at the top', 'Full stretch at the bottom'],
    mistakes: ['Bouncing', 'Half range'],
    substitutes: ['step-up', 'db-farmer-carry'],
  },
  {
    id: 'back-extension-bench',
    name: 'Back Extension',
    aliases: ['hyperextension'],
    source: 'atlas',
    equipmentIds: ['back-extension'],
    movement: 'hinge',
    difficulty: 1,
    primary: ['erectors', 'glutes'],
    secondary: ['hamstrings'],
    instructions: [
      'Set the pad at hip height and cross arms at your chest.',
      'Lower with a flat back to a light hamstring stretch.',
      'Extend to a straight line — do not hyperextend.',
    ],
    cues: ['Straight line at the top', 'Controlled lowering'],
    mistakes: ['Hyperextending past straight', 'Rounding'],
    substitutes: ['superman-hold', 'bird-dog', 'db-rdl'],
  },
  {
    id: 'treadmill-walk',
    name: 'Treadmill Brisk Walk',
    aliases: ['incline walk', 'cardio walk'],
    source: 'atlas',
    equipmentIds: ['treadmill'],
    movement: 'carry',
    difficulty: 1,
    primary: ['calves', 'quads'],
    secondary: ['glutes', 'hamstrings'],
    instructions: [
      'Warm up at an easy pace for a few minutes.',
      'Add a gentle incline and walk briskly, arms swinging.',
      'Cool down at an easy pace to finish.',
    ],
    cues: ['Posture tall', 'Nose breathing where possible'],
    mistakes: ['Holding the rails and leaning back', 'Too much incline too soon'],
    substitutes: ['db-farmer-carry'],
  },
];

/* =========================================================================
   RepDB Normalization & Taxonomy Layer (§8 & §9 of spec)
   ========================================================================= */

/** Mapping RepDB muscles to canonical MuscleId (§8.1). */
const MUSCLE_MAP: Record<string, MuscleId> = {
  // Chest
  pectoralis_major: 'chest',
  pectoralis_minor: 'chest',
  chest: 'chest',
  serratus_anterior: 'chest',

  // Deltoids
  anterior_deltoid: 'front_delts',
  front_delts: 'front_delts',
  lateral_deltoid: 'side_delts',
  side_delts: 'side_delts',
  supraspinatus: 'side_delts',
  posterior_deltoid: 'rear_delts',
  rear_delts: 'rear_delts',

  // Arms
  biceps_brachii: 'biceps',
  brachialis: 'biceps',
  biceps: 'biceps',
  triceps_brachii: 'triceps',
  triceps: 'triceps',

  // Forearms
  forearms: 'forearms',
  brachioradialis: 'forearms',
  forearm_extensors: 'forearms',
  forearm_flexors: 'forearms',
  wrist_flexors: 'forearms',
  wrist_extensors: 'forearms',

  // Back & Neck
  trapezius: 'traps',
  traps: 'traps',
  neck: 'traps',
  latissimus_dorsi: 'lats',
  lats: 'lats',
  rhomboids: 'upper_back',
  upper_back: 'upper_back',
  teres_major: 'upper_back',
  erector_spinae: 'erectors',
  lower_back: 'erectors',
  erectors: 'erectors',
  quadratus_lumborum: 'erectors',

  // Core
  rectus_abdominis: 'abs',
  transverse_abdominis: 'abs',
  abs: 'abs',
  obliques: 'obliques',

  // Glutes
  gluteus_maximus: 'glutes',
  gluteus_medius: 'glutes',
  gluteus_minimus: 'glutes',
  glutes: 'glutes',
  abductors: 'glutes',

  // Quads & Legs
  quadriceps: 'quads',
  rectus_femoris: 'quads',
  vastus_lateralis: 'quads',
  vastus_medialis: 'quads',
  vastus_intermedius: 'quads',
  quads: 'quads',
  adductors: 'quads',
  hip_flexors: 'quads',

  // Hamstrings
  hamstrings: 'hamstrings',
  biceps_femoris: 'hamstrings',
  semitendinosus: 'hamstrings',
  semimembranosus: 'hamstrings',

  // Calves
  gastrocnemius: 'calves',
  soleus: 'calves',
  calves: 'calves',
  tibialis_anterior: 'calves',
};

function normalizeMuscle(m: string): MuscleId | null {
  const key = m.toLowerCase().trim().replace(/-/g, '_');
  return MUSCLE_MAP[key] ?? null;
}

function normalizeMuscles(muscles: string[] | undefined, fallbackBodyPart?: string): MuscleId[] {
  const result: MuscleId[] = [];
  if (muscles) {
    for (const m of muscles) {
      const canonical = normalizeMuscle(m);
      if (canonical && !result.includes(canonical)) {
        result.push(canonical);
      }
    }
  }
  if (result.length === 0 && fallbackBodyPart) {
    const bp = fallbackBodyPart.toLowerCase();
    if (bp === 'chest') result.push('chest');
    else if (bp === 'shoulders') result.push('front_delts');
    else if (bp === 'upper_arms') result.push('biceps');
    else if (bp === 'lower_arms') result.push('forearms');
    else if (bp === 'back') result.push('upper_back');
    else if (bp === 'core') result.push('abs');
    else if (bp === 'upper_legs') result.push('quads');
    else if (bp === 'lower_legs') result.push('calves');
    else result.push('abs');
  }
  return result;
}

/** Map RepDB equipment string to canonical Equipment IDs (§6.4). */
function mapRepdbEquipment(eqRaw: string | undefined, name: string, bodyPart: string): string[] {
  const eq = (eqRaw ?? '').toLowerCase().trim();
  const lowerName = name.toLowerCase();
  const lowerBp = bodyPart.toLowerCase();

  let mapped: string[];

  switch (eq) {
    case 'barbell':
      mapped = ['barbell'];
      if (lowerName.includes('bench press') || lowerName.includes('bench')) {
        mapped.push('bench');
      }
      if (lowerName.includes('back squat') || lowerName.includes('squat rack')) {
        mapped.push('squat-rack');
      }
      break;

    case 'dumbbell':
      mapped = ['dumbbells'];
      if (
        lowerName.includes('bench press') ||
        (lowerName.includes('bench') && !lowerName.includes('stretch'))
      ) {
        mapped.push('bench');
      }
      break;

    case 'cable':
      if (lowerName.includes('pulldown') || lowerName.includes('lat pull')) {
        mapped = ['lat-pulldown'];
      } else if (lowerName.includes('seated row')) {
        mapped = ['seated-row'];
      } else {
        mapped = ['cable'];
      }
      break;

    case 'kettlebell':
      mapped = ['kettlebell'];
      break;

    case 'ez_bar':
      mapped = ['ez-bar'];
      if (lowerName.includes('bench press') || lowerName.includes('bench')) {
        mapped.push('bench');
      }
      break;

    case 'resistance_band':
    case 'loop_band':
    case 'band':
      mapped = ['bands'];
      break;

    case 'pull_up_bar':
      mapped = ['pullup-bar'];
      break;

    case 'ab_wheel':
      mapped = ['ab-wheel'];
      break;

    case 'suspension_trainer':
    case 'rings':
    case 'suspension':
      mapped = ['suspension'];
      break;

    case 'flat_bench':
    case 'bench':
      mapped = ['bench'];
      break;

    case 'smith_machine':
      mapped = ['barbell', 'squat-rack'];
      break;

    case 'chest_press_machine':
      mapped = ['chest-press'];
      break;

    case 'shoulder_press_machine':
      mapped = ['shoulder-press'];
      break;

    case 'chest_fly_machine':
    case 'pec_deck':
      mapped = ['pec-deck'];
      break;

    case 'lat_pulldown_machine':
      mapped = ['lat-pulldown'];
      break;

    case 'dip_station':
    case 'dip_machine':
      mapped = ['dip-station'];
      break;

    case 'leg_press':
    case 'hack_squat':
      mapped = ['leg-press'];
      break;

    case 'leg_extension':
      mapped = ['leg-extension'];
      break;

    case 'leg_curl':
      mapped = ['leg-curl'];
      break;

    case 'seated_calf_raise_machine':
    case 'standing_calf_raise_machine':
    case 'donkey_calf_raise_machine':
      mapped = ['calf-raise'];
      break;

    case 'hip_thrust_machine':
      mapped = ['hip-thrust'];
      break;

    case 'hip_adduction_machine':
    case 'hip_abduction_machine':
      mapped = ['adductor'];
      break;

    case 'assisted_pullup_machine':
      mapped = ['assisted-pullup'];
      break;

    case 'back_extension_machine':
    case 'glute_ham_developer':
      mapped = ['back-extension'];
      break;

    case 'preacher_curl_machine':
      mapped = ['preacher'];
      break;

    case 'treadmill':
    case 'stair_climber':
    case 'elliptical':
      mapped = ['treadmill'];
      break;

    case 'rower':
    case 'ski_erg':
      mapped = ['rower'];
      break;

    case 'stationary_bike':
    case 'air_bike':
      mapped = ['cycle'];
      break;

    case 'trap_bar':
    case 'plates':
    case 'shrug_machine':
      mapped = ['barbell'];
      break;

    case 'bicep_curl_machine':
    case 'tricep_extension_machine':
      mapped = ['cable'];
      break;

    case 'plate_loaded_lateral_raise_machine':
    case 'wrist_roller':
      mapped = ['dumbbells'];
      break;

    case 'ab_crunch_machine':
    case 'stability_ball':
      mapped = ['mat'];
      break;

    case 'plyo_box':
      mapped = ['chair'];
      break;

    case 'slam_ball':
      mapped = ['kettlebell'];
      break;

    case 'climbing_rope':
      mapped = ['pullup-bar'];
      break;

    case 'battle_rope':
    case 'sled':
    case 'jump_rope':
    case 'body_weight':
    case 'bodyweight':
    case 'none':
    default:
      if (lowerName.includes('bench dip') || lowerName.includes('bench leg pull')) {
        mapped = ['bench'];
      } else if (
        lowerName.includes('plank') ||
        lowerName.includes('mat') ||
        (lowerBp === 'core' &&
          !lowerName.includes('pull-up') &&
          !lowerName.includes('hanging'))
      ) {
        mapped = ['mat'];
      } else {
        mapped = ['bodyweight'];
      }
      break;
  }

  return mapped;
}

/** Map RepDB force, mechanic, category and body_part to canonical Movement. */
function mapRepdbMovement(raw: (typeof repdbExercises)[number]): Movement {
  const name = raw.name_en.toLowerCase();
  const id = raw.id.toLowerCase();
  const cat = (raw.category ?? '').toLowerCase();
  const bp = (raw.body_part ?? '').toLowerCase();
  const force = (raw.force_type ?? '').toLowerCase();
  const mech = (raw.mechanic ?? '').toLowerCase();
  const prim = raw.primary_muscles ?? [];

  // Mobility / stretching
  if (cat === 'stretching' || name.includes('stretch') || id.includes('stretch')) {
    return 'mobility';
  }

  // Carry / Cardio
  if (
    cat === 'cardio' ||
    name.includes('carry') ||
    name.includes('walk') ||
    name.includes('sled') ||
    id.includes('carry') ||
    id.includes('farmer')
  ) {
    return 'carry';
  }

  // Core
  if (
    bp === 'core' ||
    prim.includes('rectus_abdominis') ||
    prim.includes('transverse_abdominis') ||
    prim.includes('obliques')
  ) {
    return 'core';
  }

  // Accessory: single joint isolation work
  if (
    bp === 'lower_arms' ||
    bp === 'lower_legs' ||
    (name.includes('curl') && !name.includes('leg curl')) ||
    name.includes('tricep') ||
    name.includes('pushdown') ||
    name.includes('kickback') ||
    (name.includes('extension') &&
      !name.includes('back extension') &&
      !name.includes('hyperextension')) ||
    name.includes('lateral raise') ||
    name.includes('front raise') ||
    name.includes('calf raise') ||
    name.includes('leg extension') ||
    name.includes('leg curl') ||
    name.includes('wrist') ||
    name.includes('shrug')
  ) {
    return 'accessory';
  }

  // Squat family
  if (
    name.includes('squat') ||
    name.includes('lunge') ||
    name.includes('step-up') ||
    name.includes('step up') ||
    name.includes('leg press') ||
    name.includes('hack') ||
    name.includes('split squat') ||
    (bp === 'upper_legs' &&
      (prim.includes('quadriceps') || prim.includes('quads')) &&
      force === 'push')
  ) {
    return 'squat';
  }

  // Hinge family
  if (
    name.includes('deadlift') ||
    name.includes('rdl') ||
    name.includes('hip thrust') ||
    name.includes('glute bridge') ||
    name.includes('bridge') ||
    name.includes('good morning') ||
    name.includes('swing') ||
    name.includes('back extension') ||
    name.includes('hyperextension') ||
    name.includes('clean') ||
    name.includes('snatch') ||
    (bp === 'upper_legs' &&
      (prim.includes('gluteus_maximus') || prim.includes('hamstrings')) &&
      (force === 'pull' || force === 'hinge'))
  ) {
    return 'hinge';
  }

  // Vertical pull
  if (
    name.includes('pull-up') ||
    name.includes('pull up') ||
    name.includes('chin-up') ||
    name.includes('chin up') ||
    name.includes('pulldown') ||
    name.includes('lat pull')
  ) {
    return 'vpull';
  }

  // Horizontal pull
  if (
    name.includes('row') ||
    name.includes('face pull') ||
    name.includes('pull-apart') ||
    name.includes('pull apart') ||
    name.includes('reverse fly') ||
    (bp === 'back' && force === 'pull')
  ) {
    return 'hpull';
  }

  // Vertical push
  if (
    name.includes('overhead') ||
    name.includes('shoulder press') ||
    name.includes('military press') ||
    name.includes('arnold press') ||
    name.includes('pike') ||
    name.includes('handstand') ||
    name.includes('dip') ||
    (bp === 'shoulders' && force === 'push')
  ) {
    return 'vpush';
  }

  // Horizontal push
  if (
    name.includes('bench') ||
    name.includes('chest press') ||
    name.includes('push-up') ||
    name.includes('push up') ||
    name.includes('floor press') ||
    name.includes('fly') ||
    (bp === 'chest' && force === 'push')
  ) {
    return 'hpush';
  }

  if (mech === 'isolation') {
    return 'accessory';
  }

  // Fallbacks by body part
  if (bp === 'chest') return 'hpush';
  if (bp === 'shoulders') return 'vpush';
  if (bp === 'back') return 'hpull';
  if (bp === 'upper_legs') return 'squat';

  return 'accessory';
}

/** Map RepDB difficulty strings to 1 | 2 | 3. */
function mapRepdbDifficulty(d: string | undefined): 1 | 2 | 3 {
  if (d === 'advanced') return 3;
  if (d === 'intermediate') return 2;
  return 1;
}

/** Extract cues / mistakes from RepDB tips. */
function extractMistakesFromTips(tips: string[] | undefined, movement: Movement): string[] {
  const mistakes: string[] = [];
  if (tips) {
    for (const tip of tips) {
      const lower = tip.toLowerCase();
      if (
        lower.includes('do not') ||
        lower.includes('avoid') ||
        lower.includes('never') ||
        lower.includes("don't") ||
        lower.includes('stop before') ||
        lower.includes('hyperextend')
      ) {
        mistakes.push(tip);
      }
    }
  }
  if (mistakes.length === 0) {
    switch (movement) {
      case 'squat':
        mistakes.push('Knees caving inward under load', 'Heels lifting off the floor');
        break;
      case 'hinge':
        mistakes.push('Rounding the lower back', 'Hyperextending spine at lockout');
        break;
      case 'hpush':
        mistakes.push('Flaring elbows out to 90 degrees', 'Partial range of motion');
        break;
      case 'vpush':
        mistakes.push('Overarching lower back to push overhead', 'Shrugging shoulders into ears');
        break;
      case 'hpull':
        mistakes.push('Yanking with body momentum', 'Rounding shoulders forward');
        break;
      case 'vpull':
        mistakes.push(
          'Kipping or swinging legs for momentum',
          'Failing to reach full extension at bottom',
        );
        break;
      case 'core':
        mistakes.push('Hips sagging or lower back arching', 'Holding breath');
        break;
      case 'carry':
        mistakes.push('Slumping shoulders or poor posture', 'Uneven, unstable steps');
        break;
      case 'accessory':
        mistakes.push('Using body swing instead of strict isolation', 'Half reps');
        break;
      case 'mobility':
        mistakes.push('Forcing into joint pain', 'Bouncing instead of controlled breathing');
        break;
    }
  }
  return mistakes;
}

/* =========================================================================
   Image Resolution Support (§7 of requirements)
   ========================================================================= */

interface ImageEntry {
  start?: string;
  peak?: string;
  main?: string;
}

const REPDB_IMAGES_BY_ID = new Map<string, ImageEntry>();
const REPDB_IMAGES_BY_NAME = new Map<string, ImageEntry>();

function cleanKey(str: string): string {
  return str.toLowerCase().replace(/[^a-z0-9]/g, '');
}

// Index all image filenames from RepDB
for (const raw of repdbExercises) {
  if (raw.images?.flat) {
    const flat = raw.images.flat;
    const entry: ImageEntry = {
      start: flat.start ? flat.start.split('/').pop() : undefined,
      peak: flat.peak ? flat.peak.split('/').pop() : undefined,
      main: flat.main ? flat.main.split('/').pop() : undefined,
    };
    REPDB_IMAGES_BY_ID.set(raw.id, entry);
    REPDB_IMAGES_BY_NAME.set(cleanKey(raw.name_en), entry);
    if (raw.name_de) REPDB_IMAGES_BY_NAME.set(cleanKey(raw.name_de), entry);
    if (raw.name_es) REPDB_IMAGES_BY_NAME.set(cleanKey(raw.name_es), entry);
  }
}

/**
 * Returns the local public URL for an exercise image, or null if unavailable.
 * Poses: 'start' or 'peak'.
 * Files are located at `/repdb-images/flat/<filename>.webp`.
 */
export function getExerciseImageUrl(ex: Exercise, pose: 'start' | 'peak'): string | null {
  let images = REPDB_IMAGES_BY_ID.get(ex.id);
  if (!images) {
    images = REPDB_IMAGES_BY_NAME.get(cleanKey(ex.name));
  }
  if (!images && ex.aliases) {
    for (const a of ex.aliases) {
      images = REPDB_IMAGES_BY_NAME.get(cleanKey(a));
      if (images) break;
    }
  }
  if (!images) return null;

  const filename =
    images[pose] ??
    (pose === 'start'
      ? images.main ?? images.peak
      : images.main ?? images.start);

  return filename ? `/repdb-images/flat/${filename}` : null;
}

/* =========================================================================
   Catalog Assembly
   ========================================================================= */

// Index variation groups to populate sensible initial substitutes
const VARIATION_GROUPS = new Map<string, string[]>();
for (const raw of repdbExercises) {
  if (raw.variation_group) {
    let list = VARIATION_GROUPS.get(raw.variation_group);
    if (!list) {
      list = [];
      VARIATION_GROUPS.set(raw.variation_group, list);
    }
    list.push(raw.id);
  }
}

function normalizeRepdbExercise(raw: (typeof repdbExercises)[number]): Exercise {
  const movement = mapRepdbMovement(raw);
  const primary = normalizeMuscles(raw.primary_muscles, raw.body_part);
  const secondary = normalizeMuscles(raw.secondary_muscles).filter(
    (m) => !primary.includes(m),
  );
  const equipmentIds = mapRepdbEquipment(
    raw.equipment,
    raw.name_en,
    raw.body_part ?? '',
  );
  const difficulty = mapRepdbDifficulty(raw.difficulty);

  // Aliases from multilingual names and tags
  const aliases: string[] = [];
  if (raw.name_de && raw.name_de !== raw.name_en) aliases.push(raw.name_de);
  if (raw.name_es && raw.name_es !== raw.name_en) aliases.push(raw.name_es);
  if (raw.tags) {
    for (const tag of raw.tags) {
      const cleanTag = tag.replace(/_/g, ' ');
      if (!aliases.includes(cleanTag)) aliases.push(cleanTag);
    }
  }

  const cues = raw.tips_en ? [...raw.tips_en] : [];
  const mistakes = extractMistakesFromTips(raw.tips_en, movement);

  let substitutes: string[] = [];
  if (raw.variation_group && VARIATION_GROUPS.has(raw.variation_group)) {
    substitutes = (VARIATION_GROUPS.get(raw.variation_group) ?? [])
      .filter((id) => id !== raw.id)
      .slice(0, 4);
  }

  return {
    id: raw.id,
    name: raw.name_en,
    aliases,
    source: 'repdb',
    equipmentIds,
    movement,
    difficulty,
    primary,
    secondary,
    instructions: raw.instructions_en ?? [],
    cues,
    mistakes,
    substitutes,
  };
}

/** All 609 RepDB exercises normalized into the canonical Exercise interface. */
export const NORMALIZED_REPDB: Exercise[] = repdbExercises.map(normalizeRepdbExercise);

const curatedIdSet = new Set(CURATED_EXERCISES.map((e) => e.id));

/**
 * Fast-indexed combined catalog containing all curated Atlas exercises
 * and all 609 normalized RepDB exercises.
 */
export const CATALOG: Exercise[] = [
  ...CURATED_EXERCISES,
  ...NORMALIZED_REPDB.filter((e) => !curatedIdSet.has(e.id)),
];

// Fallback fill for any exercises without substitutes:
// Map to other exercises sharing movement and primary muscle
for (const ex of CATALOG) {
  if (ex.substitutes.length === 0) {
    ex.substitutes = CATALOG.filter(
      (c) =>
        c.id !== ex.id &&
        c.movement === ex.movement &&
        c.primary.some((p) => ex.primary.includes(p)),
    )
      .slice(0, 3)
      .map((c) => c.id);
  }
}

export const CATALOG_BY_ID: Record<string, Exercise> = Object.fromEntries(
  CATALOG.map((e) => [e.id, e]),
);

export const EXERCISE_BY_ID: Record<string, Exercise> = CATALOG_BY_ID;

export function getExercise(id: string): Exercise | undefined {
  return CATALOG_BY_ID[id];
}

/* =========================================================================
   Search & Substitutes Helpers (§8 of requirements)
   ========================================================================= */

export interface ExerciseSearchFilters {
  location?: LocationType;
  equipment?: string[];
  muscle?: MuscleId;
  movement?: Movement;
  difficulty?: number;
  favourites?: string[];
  disliked?: string[];
}

/**
 * Searches the catalog with query matching and multidimensional filtering.
 */
export function searchExercises(
  query: string,
  filters?: ExerciseSearchFilters,
): Exercise[] {
  const trimmed = query.trim().toLowerCase();

  let allowedEquipment: Set<string> | null = null;
  if (filters?.equipment) {
    allowedEquipment = new Set(filters.equipment);
  } else if (filters?.location) {
    allowedEquipment = new Set(DEFAULT_EQUIPMENT[filters.location]);
  }
  if (allowedEquipment) {
    allowedEquipment.add('bodyweight');
    if (allowedEquipment.has('adj-dumbbells')) allowedEquipment.add('dumbbells');
    if (allowedEquipment.has('bench')) allowedEquipment.add('chair');
  }

  const dislikedSet =
    filters?.disliked && filters.disliked.length > 0
      ? new Set(filters.disliked)
      : null;

  const favouritesSet =
    filters?.favourites !== undefined ? new Set(filters.favourites) : null;

  const results: Array<{ exercise: Exercise; score: number }> = [];

  for (const ex of CATALOG) {
    // Disliked filter
    if (dislikedSet && dislikedSet.has(ex.id)) {
      continue;
    }

    // Favourites filter
    if (favouritesSet && !favouritesSet.has(ex.id)) {
      continue;
    }

    // Movement filter
    if (filters?.movement && ex.movement !== filters.movement) {
      continue;
    }

    // Muscle filter
    if (filters?.muscle) {
      const hasMuscle =
        ex.primary.includes(filters.muscle) ||
        ex.secondary.includes(filters.muscle);
      if (!hasMuscle) continue;
    }

    // Difficulty filter
    if (
      filters?.difficulty !== undefined &&
      ex.difficulty !== filters.difficulty
    ) {
      continue;
    }

    // Equipment filter
    if (allowedEquipment && ex.equipmentIds.length > 0) {
      const canDo = ex.equipmentIds.every((req) => allowedEquipment.has(req));
      if (!canDo) continue;
    }

    // Query match & scoring
    let score = 0;
    if (trimmed) {
      const lowerName = ex.name.toLowerCase();
      const lowerId = ex.id.toLowerCase();
      const aliasMatch = ex.aliases.some((a) =>
        a.toLowerCase().includes(trimmed),
      );

      if (lowerName === trimmed || lowerId === trimmed) {
        score = 100;
      } else if (lowerName.startsWith(trimmed)) {
        score = 75;
      } else if (lowerName.includes(trimmed)) {
        score = 50;
      } else if (lowerId.includes(trimmed)) {
        score = 40;
      } else if (aliasMatch) {
        score = 30;
      } else {
        // Query did not match
        continue;
      }
    } else {
      score = 10;
    }

    // Prioritize curated Atlas entries slightly
    if (ex.source === 'atlas') {
      score += 5;
    }

    results.push({ exercise: ex, score });
  }

  results.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return a.exercise.name.localeCompare(b.exercise.name);
  });

  return results.map((r) => r.exercise);
}

/**
 * Finds alternative exercises matching the target exercise pattern and compatible
 * with the user's available equipment.
 */
export function findSubstitutes(
  exerciseId: string,
  availableEquipment: string[],
): Exercise[] {
  const target = CATALOG_BY_ID[exerciseId];
  if (!target) return [];

  const allowed = new Set(availableEquipment);
  allowed.add('bodyweight');
  if (allowed.has('adj-dumbbells')) allowed.add('dumbbells');
  if (allowed.has('bench')) allowed.add('chair');

  const directSubSet = new Set(target.substitutes);
  const scored: Array<{ exercise: Exercise; score: number }> = [];

  for (const ex of CATALOG) {
    if (ex.id === exerciseId) continue;

    // Check equipment compatibility
    if (ex.equipmentIds.length > 0) {
      const canDo = ex.equipmentIds.every((req) => allowed.has(req));
      if (!canDo) continue;
    }

    let score = 0;

    // Explicitly recommended substitutes get top priority
    if (directSubSet.has(ex.id)) {
      score += 1000;
    }

    // Movement pattern match
    if (ex.movement === target.movement) {
      score += 100;
    }

    // Primary muscle overlap
    for (const p of target.primary) {
      if (ex.primary.includes(p)) score += 50;
      else if (ex.secondary.includes(p)) score += 20;
    }

    // Secondary muscle overlap
    for (const s of target.secondary) {
      if (ex.primary.includes(s)) score += 20;
      else if (ex.secondary.includes(s)) score += 10;
    }

    // Difficulty proximity
    const diffDelta = Math.abs(ex.difficulty - target.difficulty);
    if (diffDelta === 0) score += 15;
    else if (diffDelta === 1) score += 5;

    // Prefer curated atlas exercises slightly
    if (ex.source === 'atlas') {
      score += 5;
    }

    if (score > 50) {
      scored.push({ exercise: ex, score });
    }
  }

  scored.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return a.exercise.name.localeCompare(b.exercise.name);
  });

  return scored.map((s) => s.exercise);
}
