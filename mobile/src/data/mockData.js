export const patient = {
  name: "Sarah Johnson",
  initials: "SJ",
  healthScore: 84,
  queueToken: 42,
  queueAhead: 3,
  walletBalance: 1280,
};

export const patientMetrics = [
  { label: "Heart Rate", value: "72 bpm", trend: "Steady recovery" },
  { label: "Sleep", value: "7.8 hrs", trend: "+12% this week" },
  { label: "Steps", value: "8,234", trend: "Above your baseline" },
  { label: "SpO2", value: "98%", trend: "Optimal" },
];

export const notifications = [
  {
    id: "n1",
    title: "Queue update",
    message: "Your cardiology consultation is now 3 patients away.",
    time: "2 mins ago",
    tone: "info",
  },
  {
    id: "n2",
    title: "Prescription alert",
    message: "Atorvastatin has an interaction warning with your previous medication.",
    time: "1 hour ago",
    tone: "warning",
  },
  {
    id: "n3",
    title: "Wallet synced",
    message: "Your blood report and invoice were securely added to Health Wallet.",
    time: "Yesterday",
    tone: "success",
  },
];

export const upcomingAppointment = {
  doctor: "Dr. Aris Thorne",
  specialty: "Cardiologist",
  date: "Today, Oct 24",
  time: "2:00 PM",
  status: "Confirmed",
};

export const doctors = [
  {
    id: "d1",
    name: "Dr. Elena Vance",
    specialty: "Neurologist",
    rating: 4.9,
    experience: "12 years exp",
    location: "St. Mary's, NY",
    slot: "Tomorrow 10 AM",
    fee: "$120",
    initials: "EV",
  },
  {
    id: "d2",
    name: "Dr. Marcus Chen",
    specialty: "Orthopedic",
    rating: 4.8,
    experience: "8 years exp",
    location: "City Ortho, NY",
    slot: "Tomorrow 12 PM",
    fee: "$150",
    initials: "MC",
  },
  {
    id: "d3",
    name: "Dr. Laila Noor",
    specialty: "Dermatologist",
    rating: 4.7,
    experience: "10 years exp",
    location: "Vista Skin Center",
    slot: "Friday 9 AM",
    fee: "$95",
    initials: "LN",
  },
];

export const specialties = [
  { id: "s1", name: "Cardiology", icon: "heart-pulse" },
  { id: "s2", name: "Dermatology", icon: "account-heart-outline" },
  { id: "s3", name: "General Medicine", icon: "stethoscope" },
  { id: "s4", name: "Pediatrics", icon: "baby-face-outline" },
];

export const activePrescriptions = [
  {
    id: "p1",
    name: "Metformin",
    schedule: "Twice Daily • With Meals",
    status: "Daily",
    confidence: "98%",
    risk: "Low Risk",
  },
  {
    id: "p2",
    name: "Amoxicillin",
    schedule: "After Breakfast",
    status: "3 days left",
    confidence: "95%",
    risk: "Low Risk",
  },
  {
    id: "p3",
    name: "Atorvastatin 20mg",
    schedule: "Nightly",
    status: "Interaction alert",
    confidence: "95%",
    risk: "Moderate Risk",
  },
];

export const extractedMedicines = [
  {
    id: "m1",
    name: "Amoxicillin 500mg",
    dosage: "1x Capsule",
    frequency: "3x daily",
    duration: "7 days",
    confidence: 98,
    risk: "Low Risk",
  },
  {
    id: "m2",
    name: "Lisinopril 10mg",
    dosage: "1x Tablet",
    frequency: "Morning",
    duration: "30 days",
    confidence: 96,
    risk: "Low Risk",
  },
  {
    id: "m3",
    name: "Atorvastatin 20mg",
    dosage: "1x Tablet",
    frequency: "Nightly",
    duration: "30 days",
    confidence: 95,
    risk: "Moderate Risk",
    cheaperAlternative: "Lipi-Flow (Generic)",
  },
];

export const documentLibrary = [
  {
    id: "doc1",
    title: "Blood Report - Dec 2025",
    date: "Dec 12, 2025",
    size: "1.2 MB",
    type: "Lab Report",
    action: "download",
    color: "primary",
  },
  {
    id: "doc2",
    title: "Chest X-ray - Jan 2026",
    date: "Jan 05, 2026",
    size: "14.5 MB",
    type: "Imaging",
    action: "visibility",
    color: "tertiary",
  },
  {
    id: "doc3",
    title: "Medication List",
    date: "Updated Yesterday",
    size: "450 KB",
    type: "Prescription",
    action: "share-variant",
    color: "secondary",
  },
  {
    id: "doc4",
    title: "Consultation Invoice #892",
    date: "Feb 14, 2026",
    size: "2.1 MB",
    type: "Billing",
    action: "download",
    color: "outline",
  },
];

export const timeline = [
  {
    id: "t1",
    type: "Appointment",
    title: "Dr. Vance (Neurology)",
    date: "Jan 15",
    body: "Routine follow-up regarding persistent headaches and migraine management protocol.",
    tag: "Appointment",
    details: ["North Wing, Suite 402", "09:30 AM — 10:15 AM"],
  },
  {
    id: "t2",
    type: "Lab Results",
    title: "Blood Test Uploaded",
    date: "Jan 10",
    body: "Complete Blood Count (CBC) and Metabolic Panel results are now available for review.",
    tag: "Lab Results",
    details: ["View Report (PDF)"],
  },
  {
    id: "t3",
    type: "Prescription",
    title: "Amoxicillin (500mg)",
    date: "Dec 20",
    body: "7-day cycle for upper respiratory infection.",
    tag: "Prescription",
    details: ["Course Completed"],
  },
  {
    id: "t4",
    type: "Diagnosis",
    title: "Seasonal Allergy",
    date: "Nov 5",
    body: "Confirmed allergic rhinitis triggered by autumnal pollen counts.",
    tag: "Diagnosis",
    details: [],
  },
];

export const chatMessages = [
  { id: "c1", role: "user", text: "What are the side effects of Metformin?" },
  {
    id: "c2",
    role: "assistant",
    text: "Common side effects include nausea and stomach upset. It's usually best taken with meals.",
  },
  {
    id: "c3",
    role: "assistant",
    text: "Would you like to see the full list, check interactions, or review how to take it safely?",
  },
];

export const chatSuggestions = [
  "Show full list",
  "Check drug interactions",
  "How to take it?",
];

export const doctor = {
  name: "Dr. Aris Thorne",
  initials: "AT",
  monthlyEarnings: "$12,400",
  todaysPatients: 14,
  pendingAppointments: 3,
};

export const doctorQueue = {
  active: {
    name: "Sarah Johnson",
    initials: "SJ",
    token: "#45",
    issue: "Cough / Fever",
    duration: "12m 45s",
  },
  waiting: [
    { id: "q1", token: "#46", name: "Marcus Thorne", issue: "Severe Headache", status: "Arrived" },
    { id: "q2", token: "#47", name: "Elena Rodriguez", issue: "Follow-up", status: "Delayed" },
    { id: "q3", token: "#48", name: "James Wilson", issue: "Routine Checkup", status: "In Transit" },
  ],
};

export const doctorAppointments = [
  {
    id: "a1",
    patient: "Marcus Thorne",
    slot: "09:00 AM",
    type: "General Checkup",
    payment: "Paid · Online",
  },
  {
    id: "a2",
    patient: "Elena Rodriguez",
    slot: "11:30 AM",
    type: "Follow-up",
    payment: "Due · Cash",
  },
  {
    id: "a3",
    patient: "James Wilson",
    slot: "03:15 PM",
    type: "Prescription Review",
    payment: "Paid · Wallet",
  },
];

export const doctorSchedule = [
  { day: "Monday", window: "09:00 AM - 05:00 PM", rooms: "North Wing / Room 4", slots: 11 },
  { day: "Tuesday", window: "10:00 AM - 04:00 PM", rooms: "Teleconsult + Room 2", slots: 8 },
  { day: "Wednesday", window: "09:30 AM - 06:00 PM", rooms: "Main Clinic", slots: 13 },
  { day: "Thursday", window: "08:00 AM - 02:00 PM", rooms: "Diagnostics Block", slots: 7 },
];

export const xrayComparisons = [
  { id: "x1", title: "Baseline Scan", date: "Oct 12, 2023" },
  { id: "x2", title: "Routine Check", date: "Jan 04, 2024" },
];
