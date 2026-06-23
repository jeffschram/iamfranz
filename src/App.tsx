import { BrowserRouter as Router, Routes, Route, useLocation } from "react-router-dom";
import { Toaster } from "sonner";
import { Header } from "./components/Header";
import { Home } from "./pages/Home";
import { Full } from "./pages/Full";
import { Cycle } from "./pages/Cycle";
import { Evolution } from "./pages/Evolution";
import { Gallery } from "./pages/Gallery";
import { ArtworkDetail } from "./pages/ArtworkDetail";
import { About } from "./pages/About";
import { ArtistMission } from "./pages/ArtistMission";
import { Process } from "./pages/Process";
import { HowItWorks } from "./pages/HowItWorks";

function AppShell() {
  const location = useLocation();
  const isCyclePage = location.pathname === "/cycle";

  return (
    <div className={isCyclePage ? "min-h-screen bg-black" : "min-h-screen bg-white"}>
      {!isCyclePage && <Header />}
      <main>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/full" element={<Full />} />
          <Route path="/cycle" element={<Cycle />} />
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
  );
}

export default function App() {
  return (
    <Router>
      <AppShell />
    </Router>
  );
}
