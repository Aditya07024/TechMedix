import React, { useState, useEffect } from 'react';

const PatientDetails = ({ patient }) => {
  // Assuming 'patient' prop contains the patient ID
  const patientId = patient ? patient._id : null;

  useEffect(() => {
    if (patientId) {
      console.log("Patient ID:", patientId);
      // Here, you would trigger the QR code generation logic
      // For example, calling a function that uses a QR code library
      generateQRCode(patientId); // Call the function to generate QR code
    }
  }, [patientId]);

  const generateQRCode = (id) => {
    // Implement your QR code generation logic here
    // This is just a placeholder
    console.log("Generating QR code for patient ID:", id);
  }

  return (
    <div>
      {/* Existing patient details code */}
    </div>
  );
};

export default PatientDetails;