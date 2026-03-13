import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import { Toaster } from "sonner";
import { Header } from "./components/Header";
import { Home } from "./pages/Home";
import { Gallery } from "./pages/Gallery";
import { ArtworkDetail } from "./pages/ArtworkDetail";
import { ArtistDetail } from "./pages/ArtistDetail";
import { Artists } from "./pages/Artists";
import { About } from "./pages/About";
import { Process } from "./pages/Process";
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
              <Route path="/" element={<Home />} />
              <Route path="/archive" element={<Gallery />} />
              <Route path="/work/:id" element={<ArtworkDetail />} />
              <Route path="/artwork/:id" element={<ArtworkDetail />} />
              <Route path="/about" element={<About />} />
              <Route path="/process" element={<Process />} />
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
