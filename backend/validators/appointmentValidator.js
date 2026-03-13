export function validateAppointmentBooking(data) {
  const errors = [];

  if (!data.patient_id || typeof data.patient_id !== "string") {
    errors.push("Valid patient_id required");
  }

  if (!data.doctor_id || typeof data.doctor_id !== "string") {
    errors.push("Valid doctor_id required");
  }

  if (
    !data.appointment_date ||
    isNaN(new Date(data.appointment_date).getTime())
  ) {
    errors.push("Valid appointment_date required");
  }

  if (!data.slot_time || !/^\d{2}:\d{2}$/.test(data.slot_time)) {
    errors.push("Valid slot_time (HH:MM) required");
  }

  if (data.share_history && typeof data.share_history !== "boolean") {
    errors.push("share_history must be boolean");
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

export function validatePrescription(data) {
  const errors = [];

  if (!data.doctor_id || typeof data.doctor_id !== "string") {
    errors.push("Valid doctor_id required");
  }

  if (!data.patient_id || typeof data.patient_id !== "string") {
    errors.push("Valid patient_id required");
  }

  if (!Array.isArray(data.medicines) || data.medicines.length === 0) {
    errors.push("At least one medicine required");
  }

  data.medicines?.forEach((medicine, idx) => {
    if (!medicine.name || typeof medicine.name !== "string") {
      errors.push(`Medicine ${idx}: name required`);
    }
    if (!medicine.dosage || typeof medicine.dosage !== "string") {
      errors.push(`Medicine ${idx}: dosage required`);
    }
    if (!medicine.frequency || typeof medicine.frequency !== "string") {
      errors.push(`Medicine ${idx}: frequency required`);
    }
    if (!medicine.duration_days || typeof medicine.duration_days !== "number") {
      errors.push(`Medicine ${idx}: duration_days (number) required`);
    }
  });

  return {
    isValid: errors.length === 0,
    errors,
  };
}

export function validateDoctorSchedule(data) {
  const errors = [];

  if (
    typeof data.day_of_week !== "number" ||
    data.day_of_week < 0 ||
    data.day_of_week > 6
  ) {
    errors.push("day_of_week must be 0-6");
  }

  if (!data.start_time || !/^\d{2}:\d{2}$/.test(data.start_time)) {
    errors.push("Valid start_time (HH:MM) required");
  }

  if (!data.end_time || !/^\d{2}:\d{2}$/.test(data.end_time)) {
    errors.push("Valid end_time (HH:MM) required");
  }

  if (
    !data.consultation_duration_minutes ||
    typeof data.consultation_duration_minutes !== "number" ||
    data.consultation_duration_minutes <= 0
  ) {
    errors.push("consultation_duration_minutes must be positive number");
  }

  if (data.start_time >= data.end_time) {
    errors.push("end_time must be after start_time");
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

export function validateReschedule(data) {
  const errors = [];

  if (!data.new_date || isNaN(new Date(data.new_date).getTime())) {
    errors.push("Valid new_date required");
  }

  if (!data.new_slot_time || !/^\d{2}:\d{2}$/.test(data.new_slot_time)) {
    errors.push("Valid new_slot_time (HH:MM) required");
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}
