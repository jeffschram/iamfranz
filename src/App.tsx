import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import { Toaster } from "sonner";
import { Header } from "./components/Header";
import { Home } from "./pages/Home";
import { Gallery } from "./pages/Gallery";
import { ArtworkDetail } from "./pages/ArtworkDetail";
import { About } from "./pages/About";
import { Process } from "./pages/Process";

export default function App() {
  return (
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
          </Routes>
        </main>
        <Toaster />
      </div>
    </Router>
  );
}
