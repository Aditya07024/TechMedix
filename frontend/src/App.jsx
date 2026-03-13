import React, { useState } from "react";
import Navbar from "./components/navbar/Navbar";
import { Route, Routes, useLocation } from "react-router-dom";
import Home from "./pages/Home/Home";
import LoginPop from "./components/LoginPop/LoginPop";
import WishList from "./pages/WishList/WishList";
import ProductView from "./pages/ProductView/ProductView";
import Search from "./pages/Search/Search";
import { GoogleOAuthProvider } from "@react-oauth/google";
import AddMedicine from "./components/AddMedicine/AddMedicine";
import EditMedicine from "./components/EditMedicine/EditMedicine";
import Notfound from "./pages/Notfound/notfound";
import Landingpage from "./pages/Landingpage/Landingpage";
import MedicineReminder from "./components/MedicineReminder/MedicineReminder";
import HealthTips from "./pages/HealthTips/HealthTips";
import ReportGenerator from "./pages/ReportGenerator/ReportGenerator";
import { Dashboard } from "./pages/Dashboard/Dashboard";
import { Form } from "./pages/Form/Form";
import { AuthProvider } from "./context/AuthContext";
import ProtectedRoute from "./components/ProtectedRoute/ProtectedRoute";
import DoctorLogin from "./pages/DoctorLogin/DoctorLogin";
import DoctorSignup from "./pages/DoctorSignup/DoctorSignup";
import TermsAndConditions from "./pages/TermsAndConditions/TermsAndConditions";
import PatientDashboard from "./pages/PatientDashboard/PatientDashboard";
import DoctorDashboardNew from "./pages/DoctorDashboardNew/DoctorDashboardNew";
import AdminDashboard from "./pages/AdminDashboard/AdminDashboard";

import UploadPrescription from "./pages/UploadPrescription/UploadPrescription";
import PrescriptionDetails from "./pages/UploadPrescription/PrescriptionDetails";
import PaymentPage from "./pages/Payments/PaymentPage";
import HealthMetrics from "./components/HealthMetrics/HealthMetrics";
import HealthWallet from "./pages/HealthWallet/HealthWallet";

const App = () => {
  const [showLogin, setShowLogin] = useState(false);
  const location = useLocation();

  const GoogleAuthWrapper = () => {
    return (
      <GoogleOAuthProvider clientId="191971308377-7j7inqnrmn7pk4m7oaag8o5bru6qv9li.apps.googleusercontent.com">
        <LoginPop setShowLogin={setShowLogin} />
      </GoogleOAuthProvider>
    );
  };

  return (
    <AuthProvider>
      {showLogin && <GoogleAuthWrapper />}

      <div className="app">
        {location.pathname !== "/" && <Navbar setShowLogin={setShowLogin} />}

        <Routes>
          <Route path="/" element={<Landingpage />} />
          <Route path="/home" element={<Home />} />
          <Route path="/wishlist" element={<WishList />} />
          <Route path="/view" element={<ProductView />} />
          <Route path="/reminders" element={<MedicineReminder />} />
          <Route path="/health-tips" element={<HealthTips />} />
          <Route path="/search" element={<Search />} />
          <Route path="/health" element={<HealthMetrics />}/>

          {/* 🔥 PRESCRIPTION FLOW */}
          <Route path="/upload-prescription" element={<UploadPrescription />} />
          <Route
            path="/prescription-details"
            element={<PrescriptionDetails />}
          />

          <Route
            path="/new/dashboard"
            element={
              <ProtectedRoute>
                <Dashboard />
              </ProtectedRoute>
            }
          />

          {/* ✨ NEW PATIENT DASHBOARD */}
          <Route
            path="/dashboard"
            element={
              <ProtectedRoute requiredRole="patient">
                <PatientDashboard />
              </ProtectedRoute>
            }
          />

          <Route
            path="/health-wallet"
            element={
              <ProtectedRoute requiredRole="patient">
                <HealthWallet />
              </ProtectedRoute>
            }
          />

          <Route path="/new" element={<AddMedicine />} />
          <Route path="/medicines/:id" element={<EditMedicine />} />
          <Route path="/report-generator" element={<ReportGenerator />} />
          <Route path="/form" element={<Form />} />

          <Route path="/doctor/login" element={<DoctorLogin />} />
          <Route path="/doctor/signup" element={<DoctorSignup />} />
          <Route path="/payment/:appointmentId" element={<PaymentPage />} />

          {/* ✨ DOCTOR DASHBOARD */}
          <Route
            path="/doctor/dashboard"
            element={
              <ProtectedRoute requiredRole="doctor">
                <DoctorDashboardNew />
              </ProtectedRoute>
            }
          />

          {/* 👑 ADMIN DASHBOARD */}
          <Route
            path="/admin/dashboard"
            element={
              <ProtectedRoute requiredRole="admin">
                <AdminDashboard />
              </ProtectedRoute>
            }
          />

          {/* 📄 TERMS & CONDITIONS */}
          <Route path="/terms" element={<TermsAndConditions />} />

          {/* 🔥 FALLBACK */}
          <Route path="*" element={<Notfound />} />
        </Routes>
      </div>
    </AuthProvider>
  );
};

export default App;
