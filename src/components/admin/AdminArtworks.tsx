import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Id } from "../../../convex/_generated/dataModel";

export function AdminArtworks() {
  const artworks = useQuery(api.artworks.list);
  const artists = useQuery(api.artists.list);
  const createArtwork = useMutation(api.artworks.create);
  const updateArtwork = useMutation(api.artworks.update);
  const removeArtwork = useMutation(api.artworks.remove);
  const generateUploadUrl = useMutation(api.artworks.generateUploadUrl);

  const [showForm, setShowForm] = useState(false);
  const [editingArtwork, setEditingArtwork] = useState<Id<"artworks"> | null>(null);
  const [formData, setFormData] = useState({
    title: "",
    description: "",
    artistId: "" as Id<"artists">,
    year: new Date().getFullYear(),
    medium: "",
    dimensions: "",
    price: "",
    isAvailable: true,
    featured: false,
  });
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!imageFile && !editingArtwork) {
      alert("Please select an image");
      return;
    }

    setUploading(true);
    
    try {
      let imageId = null;
      
      if (imageFile) {
        const uploadUrl = await generateUploadUrl();
        const result = await fetch(uploadUrl, {
          method: "POST",
          headers: { "Content-Type": imageFile.type },
          body: imageFile,
        });
        
        const { storageId } = await result.json();
        imageId = storageId;
      }

      const artworkData = {
        title: formData.title,
        description: formData.description,
        artistId: formData.artistId,
        year: formData.year,
        medium: formData.medium,
        dimensions: formData.dimensions || undefined,
        price: formData.price ? parseFloat(formData.price) : undefined,
        isAvailable: formData.isAvailable,
        featured: formData.featured,
      };

      if (editingArtwork) {
        await updateArtwork({
          id: editingArtwork,
          ...artworkData,
        });
      } else {
        await createArtwork({
          ...artworkData,
          imageId: imageId!,
        });
      }
      
      resetForm();
    } catch (error) {
      console.error("Failed to save artwork:", error);
    } finally {
      setUploading(false);
    }
  };

  const resetForm = () => {
    setFormData({
      title: "",
      description: "",
      artistId: "" as Id<"artists">,
      year: new Date().getFullYear(),
      medium: "",
      dimensions: "",
      price: "",
      isAvailable: true,
      featured: false,
    });
    setImageFile(null);
    setShowForm(false);
    setEditingArtwork(null);
  };

  const startEdit = (artwork: any) => {
    setFormData({
      title: artwork.title,
      description: artwork.description,
      artistId: artwork.artistId,
      year: artwork.year,
      medium: artwork.medium,
      dimensions: artwork.dimensions || "",
      price: artwork.price?.toString() || "",
      isAvailable: artwork.isAvailable,
      featured: artwork.featured,
    });
    setEditingArtwork(artwork._id);
    setShowForm(true);
  };

  if (!artworks || !artists) {
    return (
      <div className="flex justify-center items-center min-h-96">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-black"></div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold text-black">Manage Artworks</h1>
        <button
          onClick={() => setShowForm(true)}
          className="px-4 py-2 bg-black text-white rounded-md hover:bg-gray-800 transition-colors"
        >
          Add Artwork
        </button>
      </div>

      {showForm && (
        <div className="bg-white p-6 rounded-lg border border-gray-200">
          <h2 className="text-xl font-semibold mb-4">
            {editingArtwork ? "Edit Artwork" : "Add New Artwork"}
          </h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Title
                </label>
                <input
                  type="text"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-black focus:border-black"
                  required
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Artist
                </label>
                <select
                  value={formData.artistId}
                  onChange={(e) => setFormData({ ...formData, artistId: e.target.value as Id<"artists"> })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-black focus:border-black"
                  required
                >
                  <option value="">Select an artist</option>
                  {artists.map((artist) => (
                    <option key={artist._id} value={artist._id}>
                      {artist.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Description
              </label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                rows={4}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-black focus:border-black"
                required
              />
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Year
                </label>
                <input
                  type="number"
                  value={formData.year}
                  onChange={(e) => setFormData({ ...formData, year: parseInt(e.target.value) })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-black focus:border-black"
                  required
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Medium
                </label>
                <input
                  type="text"
                  value={formData.medium}
                  onChange={(e) => setFormData({ ...formData, medium: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-black focus:border-black"
                  required
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Dimensions
                </label>
                <input
                  type="text"
                  value={formData.dimensions}
                  onChange={(e) => setFormData({ ...formData, dimensions: e.target.value })}
                  placeholder="e.g., 24 x 36 inches"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-black focus:border-black"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Price ($)
                </label>
                <input
                  type="number"
                  value={formData.price}
                  onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-black focus:border-black"
                />
              </div>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Image
              </label>
              <input
                type="file"
                accept="image/*"
                onChange={(e) => setImageFile(e.target.files?.[0] || null)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-black focus:border-black"
                required={!editingArtwork}
              />
            </div>
            
            <div className="flex space-x-4">
              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={formData.isAvailable}
                  onChange={(e) => setFormData({ ...formData, isAvailable: e.target.checked })}
                  className="mr-2"
                />
                Available for sale
              </label>
              
              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={formData.featured}
                  onChange={(e) => setFormData({ ...formData, featured: e.target.checked })}
                  className="mr-2"
                />
                Featured artwork
              </label>
            </div>
            
            <div className="flex space-x-4">
              <button
                type="submit"
                disabled={uploading}
                className="px-4 py-2 bg-black text-white rounded-md hover:bg-gray-800 transition-colors disabled:opacity-50"
              >
                {uploading ? "Saving..." : editingArtwork ? "Update" : "Create"} Artwork
              </button>
              <button
                type="button"
                onClick={resetForm}
                className="px-4 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {artworks.map((artwork) => (
          <div key={artwork._id} className="bg-white p-6 rounded-lg border border-gray-200">
            <div className="aspect-square bg-gray-100 rounded-lg overflow-hidden mb-4">
              {artwork.imageUrl ? (
                <img
                  src={artwork.imageUrl}
                  alt={artwork.title}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-gray-400">
                  No Image
                </div>
              )}
            </div>
            
            <h3 className="font-semibold text-lg text-black mb-1">{artwork.title}</h3>
            <p className="text-gray-600 text-sm mb-2">{artwork.artist?.name}</p>
            <p className="text-gray-500 text-xs mb-4">{artwork.year} • {artwork.medium}</p>
            
            <div className="flex justify-between items-center mb-4">
              <span className={`text-xs px-2 py-1 rounded ${
                artwork.isAvailable ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"
              }`}>
                {artwork.isAvailable ? "Available" : "Sold"}
              </span>
              {artwork.featured && (
                <span className="text-xs px-2 py-1 rounded bg-yellow-100 text-yellow-800">
                  Featured
                </span>
              )}
            </div>
            
            <div className="flex space-x-2">
              <button
                onClick={() => startEdit(artwork)}
                className="px-3 py-1 text-sm bg-gray-100 text-gray-700 rounded hover:bg-gray-200 transition-colors"
              >
                Edit
              </button>
              <button
                onClick={() => removeArtwork({ id: artwork._id })}
                className="px-3 py-1 text-sm bg-red-100 text-red-700 rounded hover:bg-red-200 transition-colors"
              >
                Delete
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
