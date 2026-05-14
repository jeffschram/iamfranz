import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import { Toaster } from "sonner";
import { Header } from "./components/Header";
import { Home } from "./pages/Home";
import { Evolution } from "./pages/Evolution";
import { Gallery } from "./pages/Gallery";
import { ArtworkDetail } from "./pages/ArtworkDetail";
import { About } from "./pages/About";
import { ArtistMission } from "./pages/ArtistMission";
import { Process } from "./pages/Process";
import { HowItWorks } from "./pages/HowItWorks";

export default function App() {
  return (
    <Router>
      <div className="min-h-screen bg-white">
        <Header />
        <main>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/evolution" element={<Evolution />} />
            <Route path="/archive" element={<Gallery />} />
            <Route path="/work/:id" element={<ArtworkDetail />} />
            <Route path="/artwork/:id" element={<ArtworkDetail />} />
            <Route path="/artist-mission" element={<ArtistMission />} />
            <Route path="/about" element={<About />} />
            <Route path="/process" element={<Process />} />
            <Route path="/how-it-works" element={<HowItWorks />} />
          </Routes>
        </main>
        <Toaster />
      </div>
    </Router>
  );
}
