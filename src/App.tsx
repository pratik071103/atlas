import { Routes, Route } from "react-router-dom";
import { Navbar } from "./components/Navbar";
import { AuthModal } from "./components/AuthModal";
import { Landing } from "./pages/Landing";
import { Pricing } from "./pages/Pricing";
import { Dashboard } from "./pages/Dashboard";

export default function App() {
  return (
    <div className="min-h-screen bg-paper">
      <Navbar />
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/pricing" element={<Pricing />} />
        <Route path="/dashboard" element={<Dashboard />} />
      </Routes>
      <AuthModal />
    </div>
  );
}
