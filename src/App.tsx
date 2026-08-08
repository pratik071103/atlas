import { Routes, Route } from "react-router-dom";
import { Navbar } from "./components/Navbar";
import { AuthModal } from "./components/AuthModal";
import { Landing } from "./pages/Landing";
import { Pricing } from "./pages/Pricing";
import { Dashboard } from "./pages/Dashboard";
import { DevWebhooks } from "./pages/DevWebhooks";

export default function App() {
  return (
    <div className="min-h-screen bg-paper">
      <Navbar />
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/pricing" element={<Pricing />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/dev/webhooks" element={<DevWebhooks />} />
      </Routes>
      <AuthModal />
    </div>
  );
}
