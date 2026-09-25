import mongoose from 'mongoose';

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/hms';

export interface IPatient {
  _id: string;
  name: string;
  status?: 'In-Patient' | 'Discharged' | 'Observation';
  admissionType?: string;
  ward?: string;
  age?: number;
  gender?: string;
  bloodGroup?: string;
  diagnosis?: string;
  attendingDoctor?: string;
  vitals?: {
    temp?: string;
    bp?: string;
    pulse?: string;
    spO2?: string;
  };
  medicalHistory?: {
    allergies?: string[];
    currentMedications?: string[];
    pastConditions?: string[];
  };
  dischargeNotes?: string;
  dischargedAt?: string | Date;
  createdAt?: string | Date;
  updatedAt?: string | Date;
}

interface MongooseCache {
  conn: typeof mongoose | null;
  promise: Promise<typeof mongoose> | null;
}

declare global {
  var mongooseCache: MongooseCache | undefined;
  var inMemoryPatients: IPatient[] | undefined;
}

let cached: MongooseCache = global.mongooseCache || { conn: null, promise: null };
if (!global.mongooseCache) {
  global.mongooseCache = cached;
}

// Rich initial sample patients for in-memory fallback
const INITIAL_PATIENTS: IPatient[] = [
  {
    _id: "650000000000000000000001",
    name: "Eleanor Vance",
    age: 68,
    gender: "Female",
    bloodGroup: "A+",
    status: "In-Patient",
    admissionType: "Level 2 - Emergency",
    ward: "Ward A (ICU)",
    diagnosis: "Severe Acute Respiratory Distress & Sepsis",
    attendingDoctor: "Dr. Sarah Chen, MD (Critical Care)",
    vitals: { temp: "101.4", bp: "155/95", pulse: "104", spO2: "90" },
    medicalHistory: {
      allergies: ["Penicillin", "Sulfa Drugs"],
      currentMedications: ["Ceftriaxone 1g IV", "Albuterol Inhaler", "Oxygen 4L/min"],
      pastConditions: ["Chronic Asthma", "Type 2 Diabetes"]
    },
    createdAt: new Date(Date.now() - 86400000 * 2).toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    _id: "650000000000000000000002",
    name: "Marcus Aurelius",
    age: 45,
    gender: "Male",
    bloodGroup: "O+",
    status: "In-Patient",
    admissionType: "Level 3 - Routine",
    ward: "Ward B (General)",
    diagnosis: "Post-Operative Appendectomy Recovery",
    attendingDoctor: "Dr. David Miller, MD (General Surgery)",
    vitals: { temp: "98.6", bp: "120/80", pulse: "72", spO2: "98" },
    medicalHistory: {
      allergies: ["Latex"],
      currentMedications: ["Ibuprofen 400mg", "Amoxicillin 500mg"],
      pastConditions: ["Mild Hypertension"]
    },
    createdAt: new Date(Date.now() - 3600000 * 18).toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    _id: "650000000000000000000003",
    name: "Sophia Chen",
    age: 12,
    gender: "Female",
    bloodGroup: "B+",
    status: "In-Patient",
    admissionType: "Level 3 - Routine",
    ward: "Ward C (Pediatrics)",
    diagnosis: "Acute Bronchiolitis with Mild Dehydration",
    attendingDoctor: "Dr. Emily Taylor, MD (Pediatrics)",
    vitals: { temp: "99.1", bp: "105/70", pulse: "84", spO2: "97" },
    medicalHistory: {
      allergies: ["Peanuts"],
      currentMedications: ["Saline Nebulizer", "Oral Rehydration Salts"],
      pastConditions: ["Seasonal Rhinitis"]
    },
    createdAt: new Date(Date.now() - 3600000 * 30).toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    _id: "650000000000000000000004",
    name: "James Wilson",
    age: 72,
    gender: "Male",
    bloodGroup: "AB-",
    status: "In-Patient",
    admissionType: "Level 1 - Resuscitation",
    ward: "Ward A (ICU)",
    diagnosis: "Hypertensive Crisis & Unstable Angina",
    attendingDoctor: "Dr. Robert Sterling, MD (Cardiology)",
    vitals: { temp: "98.2", bp: "168/102", pulse: "112", spO2: "91" },
    medicalHistory: {
      allergies: ["Aspirin", "ACE Inhibitors"],
      currentMedications: ["Nitroglycerin Infusion", "Metoprolol 25mg", "Atorvastatin 80mg"],
      pastConditions: ["Coronary Artery Disease", "Myocardial Infarction"]
    },
    createdAt: new Date(Date.now() - 3600000 * 8).toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    _id: "650000000000000000000005",
    name: "Amina Al-Mansoor",
    age: 34,
    gender: "Female",
    bloodGroup: "O-",
    status: "Discharged",
    admissionType: "Level 2 - Emergency",
    ward: "ER Cabin 1",
    diagnosis: "Resolved Concussion following minor fall",
    attendingDoctor: "Dr. Kevin Patel, MD (Emergency Medicine)",
    vitals: { temp: "98.4", bp: "118/76", pulse: "68", spO2: "99" },
    medicalHistory: {
      allergies: ["None known"],
      currentMedications: ["Acetaminophen 500mg PRN"],
      pastConditions: ["None"]
    },
    dischargeNotes: "Full neurological recovery noted. Follow up in 7 days if headaches persist.",
    dischargedAt: new Date(Date.now() - 3600000 * 4).toISOString(),
    createdAt: new Date(Date.now() - 86400000).toISOString(),
    updatedAt: new Date().toISOString()
  }
];

if (!global.inMemoryPatients) {
  global.inMemoryPatients = [...INITIAL_PATIENTS];
}

export const inMemoryPatientsStore = {
  getAll: (): IPatient[] => {
    return [...(global.inMemoryPatients || [])];
  },
  create: (patient: Partial<IPatient>): IPatient => {
    const newPatient: IPatient = {
      ...patient,
      _id: new mongoose.Types.ObjectId().toString(),
      name: patient.name || "Unknown",
      status: (patient.status as any) || "In-Patient",
      admissionType: patient.admissionType || "Level 3 - Routine",
      ward: patient.ward || "Ward B (General)",
      diagnosis: patient.diagnosis || "Under Observation",
      attendingDoctor: patient.attendingDoctor || "Dr. Unassigned, MD",
      vitals: patient.vitals || { temp: "98.6", bp: "120/80", pulse: "72", spO2: "98" },
      medicalHistory: patient.medicalHistory || { allergies: [], currentMedications: [], pastConditions: [] },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    global.inMemoryPatients = [newPatient, ...(global.inMemoryPatients || [])];
    return newPatient;
  },
  update: (id: string, updates: Partial<IPatient>): IPatient | null => {
    const list = global.inMemoryPatients || [];
    const index = list.findIndex(p => p._id === id);
    if (index === -1) return null;
    const updated = {
      ...list[index],
      ...updates,
      updatedAt: new Date().toISOString()
    };
    list[index] = updated;
    global.inMemoryPatients = [...list];
    return updated;
  },
  delete: (id: string): boolean => {
    const list = global.inMemoryPatients || [];
    const initialLength = list.length;
    global.inMemoryPatients = list.filter(p => p._id !== id);
    return global.inMemoryPatients.length < initialLength;
  }
};

export const connectDB = async (): Promise<boolean> => {
  if (cached.conn) {
    return true;
  }

  if (!cached.promise) {
    const opts = {
      bufferCommands: false,
      serverSelectionTimeoutMS: 8000,
    };
    cached.promise = mongoose.connect(MONGODB_URI, opts).then((m) => m);
  }

  try {
    cached.conn = await cached.promise;
    console.log("✅ Connected to MongoDB Atlas");
    return true;
  } catch (error) {
    console.warn("⚠️ MongoDB Atlas connection error:", error);
    cached.promise = null;
    return false;
  }
};

const PatientSchema = new mongoose.Schema({
  name: { type: String, required: true },
  status: { type: String, default: 'In-Patient' },
  admissionType: { type: String, default: 'Level 3 - Routine' },
  ward: { type: String, default: 'Ward B (General)' },
  age: Number,
  gender: String,
  bloodGroup: String,
  diagnosis: String,
  attendingDoctor: String,
  vitals: {
    temp: String,
    bp: String,
    pulse: String,
    spO2: String
  },
  medicalHistory: {
    allergies: [String],
    currentMedications: [String],
    pastConditions: [String]
  },
  dischargeNotes: String,
  dischargedAt: Date
}, { timestamps: true });

export const Patient = mongoose.models.Patient || mongoose.model('Patient', PatientSchema);