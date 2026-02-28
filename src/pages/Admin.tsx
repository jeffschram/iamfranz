import { Routes, Route, Navigate } from "react-router-dom";
import { useAdmin } from "../contexts/AdminContext";
import { AdminDashboard } from "../components/admin/AdminDashboard";
import { AdminArtworks } from "../components/admin/AdminArtworks";
import { AdminArtists } from "../components/admin/AdminArtists";

export function Admin() {
  const { isAuthenticated } = useAdmin();

  if (!isAuthenticated) {
    return <Navigate to="/admin/login" replace />;
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <Routes>
        <Route path="/" element={<AdminDashboard />} />
        <Route path="/artworks" element={<AdminArtworks />} />
        <Route path="/artists" element={<AdminArtists />} />
      </Routes>
    </div>
  );
}
