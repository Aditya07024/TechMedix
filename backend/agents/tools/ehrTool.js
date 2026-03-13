import { DynamicTool } from "langchain/tools";

export const ehrTool = new DynamicTool({
  name: "EHRAnalyzer",
  description: "Analyze patient vitals and generate structured clinical warnings",

  func: async (input) => {
    try {
      const ehr = JSON.parse(input);

      const alerts = [];

      const glucose = Number(ehr.glucose);
      const spo2 = Number(ehr.spo2);
      const heartRate = Number(ehr.heartRate);
      const systolic = Number(ehr.bloodPressureSystolic);
      const diastolic = Number(ehr.bloodPressureDiastolic);

      // 🩸 Glucose
      if (!isNaN(glucose)) {
        if (glucose >= 250) {
          alerts.push({
            type: "glucose",
            severity: "critical",
            message: "Severely elevated glucose level"
          });
        } else if (glucose >= 126) {
          alerts.push({
            type: "glucose",
            severity: "high",
            message: "High glucose level detected"
          });
        } else if (glucose >= 100) {
          alerts.push({
            type: "glucose",
            severity: "medium",
            message: "Prediabetic glucose range"
          });
        }
      }

      // 🫁 Oxygen
      if (!isNaN(spo2)) {
        if (spo2 < 85) {
          alerts.push({
            type: "spo2",
            severity: "critical",
            message: "Critically low oxygen saturation"
          });
        } else if (spo2 < 92) {
          alerts.push({
            type: "spo2",
            severity: "high",
            message: "Low oxygen saturation"
          });
        }
      }

      // ❤️ Heart Rate
      if (!isNaN(heartRate)) {
        if (heartRate > 130 || heartRate < 40) {
          alerts.push({
            type: "heart_rate",
            severity: "critical",
            message: "Abnormal heart rate"
          });
        } else if (heartRate > 100) {
          alerts.push({
            type: "heart_rate",
            severity: "medium",
            message: "Elevated heart rate"
          });
        }
      }

      // 🩺 Blood Pressure
      if (!isNaN(systolic) && !isNaN(diastolic)) {
        if (systolic > 180 || diastolic > 120) {
          alerts.push({
            type: "blood_pressure",
            severity: "critical",
            message: "Hypertensive crisis"
          });
        } else if (systolic > 140 || diastolic > 90) {
          alerts.push({
            type: "blood_pressure",
            severity: "high",
            message: "High blood pressure"
          });
        }
      }

      if (!alerts.length) {
        return JSON.stringify({
          status: "normal",
          message: "Vitals within acceptable range",
          alerts: []
        });
      }

      return JSON.stringify({
        status: "warning",
        alerts
      });

    } catch (err) {
      return JSON.stringify({
        status: "error",
        message: "Invalid EHR input"
      });
    }
  },
});