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
          <Route
            path="/dashboard"
            element={
              <ProtectedRoute>
                <Dashboard />
              </ProtectedRoute>
            }
          />
          <Route path="/search" element={<Search />} />
          <Route path="/new" element={<AddMedicine />} />
          <Route path="/medicines/:id" element={<EditMedicine />} />
          <Route path="/report-generator" element={<ReportGenerator />} />
          <Route path="*" element={<Notfound />} />
          <Route path="/form" element={<Form />} />
        </Routes>
      </div>
    </AuthProvider>
  );
};

export default App;
