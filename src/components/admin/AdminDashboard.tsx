import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Link } from "react-router-dom";
import { useAdmin } from "../../contexts/AdminContext";

export function AdminDashboard() {
  const { logout } = useAdmin();
  const artworks = useQuery(api.artworks.list);
  const artists = useQuery(api.artists.list);

  return (
    <div className="space-y-8">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold text-black">Admin Dashboard</h1>
        <button
          onClick={logout}
          className="px-4 py-2 text-sm font-medium text-gray-600 hover:text-black transition-colors"
        >
          Logout
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white p-6 rounded-lg border border-gray-200">
          <h2 className="text-xl font-semibold text-black mb-4">Artworks</h2>
          <p className="text-3xl font-bold text-black mb-4">
            {artworks?.length || 0}
          </p>
          <Link
            to="/admin/artworks"
            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-black hover:bg-gray-800"
          >
            Manage Artworks
          </Link>
        </div>

        <div className="bg-white p-6 rounded-lg border border-gray-200">
          <h2 className="text-xl font-semibold text-black mb-4">Artists</h2>
          <p className="text-3xl font-bold text-black mb-4">
            {artists?.length || 0}
          </p>
          <Link
            to="/admin/artists"
            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-black hover:bg-gray-800"
          >
            Manage Artists
          </Link>
        </div>
      </div>

      <div className="bg-white p-6 rounded-lg border border-gray-200">
        <h2 className="text-xl font-semibold text-black mb-4">Quick Actions</h2>
        <div className="space-y-2">
          <Link
            to="/admin/artists"
            className="block text-blue-600 hover:text-blue-800 transition-colors"
          >
            Add New Artist
          </Link>
          <Link
            to="/admin/artworks"
            className="block text-blue-600 hover:text-blue-800 transition-colors"
          >
            Add New Artwork
          </Link>
        </div>
      </div>
    </div>
  );
}
