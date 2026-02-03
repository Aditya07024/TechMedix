INSERT INTO drug_interactions
(medicine_a, medicine_b, interaction_type, severity, description, mechanism, recommendation, source)
VALUES
-- NSAID + NSAID
('Ibuprofen', 'Diclofenac', 'NSAID duplication', 'high',
 'Using two NSAIDs together increases risk of GI bleeding and kidney damage',
 'Both inhibit COX enzymes leading to additive toxicity',
 'Avoid combination; use single NSAID at lowest effective dose',
 'FDA'),

-- NSAID + Blood thinner
('Aspirin', 'Warfarin', 'Bleeding risk', 'critical',
 'Combination significantly increases bleeding risk',
 'Platelet inhibition + anticoagulation',
 'Avoid unless strictly supervised by physician',
 'NIH'),

-- Antibiotic + Alcohol
('Metronidazole', 'Alcohol', 'Disulfiram-like reaction', 'high',
 'May cause nausea, vomiting, flushing, palpitations',
 'Inhibition of aldehyde dehydrogenase',
 'Avoid alcohol during and 48 hours after therapy',
 'FDA'),

-- Antibiotic + Antacid
('Ciprofloxacin', 'Calcium carbonate', 'Reduced absorption', 'medium',
 'Calcium reduces absorption of ciprofloxacin',
 'Chelation in GI tract',
 'Take ciprofloxacin 2 hours before or 6 hours after antacids',
 'NIH'),

-- Heart + Antibiotic
('Amiodarone', 'Azithromycin', 'QT prolongation', 'critical',
 'Increases risk of life-threatening arrhythmia',
 'Additive QT interval prolongation',
 'Avoid combination; monitor ECG closely',
 'FDA'),

-- Diabetes + Beta-blocker
('Insulin', 'Propranolol', 'Hypoglycemia masking', 'medium',
 'Beta-blockers may mask symptoms of low blood sugar',
 'Inhibition of adrenergic response',
 'Monitor blood glucose closely',
 'NIH'),

-- Painkiller + Alcohol
('Paracetamol', 'Alcohol', 'Liver toxicity', 'high',
 'Increased risk of severe liver damage',
 'Increased production of toxic metabolites',
 'Avoid alcohol during treatment',
 'FDA'),

-- Antibiotic combo
('Clarithromycin', 'Simvastatin', 'Muscle toxicity', 'critical',
 'Risk of rhabdomyolysis',
 'CYP3A4 inhibition increases statin levels',
 'Stop statin during antibiotic therapy',
 'FDA'),

-- BP meds
('Lisinopril', 'Spironolactone', 'Hyperkalemia', 'high',
 'Increased potassium levels may occur',
 'Reduced potassium excretion',
 'Monitor potassium levels',
 'NIH'),

-- Antidepressant + Painkiller
('Sertraline', 'Tramadol', 'Serotonin syndrome', 'critical',
 'Risk of agitation, fever, seizures',
 'Excess serotonergic activity',
 'Avoid combination',
 'FDA');