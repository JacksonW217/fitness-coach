import type { Equipment, ExerciseDef, Limitation, Muscle, Pattern } from '../types';

type Def = [
  id: string,
  name: string,
  muscle: Muscle,
  secondary: Muscle[],
  pattern: Pattern,
  equipment: Equipment[],
  compound: boolean,
  increment: number,
  stresses: Limitation[],
  cues: string[],
  perHand?: boolean,
  timed?: boolean,
];

const RAW: Def[] = [
  // ── Chest
  ['bench-press', 'Barbell Bench Press', 'chest', ['triceps', 'shoulders'], 'hPush', ['barbell', 'bench'], true, 5, ['shoulder', 'wrist'], ['Shoulder blades pinched and down', 'Bar to lower chest, elbows ~45°', 'Feet planted, drive through the floor']],
  ['db-bench', 'Dumbbell Bench Press', 'chest', ['triceps', 'shoulders'], 'hPush', ['dumbbell', 'bench'], true, 5, ['shoulder'], ['Lower until a deep chest stretch', 'Press up and slightly in', 'Keep wrists stacked over elbows'], true],
  ['machine-chest-press', 'Machine Chest Press', 'chest', ['triceps', 'shoulders'], 'hPush', ['machine'], true, 5, [], ['Set handles at mid-chest', 'Control the negative', 'Don’t let shoulders roll forward']],
  ['smith-bench', 'Smith Machine Bench Press', 'chest', ['triceps', 'shoulders'], 'hPush', ['smith', 'bench'], true, 5, ['shoulder'], ['Bar path to lower chest', 'Retract shoulder blades', 'Pause lightly on the chest']],
  ['push-up', 'Push-Up', 'chest', ['triceps', 'shoulders'], 'hPush', ['bodyweight'], true, 0, ['wrist'], ['Body in one straight line', 'Chest to an inch off the floor', 'Elbows ~45° from torso']],
  ['incline-bench', 'Incline Barbell Bench Press', 'chest', ['shoulders', 'triceps'], 'inclinePush', ['barbell', 'bench'], true, 5, ['shoulder'], ['Bench at 30°', 'Bar to upper chest', 'Keep upper back tight']],
  ['incline-db-press', 'Incline Dumbbell Press', 'chest', ['shoulders', 'triceps'], 'inclinePush', ['dumbbell', 'bench'], true, 5, ['shoulder'], ['Bench at 30°', 'Deep stretch at the bottom', 'Don’t clank the bells at the top'], true],
  ['incline-machine-press', 'Incline Machine Press', 'chest', ['shoulders', 'triceps'], 'inclinePush', ['machine'], true, 5, [], ['Seat so handles align with upper chest', 'Smooth tempo', 'Full range']],
  ['cable-fly', 'Cable Fly', 'chest', [], 'fly', ['cable'], false, 5, ['shoulder'], ['Soft bend in elbows', 'Hug a barrel', 'Squeeze for a beat at the middle']],
  ['pec-deck', 'Pec Deck', 'chest', [], 'fly', ['machine'], false, 5, [], ['Elbows slightly below shoulders', 'Control the stretch', 'Squeeze hands together']],
  ['db-fly', 'Dumbbell Fly', 'chest', [], 'fly', ['dumbbell', 'bench'], false, 5, ['shoulder'], ['Slight elbow bend, fixed', 'Lower to a comfortable stretch', 'Lead with the elbows'], true],
  ['dip', 'Dip', 'chest', ['triceps', 'shoulders'], 'hPush', ['dipStation'], true, 0, ['shoulder', 'elbow'], ['Lean slightly forward for chest', 'Lower until upper arm is parallel', 'Don’t shrug up']],
  // ── Back
  ['pull-up', 'Pull-Up', 'back', ['biceps'], 'vPull', ['pullupBar'], true, 0, ['shoulder', 'elbow'], ['Start from a dead hang', 'Drive elbows to your ribs', 'Chin over the bar']],
  ['chin-up', 'Chin-Up', 'back', ['biceps'], 'vPull', ['pullupBar'], true, 0, ['elbow'], ['Palms facing you', 'Full hang to chin over bar', 'Avoid kipping']],
  ['lat-pulldown', 'Lat Pulldown', 'back', ['biceps'], 'vPull', ['cable'], true, 5, [], ['Slight lean back', 'Pull bar to upper chest', 'Control the bar up to a full stretch']],
  ['close-grip-pulldown', 'Close-Grip Pulldown', 'back', ['biceps'], 'vPull', ['cable'], true, 5, [], ['Neutral grip handle', 'Elbows down and back', 'Full stretch at the top']],
  ['band-pulldown', 'Band Lat Pulldown', 'back', ['biceps'], 'vPull', ['band'], false, 0, [], ['Anchor band high', 'Pull elbows to ribs', 'Slow return']],
  ['barbell-row', 'Barbell Row', 'back', ['biceps', 'hamstrings'], 'hPull', ['barbell'], true, 5, ['lowBack'], ['Hinge to ~45°, flat back', 'Row to lower ribs', 'No jerking the torso']],
  ['db-row', 'One-Arm Dumbbell Row', 'back', ['biceps'], 'hPull', ['dumbbell', 'bench'], true, 5, [], ['Hand and knee on bench', 'Pull elbow toward hip', 'Let the shoulder blade stretch forward'], true],
  ['cable-row', 'Seated Cable Row', 'back', ['biceps'], 'hPull', ['cable'], true, 5, [], ['Tall chest', 'Pull to belly button', 'Reach forward for the stretch without rounding']],
  ['chest-supported-row', 'Chest-Supported Row', 'back', ['biceps'], 'hPull', ['dumbbell', 'bench'], true, 5, [], ['Chest on incline bench', 'Pull elbows back', 'Pause at the top'], true],
  ['machine-row', 'Machine Row', 'back', ['biceps'], 'hPull', ['machine'], true, 5, [], ['Chest against pad', 'Drive elbows back', 'Full stretch forward']],
  ['inverted-row', 'Inverted Row', 'back', ['biceps'], 'hPull', ['rack'], true, 0, [], ['Body in a straight line', 'Pull chest to bar', 'Squeeze shoulder blades']],
  // ── Shoulders
  ['ohp', 'Overhead Press', 'shoulders', ['triceps'], 'vPush', ['barbell', 'rack'], true, 5, ['shoulder', 'lowBack'], ['Squeeze glutes, ribs down', 'Press bar in a straight line', 'Head through at the top']],
  ['db-shoulder-press', 'Seated Dumbbell Shoulder Press', 'shoulders', ['triceps'], 'vPush', ['dumbbell', 'bench'], true, 5, ['shoulder'], ['Back against the pad', 'Lower to ear level', 'Press without flaring ribs'], true],
  ['machine-shoulder-press', 'Machine Shoulder Press', 'shoulders', ['triceps'], 'vPush', ['machine'], true, 5, [], ['Handles at shoulder height', 'Smooth press', 'Don’t lock out hard']],
  ['pike-push-up', 'Pike Push-Up', 'shoulders', ['triceps'], 'vPush', ['bodyweight'], true, 0, ['shoulder', 'wrist'], ['Hips high', 'Head toward floor between hands', 'Press back up']],
  ['lateral-raise', 'Dumbbell Lateral Raise', 'shoulders', [], 'lateral', ['dumbbell'], false, 5, [], ['Slight forward lean', 'Lead with elbows', 'Stop at shoulder height'], true],
  ['cable-lateral-raise', 'Cable Lateral Raise', 'shoulders', [], 'lateral', ['cable'], false, 5, [], ['Cable behind the body', 'Raise out to the side', 'Slow lowering']],
  ['band-lateral-raise', 'Band Lateral Raise', 'shoulders', [], 'lateral', ['band'], false, 0, [], ['Stand on band', 'Raise to shoulder height', 'Control down']],
  ['rear-delt-fly', 'Rear Delt Dumbbell Fly', 'shoulders', ['back'], 'rearDelt', ['dumbbell'], false, 5, [], ['Hinge forward, flat back', 'Raise out wide', 'Pinky slightly up'], true],
  ['face-pull', 'Cable Face Pull', 'shoulders', ['back'], 'rearDelt', ['cable'], false, 5, [], ['Rope at face height', 'Pull to the eyes, elbows high', 'Rotate hands back at the end']],
  ['reverse-pec-deck', 'Reverse Pec Deck', 'shoulders', ['back'], 'rearDelt', ['machine'], false, 5, [], ['Arms parallel to floor', 'Sweep back wide', 'Don’t shrug']],
  ['band-pull-apart', 'Band Pull-Apart', 'shoulders', ['back'], 'rearDelt', ['band'], false, 0, [], ['Arms straight', 'Pull band to chest', 'Squeeze shoulder blades']],
  // ── Arms
  ['barbell-curl', 'Barbell Curl', 'biceps', [], 'biceps', ['barbell'], false, 5, ['wrist', 'elbow'], ['Elbows pinned at sides', 'No swinging', 'Lower under control']],
  ['db-curl', 'Dumbbell Curl', 'biceps', [], 'biceps', ['dumbbell'], false, 5, [], ['Supinate as you curl', 'Full extension at the bottom', 'Elbows still'], true],
  ['incline-db-curl', 'Incline Dumbbell Curl', 'biceps', [], 'biceps', ['dumbbell', 'bench'], false, 5, ['shoulder'], ['Bench at 45–60°', 'Arms hang behind body', 'Slow eccentric'], true],
  ['hammer-curl', 'Hammer Curl', 'biceps', [], 'biceps', ['dumbbell'], false, 5, [], ['Neutral grip', 'Curl across or straight up', 'No body english'], true],
  ['cable-curl', 'Cable Curl', 'biceps', [], 'biceps', ['cable'], false, 5, [], ['Constant tension', 'Elbows at sides', 'Squeeze at top']],
  ['band-curl', 'Band Curl', 'biceps', [], 'biceps', ['band'], false, 0, [], ['Stand on band', 'Curl to shoulders', 'Slow down']],
  ['triceps-pushdown', 'Cable Triceps Pushdown', 'triceps', [], 'triceps', ['cable'], false, 5, [], ['Elbows tucked', 'Full lockout', 'Control the return']],
  ['overhead-triceps-ext', 'Overhead Cable Triceps Extension', 'triceps', [], 'triceps', ['cable'], false, 5, ['elbow', 'shoulder'], ['Face away from the stack', 'Deep stretch behind the head', 'Extend fully']],
  ['db-overhead-ext', 'Dumbbell Overhead Triceps Extension', 'triceps', [], 'triceps', ['dumbbell'], false, 5, ['elbow', 'shoulder'], ['Both hands on one dumbbell', 'Elbows point up', 'Lower behind head']],
  ['skull-crusher', 'EZ-Bar Skull Crusher', 'triceps', [], 'triceps', ['barbell', 'bench'], false, 5, ['elbow'], ['Lower to forehead or just behind', 'Upper arms still', 'Smooth lockout']],
  ['close-grip-bench', 'Close-Grip Bench Press', 'triceps', ['chest'], 'hPush', ['barbell', 'bench'], true, 5, ['wrist', 'elbow'], ['Hands shoulder-width', 'Elbows tucked', 'Touch lower chest']],
  ['diamond-push-up', 'Diamond Push-Up', 'triceps', ['chest'], 'triceps', ['bodyweight'], false, 0, ['wrist', 'elbow'], ['Hands together under chest', 'Elbows back', 'Full range']],
  ['band-pushdown', 'Band Triceps Pushdown', 'triceps', [], 'triceps', ['band'], false, 0, [], ['Anchor band high', 'Elbows pinned', 'Lock out']],
  // ── Legs
  ['back-squat', 'Barbell Back Squat', 'quads', ['glutes', 'hamstrings'], 'squat', ['barbell', 'rack'], true, 10, ['knee', 'lowBack', 'hip'], ['Brace before every rep', 'Knees track over toes', 'Hit depth with a neutral spine'],],
  ['front-squat', 'Front Squat', 'quads', ['glutes'], 'squat', ['barbell', 'rack'], true, 5, ['knee', 'wrist'], ['Elbows high', 'Upright torso', 'Sit straight down']],
  ['hack-squat', 'Hack Squat', 'quads', ['glutes'], 'squat', ['machine'], true, 10, ['knee'], ['Feet mid-platform', 'Deep, controlled descent', 'Don’t lock knees hard']],
  ['leg-press', 'Leg Press', 'quads', ['glutes'], 'squat', ['machine'], true, 10, ['knee'], ['Lower back stays on the pad', 'Go as deep as you can without rounding', 'Push through the whole foot']],
  ['smith-squat', 'Smith Machine Squat', 'quads', ['glutes'], 'squat', ['smith'], true, 10, ['knee'], ['Feet slightly forward', 'Controlled depth', 'Brace hard']],
  ['goblet-squat', 'Goblet Squat', 'quads', ['glutes'], 'squat', ['dumbbell'], true, 5, ['knee'], ['Hold bell at chest', 'Elbows inside knees', 'Sit down between your heels']],
  ['bw-squat', 'Bodyweight Squat', 'quads', ['glutes'], 'squat', ['bodyweight'], true, 0, ['knee'], ['Full depth', 'Heels down', 'Controlled tempo']],
  ['bulgarian-split-squat', 'Bulgarian Split Squat', 'quads', ['glutes'], 'lunge', ['dumbbell', 'bench'], true, 5, ['knee', 'hip'], ['Rear foot on bench', 'Front knee forward over toes', 'Drop straight down'], true],
  ['walking-lunge', 'Walking Lunge', 'quads', ['glutes'], 'lunge', ['dumbbell'], true, 5, ['knee'], ['Long stride', 'Back knee to just above floor', 'Stay tall'], true],
  ['reverse-lunge', 'Reverse Lunge', 'quads', ['glutes'], 'lunge', ['bodyweight'], true, 0, ['knee'], ['Step back', 'Front shin vertical-ish', 'Drive through the front heel']],
  ['leg-extension', 'Leg Extension', 'quads', [], 'kneeExt', ['machine'], false, 5, ['knee'], ['Pad above ankles', 'Pause at the top', 'Slow lowering']],
  ['romanian-deadlift', 'Romanian Deadlift', 'hamstrings', ['glutes', 'back'], 'hinge', ['barbell'], true, 10, ['lowBack'], ['Push hips back, soft knees', 'Bar slides down the thighs', 'Stop when hamstrings are stretched, back flat']],
  ['db-rdl', 'Dumbbell Romanian Deadlift', 'hamstrings', ['glutes'], 'hinge', ['dumbbell'], true, 5, ['lowBack'], ['Hips back', 'Dumbbells close to legs', 'Flat back throughout'], true],
  ['deadlift', 'Deadlift', 'hamstrings', ['glutes', 'back', 'quads'], 'hinge', ['barbell'], true, 10, ['lowBack', 'hip'], ['Bar over mid-foot', 'Brace, pull the slack out', 'Push the floor away, lock out with glutes']],
  ['kb-swing', 'Kettlebell Swing', 'glutes', ['hamstrings'], 'hinge', ['kettlebell'], true, 5, ['lowBack'], ['Hike the bell back', 'Snap hips forward', 'Arms are just ropes']],
  ['lying-leg-curl', 'Lying Leg Curl', 'hamstrings', [], 'kneeFlex', ['machine'], false, 5, [], ['Hips pressed into pad', 'Curl fully', 'Slow eccentric']],
  ['seated-leg-curl', 'Seated Leg Curl', 'hamstrings', [], 'kneeFlex', ['machine'], false, 5, [], ['Thigh pad snug', 'Lean slightly forward', 'Full range']],
  ['nordic-curl', 'Nordic Ham Curl (assisted)', 'hamstrings', [], 'kneeFlex', ['bodyweight'], false, 0, ['knee'], ['Anchor heels', 'Lower as slowly as possible', 'Push off the floor to return']],
  ['hip-thrust', 'Barbell Hip Thrust', 'glutes', ['hamstrings'], 'glute', ['barbell', 'bench'], true, 10, [], ['Upper back on bench', 'Chin tucked, ribs down', 'Full lockout with glutes']],
  ['glute-bridge', 'Glute Bridge', 'glutes', ['hamstrings'], 'glute', ['bodyweight'], false, 0, [], ['Feet close to hips', 'Drive through heels', 'Squeeze at top']],
  ['cable-kickback', 'Cable Glute Kickback', 'glutes', [], 'glute', ['cable'], false, 5, [], ['Slight forward lean', 'Kick back and up', 'Don’t arch the low back']],
  ['standing-calf-raise', 'Standing Calf Raise', 'calves', [], 'calf', ['machine'], false, 10, [], ['Full stretch at bottom', 'Pause at top', 'No bouncing']],
  ['seated-calf-raise', 'Seated Calf Raise', 'calves', [], 'calf', ['machine'], false, 10, [], ['Pause in the stretch', 'Drive up onto big toe', 'Slow tempo']],
  ['db-calf-raise', 'Single-Leg Dumbbell Calf Raise', 'calves', [], 'calf', ['dumbbell'], false, 5, [], ['Stand on a step', 'Full range', 'Hold a support'], true],
  ['bw-calf-raise', 'Bodyweight Calf Raise', 'calves', [], 'calf', ['bodyweight'], false, 0, [], ['On a step edge', 'Full stretch and squeeze', 'Slow']],
  // ── Core
  ['cable-crunch', 'Cable Crunch', 'abs', [], 'core', ['cable'], false, 5, ['lowBack'], ['Kneel, rope by head', 'Curl ribs to hips', 'Hips stay still']],
  ['hanging-leg-raise', 'Hanging Leg Raise', 'abs', [], 'core', ['pullupBar'], false, 0, ['shoulder'], ['Posteriorly tilt pelvis', 'Raise with control', 'No swinging']],
  ['plank', 'Plank (seconds)', 'abs', [], 'core', ['bodyweight'], false, 0, [], ['Squeeze glutes', 'Ribs down', 'Breathe behind the brace']],
  ['ab-wheel', 'Ab Wheel Rollout', 'abs', [], 'core', ['bodyweight'], false, 0, ['lowBack', 'shoulder'], ['Hollow body', 'Roll only as far as you can hold position', 'Pull back with abs']],
  ['dead-bug', 'Dead Bug', 'abs', [], 'core', ['bodyweight'], false, 0, [], ['Low back pressed down', 'Opposite arm and leg', 'Slow exhale']],
  // ── More chest
  ['decline-bench', 'Decline Barbell Bench Press', 'chest', ['triceps'], 'hPush', ['barbell', 'bench'], true, 5, ['shoulder'], ['Hook feet securely', 'Bar to lower chest', 'Control the descent']],
  ['decline-db-press', 'Decline Dumbbell Press', 'chest', ['triceps'], 'hPush', ['dumbbell', 'bench'], true, 5, ['shoulder'], ['Slight decline', 'Deep stretch', 'Press up and in'], true],
  ['low-high-cable-fly', 'Low-to-High Cable Fly', 'chest', ['shoulders'], 'fly', ['cable'], false, 5, [], ['Handles start low by your hips', 'Sweep up to chin height', 'Targets the upper chest']],
  ['high-low-cable-fly', 'High-to-Low Cable Fly', 'chest', [], 'fly', ['cable'], false, 5, [], ['Handles start above shoulders', 'Sweep down toward your hips', 'Squeeze at the bottom']],
  ['machine-fly', 'Machine Fly', 'chest', [], 'fly', ['machine'], false, 5, [], ['Handles at chest height', 'Full stretch', 'Squeeze together']],
  ['db-pullover', 'Dumbbell Pullover', 'back', ['chest'], 'vPull', ['dumbbell', 'bench'], false, 5, ['shoulder'], ['Hips low, arms slightly bent', 'Lower behind your head to a stretch', 'Pull back over your chest with the lats']],
  // ── More back
  ['tbar-row', 'T-Bar Row', 'back', ['biceps', 'traps'], 'hPull', ['barbell'], true, 5, ['lowBack'], ['Chest up, flat back', 'Row to your stomach', 'No heaving']],
  ['machine-tbar-row', 'Chest-Supported T-Bar Row', 'back', ['biceps', 'traps'], 'hPull', ['machine'], true, 5, [], ['Chest on the pad', 'Drive elbows back', 'Full stretch each rep']],
  ['pendlay-row', 'Pendlay Row', 'back', ['biceps', 'hamstrings'], 'hPull', ['barbell'], true, 5, ['lowBack'], ['Torso near parallel', 'Each rep starts from the floor', 'Explode up, control down']],
  ['straight-arm-pulldown', 'Straight-Arm Pulldown', 'back', [], 'vPull', ['cable'], false, 5, [], ['Arms nearly straight', 'Sweep the bar to your thighs', 'Feel the lats, not the triceps']],
  ['wide-grip-pulldown', 'Wide-Grip Lat Pulldown', 'back', ['biceps'], 'vPull', ['cable'], true, 5, [], ['Hands outside shoulders', 'Pull to upper chest', 'Builds back width']],
  ['single-arm-pulldown', 'Single-Arm Cable Pulldown', 'back', ['biceps'], 'vPull', ['cable'], false, 5, [], ['Pull elbow down to your side', 'Big stretch at the top', 'Slight lean toward the working side'], true],
  ['assisted-pull-up', 'Assisted Pull-Up Machine', 'back', ['biceps'], 'vPull', ['machine'], true, 5, [], ['Log the assistance weight', 'Full hang to chin over bar', 'Less assistance = progress']],
  // ── Traps
  ['bb-shrug', 'Barbell Shrug', 'traps', [], 'shrug', ['barbell'], false, 10, ['neck'], ['Shrug straight up, not rolled', 'Pause at the top', 'Arms stay straight']],
  ['db-shrug', 'Dumbbell Shrug', 'traps', [], 'shrug', ['dumbbell'], false, 5, ['neck'], ['Shoulders to ears', 'Hold for a beat', 'Slow lower'], true],
  ['upright-row', 'Cable Upright Row', 'shoulders', ['traps'], 'lateral', ['cable'], false, 5, ['shoulder'], ['Wide grip', 'Lead with the elbows', 'Stop at chest height']],
  // ── More shoulders
  ['arnold-press', 'Arnold Press', 'shoulders', ['triceps'], 'vPush', ['dumbbell', 'bench'], true, 5, ['shoulder'], ['Start palms facing you', 'Rotate as you press', 'Full lockout'], true],
  ['standing-db-press', 'Standing Dumbbell Shoulder Press', 'shoulders', ['triceps'], 'vPush', ['dumbbell'], true, 5, ['shoulder', 'lowBack'], ['Brace your core', 'Press straight up', 'Don’t lean back'], true],
  ['machine-lateral', 'Machine Lateral Raise', 'shoulders', [], 'lateral', ['machine'], false, 5, [], ['Pads on the outer arm', 'Raise to shoulder height', 'Slow lower']],
  ['lean-away-lateral', 'Lean-Away Cable Lateral Raise', 'shoulders', [], 'lateral', ['cable'], false, 5, [], ['Hold the post and lean away', 'Raise out to the side', 'Big stretch at the bottom'], true],
  ['db-front-raise', 'Dumbbell Front Raise', 'shoulders', [], 'other', ['dumbbell'], false, 5, ['shoulder'], ['Raise to eye level', 'No swinging', 'Front delts are usually trained by pressing'], true],
  ['rear-delt-cable-fly', 'Rear Delt Cable Fly', 'shoulders', ['back'], 'rearDelt', ['cable'], false, 5, [], ['Cross the cables', 'Pull out and back', 'Lead with the elbows']],
  // ── More arms
  ['ez-curl', 'EZ-Bar Curl', 'biceps', ['forearms'], 'biceps', ['barbell'], false, 5, ['elbow'], ['Elbows pinned', 'Squeeze at the top', 'Slow lower']],
  ['preacher-curl', 'EZ-Bar Preacher Curl', 'biceps', [], 'biceps', ['barbell', 'bench'], false, 5, ['elbow'], ['Armpits on the pad', 'Lower to almost straight', 'No bouncing']],
  ['machine-preacher', 'Machine Preacher Curl', 'biceps', [], 'biceps', ['machine'], false, 5, [], ['Elbows aligned with the pivot', 'Full range', 'Squeeze at the top']],
  ['concentration-curl', 'Concentration Curl', 'biceps', [], 'biceps', ['dumbbell', 'bench'], false, 5, [], ['Elbow on inner thigh', 'Curl to your shoulder', 'Slow negative'], true],
  ['bayesian-curl', 'Bayesian Cable Curl', 'biceps', [], 'biceps', ['cable'], false, 5, [], ['Face away from the cable', 'Arm behind your body for a stretch', 'Curl without moving the elbow'], true],
  ['rope-hammer-curl', 'Rope Hammer Curl', 'biceps', ['forearms'], 'biceps', ['cable'], false, 5, [], ['Thumbs up', 'Pull the rope apart at the top', 'Elbows still']],
  ['rope-pushdown', 'Rope Triceps Pushdown', 'triceps', [], 'triceps', ['cable'], false, 5, [], ['Elbows pinned', 'Spread the rope at the bottom', 'Control up']],
  ['db-kickback', 'Dumbbell Triceps Kickback', 'triceps', [], 'triceps', ['dumbbell', 'bench'], false, 5, [], ['Upper arm parallel to the floor', 'Straighten fully', 'Squeeze'], true],
  ['machine-tricep-ext', 'Machine Triceps Extension', 'triceps', [], 'triceps', ['machine'], false, 5, [], ['Elbows on the pad', 'Full lockout', 'Slow return']],
  ['machine-dip', 'Seated Dip Machine', 'triceps', ['chest'], 'triceps', ['machine'], true, 5, ['shoulder'], ['Stay upright', 'Press to lockout', 'Control the stretch']],
  // ── Forearms & grip
  ['wrist-curl', 'Dumbbell Wrist Curl', 'forearms', [], 'forearm', ['dumbbell', 'bench'], false, 5, ['wrist'], ['Forearms on your thighs or bench', 'Curl the wrist up', 'Full range'], true],
  ['reverse-curl', 'Reverse-Grip EZ Curl', 'forearms', ['biceps'], 'forearm', ['barbell'], false, 5, ['elbow', 'wrist'], ['Palms down', 'Elbows pinned', 'Slow lower']],
  ['farmers-carry', 'Farmer’s Carry (seconds)', 'forearms', ['traps', 'abs'], 'carry', ['dumbbell'], true, 5, ['lowBack'], ['Heavy bells, tall posture', 'Short, quick steps', 'Log seconds walked'], true, true],
  ['dead-hang', 'Dead Hang (seconds)', 'forearms', ['back'], 'forearm', ['pullupBar'], false, 0, ['shoulder'], ['Full grip, shoulders engaged', 'Breathe', 'Log seconds held'], false, true],
  // ── More legs
  ['trap-bar-deadlift', 'Trap Bar Deadlift', 'quads', ['glutes', 'hamstrings', 'back'], 'hinge', ['trapBar'], true, 10, ['lowBack'], ['Stand in the center', 'Push the floor away', 'Lock out with the glutes']],
  ['sumo-deadlift', 'Sumo Deadlift', 'glutes', ['hamstrings', 'quads', 'back'], 'hinge', ['barbell'], true, 10, ['lowBack', 'hip'], ['Wide stance, toes out', 'Knees track over toes', 'Chest up, push the floor apart']],
  ['good-morning', 'Good Morning', 'hamstrings', ['glutes', 'back'], 'hinge', ['barbell', 'rack'], true, 5, ['lowBack'], ['Bar on upper back', 'Push hips back with soft knees', 'Stop at a hamstring stretch']],
  ['back-extension', 'Back Extension (45°)', 'glutes', ['hamstrings', 'back'], 'glute', ['machine'], false, 5, ['lowBack'], ['Pad below your hips', 'Round slightly to target glutes', 'Hold a plate to add load']],
  ['db-step-up', 'Dumbbell Step-Up', 'quads', ['glutes'], 'lunge', ['dumbbell', 'bench'], true, 5, ['knee'], ['Whole foot on the box', 'Drive through the front heel', 'Don’t push off the back leg'], true],
  ['smith-split-squat', 'Smith Machine Split Squat', 'quads', ['glutes'], 'lunge', ['smith'], true, 5, ['knee'], ['Long stance', 'Back knee toward the floor', 'Stay upright']],
  ['belt-squat', 'Belt Squat', 'quads', ['glutes'], 'squat', ['machine'], true, 10, ['knee'], ['Upright torso', 'Sit straight down', 'Spine-friendly squat']],
  ['pendulum-squat', 'Pendulum Squat', 'quads', ['glutes'], 'squat', ['machine'], true, 10, ['knee'], ['Feet mid-platform', 'Deep knee bend', 'Control the bottom']],
  ['machine-hip-thrust', 'Machine Hip Thrust', 'glutes', ['hamstrings'], 'glute', ['machine'], false, 10, [], ['Chin tucked', 'Drive through the heels', 'Squeeze hard at the top']],
  ['hip-abduction', 'Hip Abduction Machine', 'glutes', [], 'glute', ['machine'], false, 5, [], ['Lean slightly forward for more glute', 'Push knees out', 'Slow return']],
  ['hip-adduction', 'Hip Adduction Machine', 'quads', [], 'other', ['machine'], false, 5, ['hip'], ['Inner thighs', 'Squeeze legs together', 'Control the stretch']],
  ['leg-press-calf', 'Leg Press Calf Raise', 'calves', [], 'calf', ['machine'], false, 10, [], ['Balls of feet on the edge', 'Deep stretch', 'Pause at the top']],
  // ── More core
  ['captains-chair', 'Captain’s Chair Knee Raise', 'abs', [], 'core', ['dipStation'], false, 0, [], ['Back against the pad', 'Curl knees to chest', 'No swinging']],
  ['decline-situp', 'Decline Sit-Up', 'abs', [], 'core', ['bench'], false, 0, [], ['Hook your feet', 'Curl up, don’t yank the neck', 'Hold a plate to progress']],
  ['ab-machine', 'Ab Crunch Machine', 'abs', [], 'core', ['machine'], false, 5, [], ['Crunch the ribs toward the hips', 'Don’t pull with the arms', 'Slow return']],
  ['pallof-press', 'Pallof Press', 'abs', [], 'core', ['cable'], false, 5, [], ['Stand side-on to the cable', 'Press straight out and resist rotation', 'Brace hard'], true],
  ['russian-twist', 'Russian Twist', 'abs', [], 'core', ['bodyweight'], false, 0, [], ['Lean back, chest up', 'Rotate shoulders, not just arms', 'Count each side']],
  ['side-plank', 'Side Plank (seconds)', 'abs', [], 'core', ['bodyweight'], false, 0, [], ['Hips high', 'Straight line head to heels', 'Log seconds per side'], false, true],
];

export const EXERCISES: ExerciseDef[] = RAW.map(
  ([id, name, muscle, secondary, pattern, equipment, compound, increment, stresses, cues, perHand, timed]) => ({
    id,
    name,
    muscle,
    secondary,
    pattern,
    equipment,
    compound,
    increment,
    stresses,
    cues,
    perHand,
    timed: timed || id === 'plank' || undefined,
    setSeconds: compound ? 45 : 35,
  }),
);

export const EXERCISE_MAP: Record<string, ExerciseDef> = Object.fromEntries(EXERCISES.map((e) => [e.id, e]));

export function getExercise(id: string): ExerciseDef {
  return (
    EXERCISE_MAP[id] ?? {
      id,
      name: id,
      muscle: 'abs',
      secondary: [],
      pattern: 'core',
      equipment: [],
      compound: false,
      increment: 5,
      stresses: [],
      cues: [],
    }
  );
}

export const MUSCLE_LABEL: Record<Muscle, string> = {
  chest: 'Chest',
  back: 'Back',
  shoulders: 'Shoulders',
  biceps: 'Biceps',
  triceps: 'Triceps',
  quads: 'Quads',
  hamstrings: 'Hamstrings',
  glutes: 'Glutes',
  calves: 'Calves',
  abs: 'Core',
  traps: 'Traps',
  forearms: 'Forearms',
};

export const EQUIPMENT_LABEL: Record<Equipment, string> = {
  barbell: 'Barbell & plates',
  rack: 'Squat rack',
  bench: 'Adjustable bench',
  dumbbell: 'Dumbbells',
  cable: 'Cable station',
  machine: 'Selectorized machines',
  smith: 'Smith machine',
  pullupBar: 'Pull-up bar',
  dipStation: 'Dip station',
  kettlebell: 'Kettlebells',
  band: 'Resistance bands',
  trapBar: 'Trap / hex bar',
  bodyweight: 'Bodyweight',
};

export const ALL_EQUIPMENT = Object.keys(EQUIPMENT_LABEL) as Equipment[];

export const LOCATION_PRESETS: Record<string, Equipment[]> = {
  commercial: ALL_EQUIPMENT,
  home: ['barbell', 'rack', 'bench', 'dumbbell', 'pullupBar', 'band', 'bodyweight'],
  limited: ['dumbbell', 'bench', 'cable', 'machine', 'pullupBar', 'bodyweight'],
  multiple: ALL_EQUIPMENT,
};

/** Bodyweight is always available. */
export function hasEquipment(ex: ExerciseDef, available: Equipment[]): boolean {
  return ex.equipment.every((e) => e === 'bodyweight' || available.includes(e));
}

/**
 * User-created exercises live in IndexedDB; they're merged into EXERCISES and
 * EXERCISE_MAP at startup (and after each change) so every engine, picker and
 * the coach prompt treat them exactly like built-in exercises.
 */
export function registerCustomExercises(list: ExerciseDef[]) {
  for (let i = EXERCISES.length - 1; i >= 0; i--) {
    if (EXERCISES[i].custom) {
      delete EXERCISE_MAP[EXERCISES[i].id];
      EXERCISES.splice(i, 1);
    }
  }
  for (const ex of list) {
    const def: ExerciseDef = { ...ex, custom: true, setSeconds: ex.setSeconds ?? (ex.compound ? 45 : 35) };
    EXERCISES.push(def);
    EXERCISE_MAP[def.id] = def;
  }
}

export const PATTERN_LABEL: Record<Pattern, string> = {
  squat: 'Squat (knee-dominant, both legs)',
  hinge: 'Hinge (deadlift / RDL style)',
  lunge: 'Lunge / single-leg',
  kneeExt: 'Leg extension',
  kneeFlex: 'Leg curl',
  calf: 'Calf raise',
  hPush: 'Flat press (chest)',
  inclinePush: 'Incline press',
  vPush: 'Overhead press',
  hPull: 'Row',
  vPull: 'Pull-down / pull-up',
  fly: 'Chest fly',
  lateral: 'Lateral raise',
  rearDelt: 'Rear-delt raise / face pull',
  biceps: 'Biceps curl',
  triceps: 'Triceps extension / pushdown',
  core: 'Core / abs',
  glute: 'Glute isolation (thrust, kickback)',
  shrug: 'Shrug',
  forearm: 'Forearm / grip',
  carry: 'Carry',
  other: 'Other',
};
