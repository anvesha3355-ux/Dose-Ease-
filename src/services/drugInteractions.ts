import { Medication, DrugInteractionAlert } from '../types';

interface DrugClassDef {
  category: string;
  names: string[];
}

const DRUG_CLASSES: Record<string, DrugClassDef> = {
  blood_thinner: {
    category: 'Anticoagulant / Antiplatelet',
    names: [
      'warfarin', 'coumadin', 'jantoven',
      'apixaban', 'eliquis',
      'rivaroxaban', 'xarelto',
      'dabigatran', 'pradaxa',
      'aspirin', 'bayer', 'ecotrin', 'acetylsalicylic acid',
      'clopidogrel', 'plavix',
      'ticagrelor', 'brilinta',
      'prasugrel', 'effient',
      'heparin', 'enoxaparin', 'lovenox',
    ],
  },
  nsaid: {
    category: 'NSAID (Anti-inflammatory)',
    names: [
      'ibuprofen', 'advil', 'motrin',
      'naproxen', 'aleve', 'anaprox', 'naprosyn',
      'meloxicam', 'mobic',
      'celecoxib', 'celebrex',
      'diclofenac', 'voltaren',
      'ketorolac', 'toradol',
      'indomethacin', 'indocin',
      'nabumetone', 'piroxicam',
    ],
  },
  ace_inhibitor: {
    category: 'ACE Inhibitor (Blood Pressure)',
    names: [
      'lisinopril', 'zestril', 'prinivil',
      'enalapril', 'vasotec',
      'ramipril', 'altace',
      'benazepril', 'lotensin',
      'captopril', 'fosinopril', 'quinapril', 'accupril',
    ],
  },
  arb: {
    category: 'ARB (Angiotensin Receptor Blocker)',
    names: [
      'losartan', 'cozaar',
      'valsartan', 'diovan',
      'olmesartan', 'benicar',
      'irbesartan', 'avapro',
      'telmisartan', 'micardis',
      'candesartan', 'atacand',
    ],
  },
  diuretic: {
    category: 'Diuretic (Water Pill)',
    names: [
      'furosemide', 'lasix',
      'hydrochlorothiazide', 'hctz', 'microzide',
      'chlorthalidone',
      'bumetanide', 'bumex',
      'torsemide', 'demadex',
      'spironolactone', 'aldactone',
      'triamterene', 'dyrenium',
    ],
  },
  potassium_sparing: {
    category: 'Potassium-Sparing / Supplement',
    names: [
      'spironolactone', 'aldactone',
      'triamterene', 'dyrenium',
      'eplerenone', 'inspra',
      'potassium chloride', 'k-dur', 'klor-con', 'micro-k', 'k-tab',
    ],
  },
  beta_blocker: {
    category: 'Beta Blocker (Heart Rate & BP)',
    names: [
      'metoprolol', 'lopressor', 'toprol',
      'atenolol', 'tenormin',
      'carvedilol', 'coreg',
      'propranolol', 'inderal',
      'bisoprolol', 'zebeta',
      'nebivolol', 'bystolic',
      'labetalol',
    ],
  },
  ccb_non_dhp: {
    category: 'Calcium Channel Blocker (Rate-Limiting)',
    names: [
      'diltiazem', 'cardizem', 'cartia', 'tiazac',
      'verapamil', 'calan', 'verelan', 'isoptin',
    ],
  },
  diabetes_sulfonylurea: {
    category: 'Sulfonylurea (Diabetes)',
    names: [
      'glipizide', 'glucotrol',
      'glyburide', 'diabeta', 'micronase',
      'glimepiride', 'amaryl',
    ],
  },
  insulin: {
    category: 'Insulin (Diabetes)',
    names: [
      'insulin', 'humalog', 'novolog', 'lantus', 'basaglar', 'levemir',
      'tresiba', 'toujeo', 'humulin', 'novolin',
    ],
  },
  sedative_benzo_z: {
    category: 'Benzodiazepine / Sedative Sleep Aid',
    names: [
      'alprazolam', 'xanax',
      'diazepam', 'valium',
      'lorazepam', 'ativan',
      'clonazepam', 'klonopin',
      'temazepam', 'restoril',
      'zolpidem', 'ambien',
      'eszopiclone', 'lunesta',
      'zaleplon', 'sonata',
    ],
  },
  opioid: {
    category: 'Opioid Pain Medication',
    names: [
      'oxycodone', 'percocet', 'oxycontin',
      'hydrocodone', 'vicodin', 'norco', 'lortab',
      'tramadol', 'ultram',
      'morphine', 'ms contin',
      'fentanyl', 'duragesic',
      'codeine', 'tylenol with codeine',
      'hydromorphone', 'dilaudid',
    ],
  },
  statin: {
    category: 'Statin (Cholesterol)',
    names: [
      'atorvastatin', 'lipitor',
      'simvastatin', 'zocor',
      'rosuvastatin', 'crestor',
      'pravastatin', 'pravachol',
      'lovastatin', 'mevacor',
    ],
  },
};

/**
 * Checks whether a medication name matches a given drug class.
 */
function matchesClass(medName: string, drugClassKey: string): boolean {
  const norm = medName.toLowerCase().trim();
  const def = DRUG_CLASSES[drugClassKey];
  if (!def) return false;
  return def.names.some((n) => norm.includes(n));
}

/**
 * Evaluates active medications for known drug interactions, duplications,
 * and high-risk geriatric combinations.
 */
export function evaluateDrugInteractions(medications: Medication[]): DrugInteractionAlert[] {
  const activeMeds = medications.filter((m) => m.isActive !== false);
  if (activeMeds.length < 2) return [];

  const alerts: DrugInteractionAlert[] = [];
  const addedKeys = new Set<string>();

  const addAlert = (alert: Omit<DrugInteractionAlert, 'id'>) => {
    const key = `${alert.category}_${[...alert.drugsInvolved].sort().join('_')}`;
    if (!addedKeys.has(key)) {
      addedKeys.add(key);
      alerts.push({
        ...alert,
        id: `interaction_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      });
    }
  };

  // 1. Duplicate Therapy Check
  for (let i = 0; i < activeMeds.length; i++) {
    for (let j = i + 1; j < activeMeds.length; j++) {
      const medA = activeMeds[i];
      const medB = activeMeds[j];
      const nameA = medA.name.trim().toLowerCase();
      const nameB = medB.name.trim().toLowerCase();

      if (nameA === nameB || nameA.includes(nameB) || nameB.includes(nameA)) {
        addAlert({
          severity: 'high',
          category: 'Duplicate Therapy',
          drugsInvolved: [medA.name, medB.name],
          title: `Potential Duplicate Medication: ${medA.name}`,
          description: `You have multiple active prescriptions matching "${medA.name}". Taking duplicate doses may lead to accidental overdose.`,
          clinicalAdvice: 'Verify with your physician or pharmacist whether both bottles should be actively taken.',
        });
      }
    }
  }

  // Helper to find meds in class
  const findMedsInClass = (classKey: string): Medication[] =>
    activeMeds.filter((m) => matchesClass(m.name, classKey));

  const bloodThinners = findMedsInClass('blood_thinner');
  const nsaids = findMedsInClass('nsaid');
  const aceInhibitors = findMedsInClass('ace_inhibitor');
  const arbs = findMedsInClass('arb');
  const diuretics = findMedsInClass('diuretic');
  const potassiumSparers = findMedsInClass('potassium_sparing');
  const betaBlockers = findMedsInClass('beta_blocker');
  const ccbsNonDhp = findMedsInClass('ccb_non_dhp');
  const sulfonylureas = findMedsInClass('diabetes_sulfonylurea');
  const insulins = findMedsInClass('insulin');
  const sedatives = findMedsInClass('sedative_benzo_z');
  const opioids = findMedsInClass('opioid');

  // 2. Multiple Blood Thinners or Blood Thinner + NSAID
  if (bloodThinners.length >= 2) {
    addAlert({
      severity: 'high',
      category: 'Severe Bleeding Risk',
      drugsInvolved: bloodThinners.map((m) => m.name),
      title: 'Multiple Blood Thinners / Anticoagulants Detected',
      description: `Concurrent use of multiple anticoagulants/antiplatelets (${bloodThinners.map((m) => m.name).join(', ')}) significantly elevates internal and GI bleeding risk.`,
      clinicalAdvice: 'Confirm with your cardiologist that dual antiplatelet or anticoagulant therapy was explicitly prescribed.',
    });
  }

  if (bloodThinners.length > 0 && nsaids.length > 0) {
    addAlert({
      severity: 'high',
      category: 'Gastrointestinal Bleeding Risk',
      drugsInvolved: [...bloodThinners.map((m) => m.name), ...nsaids.map((m) => m.name)],
      title: 'Blood Thinner + NSAID Interaction',
      description: `Combining blood thinners (${bloodThinners.map((m) => m.name).join(', ')}) with anti-inflammatory pain relievers (${nsaids.map((m) => m.name).join(', ')}) greatly increases stomach ulcers and bleeding.`,
      clinicalAdvice: 'Ask your doctor if Acetaminophen (Tylenol) can be used instead for pain relief.',
    });
  }

  // 3. The "Triple Whammy" (ACE/ARB + Diuretic + NSAID)
  const renals = [...aceInhibitors, ...arbs];
  if (renals.length > 0 && diuretics.length > 0 && nsaids.length > 0) {
    addAlert({
      severity: 'high',
      category: 'Kidney Function Alert ("Triple Whammy")',
      drugsInvolved: [
        renals[0].name,
        diuretics[0].name,
        nsaids[0].name,
      ],
      title: 'Triple Whammy: Acute Kidney Stress Risk',
      description: `Taking a blood pressure medication (${renals[0].name}) + diuretic (${diuretics[0].name}) + NSAID (${nsaids[0].name}) drastically impairs renal filtration in elderly patients.`,
      clinicalAdvice: 'Notify your prescribing physician immediately to monitor serum creatinine and kidney lab values.',
    });
  } else if (renals.length > 0 && nsaids.length > 0) {
    addAlert({
      severity: 'moderate',
      category: 'Blood Pressure & Kidney Interaction',
      drugsInvolved: [renals[0].name, nsaids[0].name],
      title: 'NSAID May Blunt Blood Pressure Control',
      description: `${nsaids[0].name} can reduce the antihypertensive effectiveness of ${renals[0].name} and cause fluid retention.`,
      clinicalAdvice: 'Monitor your home blood pressure closely when taking NSAIDs.',
    });
  }

  // 4. Dual Renin-Angiotensin System Blockade (ACE Inhibitor + ARB)
  if (aceInhibitors.length > 0 && arbs.length > 0) {
    addAlert({
      severity: 'high',
      category: 'Dual RAS Blockade',
      drugsInvolved: [aceInhibitors[0].name, arbs[0].name],
      title: 'Dual Blood Pressure Blockade (ACE + ARB)',
      description: `Combining an ACE inhibitor (${aceInhibitors[0].name}) with an ARB (${arbs[0].name}) increases hyperkalemia, syncope, and renal dysfunction without added benefit.`,
      clinicalAdvice: 'Clarify with your prescribing physician if you should be taking only one of these agents.',
    });
  }

  // 5. ACE/ARB + Potassium Spared / Supplement
  if (renals.length > 0 && potassiumSparers.length > 0) {
    addAlert({
      severity: 'moderate',
      category: 'Hyperkalemia Warning (High Potassium)',
      drugsInvolved: [renals[0].name, potassiumSparers[0].name],
      title: 'Elevated Potassium (Hyperkalemia) Risk',
      description: `Both ${renals[0].name} and ${potassiumSparers[0].name} increase potassium retention, which can affect cardiac rhythm.`,
      clinicalAdvice: 'Ensure your doctor performs regular basic metabolic panel (BMP) blood work.',
    });
  }

  // 6. Beta Blocker + Rate-limiting Calcium Channel Blocker
  if (betaBlockers.length > 0 && ccbsNonDhp.length > 0) {
    addAlert({
      severity: 'high',
      category: 'Bradycardia & Heart Block Alert',
      drugsInvolved: [betaBlockers[0].name, ccbsNonDhp[0].name],
      title: 'Heart Rate Deceleration (Severe Bradycardia Risk)',
      description: `Concomitant use of ${betaBlockers[0].name} and ${ccbsNonDhp[0].name} exerts additive depressive effects on cardiac conduction.`,
      clinicalAdvice: 'Check pulse rate regularly. Report dizziness, fatigue, or heart rates under 50 bpm to your doctor.',
    });
  }

  // 7. Opioid + Benzodiazepine / Sedative (Black Box Warning)
  if (opioids.length > 0 && sedatives.length > 0) {
    addAlert({
      severity: 'high',
      category: 'Sedation, Fall & Respiratory Warning',
      drugsInvolved: [opioids[0].name, sedatives[0].name],
      title: 'FDA Black Box Warning: Opioid + Sedative',
      description: `Combining ${opioids[0].name} with ${sedatives[0].name} causes profound sedation, respiratory depression, and severe fall hazard in seniors.`,
      clinicalAdvice: 'Ensure your caregiver is aware of emergency signs. Do not drive or operate machinery.',
    });
  }

  // 8. Insulin + Sulfonylurea
  if (insulins.length > 0 && sulfonylureas.length > 0) {
    addAlert({
      severity: 'moderate',
      category: 'Hypoglycemia Risk (Low Blood Sugar)',
      drugsInvolved: [insulins[0].name, sulfonylureas[0].name],
      title: 'Additive Hypoglycemia Risk',
      description: `Taking ${sulfonylureas[0].name} concurrently with insulin multiplies the risk of sudden low blood sugar episodes.`,
      clinicalAdvice: 'Keep fast-acting glucose tablets or juice readily available and monitor blood sugar levels.',
    });
  }

  return alerts;
}

/**
 * Checks a proposed new medication name against existing active medications.
 */
export function checkNewMedicationSafety(
  candidateName: string,
  existingMeds: Medication[]
): DrugInteractionAlert[] {
  if (!candidateName.trim()) return [];
  const dummyMed: Medication = {
    id: 'candidate_test',
    userId: 'current',
    name: candidateName.trim(),
    strength: '',
    dosageAmount: '1 dose',
    type: 'Tablet',
    scheduledTimes: ['08:00 AM'],
    frequency: 'every_day',
    mealTiming: 'after_food',
    startDate: new Date().toISOString().split('T')[0],
    color: '#4f46e5',
    icon: 'pill',
    isActive: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  return evaluateDrugInteractions([...existingMeds, dummyMed]).filter((a) =>
    a.drugsInvolved.some((name) => name.toLowerCase() === candidateName.toLowerCase())
  );
}
