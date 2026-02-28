import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import { Toaster } from "sonner";
import { Header } from "./components/Header";
import { Gallery } from "./pages/Gallery";
import { ArtworkDetail } from "./pages/ArtworkDetail";
import { ArtistDetail } from "./pages/ArtistDetail";
import { Artists } from "./pages/Artists";
import { Admin } from "./pages/Admin";
import { AdminLogin } from "./pages/AdminLogin";
import { AdminProvider } from "./contexts/AdminContext";

export default function App() {
  return (
    <AdminProvider>
      <Router>
        <div className="min-h-screen bg-white">
          <Header />
          <main>
            <Routes>
              <Route path="/" element={<Gallery />} />
              <Route path="/artwork/:id" element={<ArtworkDetail />} />
              <Route path="/artists" element={<Artists />} />
              <Route path="/artist/:id" element={<ArtistDetail />} />
              <Route path="/admin/login" element={<AdminLogin />} />
              <Route path="/admin/*" element={<Admin />} />
            </Routes>
          </main>
          <Toaster />
        </div>
      </Router>
    </AdminProvider>
  );
}
